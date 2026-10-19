/* Профиль, эталоны, модель роста, прогноз, история, двойная прогрессия, отчёт (без изменений из v1). */
import { STD, REF_BW, BW_EXP, AGE_F } from './data.js';
import { S } from './store.js';
import { exById, lastResults, resultBefore, doneCount } from './training.js';
import { hooks } from './hooks.js';
import { parseYmd, fmtNum, r05, DAY, MONTH, parseRange, e1rm } from './util.js';
/* ===== профиль и эталоны ===== */
export const curBW = () => S.bodyLog.length ? Number(S.bodyLog[S.bodyLog.length-1].weight) : null;
/* вес тела на дату: последняя запись не позже даты, до первой записи — первая */
export function bwAt(t){
  if (!S.bodyLog.length) return null;
  let v = Number(S.bodyLog[0].weight);
  for (const x of S.bodyLog){ if (parseYmd(x.date).getTime() <= t) v = Number(x.weight); else break; }
  return v;
}
/* гравитрон: рабочая нагрузка = вес тела − помощь. Пока вес тела не записан, прогресс считается по помощи (меньше — лучше) */
export const byLoad = ex => !!ex && (!ex.assisted || S.bodyLog.length > 0);
export const loadOf = (ex, w, t) => ex && ex.assisted ? Math.max(0, (bwAt(t) || 0) - (Number(w) || 0)) : Number(w) || 0;
/* какое поле сессии отражает силу: e — 1ПМ (у гравитрона — от нагрузки), minW — минимальная помощь */
export const keyOf = ex => byLoad(ex) ? "e" : "minW";
export const profileReady = () => !!(S.profile.sex && curBW());
export function ageFactor(age){
  age = Number(age); if (!age) return 1;
  if (age <= AGE_F[0][0]) return AGE_F[0][1];
  for (let i=1;i<AGE_F.length;i++){ const [a1,f1] = AGE_F[i-1], [a2,f2] = AGE_F[i]; if (age <= a2) return f1 + (f2-f1)*(age-a1)/(a2-a1); }
  return AGE_F[AGE_F.length-1][1];
}
export function standardsFor(ex){
  if (!ex || !ex.std || !STD[ex.std] || ex.assisted) return null;
  const sex = S.profile.sex || "m", ref = REF_BW[sex], bw = curBW() || ref, af = ageFactor(S.profile.age);
  return STD[ex.std][sex].map((v,i)=> v * Math.pow(bw/ref, BW_EXP[sex][i]) * af);
}
export function levelOf(e, st){
  if (e < st[0]) return {idx:-1, frac:Math.max(0, e/st[0])};
  for (let i=0;i<4;i++) if (e < st[i+1]) return {idx:i, frac:(e-st[i])/(st[i+1]-st[i])};
  return {idx:4, frac:1};
}
/* ===== модель роста: стаж + частота + уровень ===== */
/* месячный прирост 1ПМ при ~2,5 тренировки/нед по стажу (мес.) */
export const AGE_RATES = [[3,.07],[6,.04],[12,.025],[24,.012],[48,.006],[1e9,.003]];
/* потолок темпа по уровню относительно эталонов: до старта, Старт, Новичок, Средний, Продвинутый, Элита */
export const LEVEL_CAP = [.09,.07,.035,.012,.005,.0025];
export const FREQ_F = [[1,.6],[2,.88],[2.5,1],[3,1.08],[4,1.08],[6,1.05]];
export function interp(tbl, x){ if (x <= tbl[0][0]) return tbl[0][1]; for (let i=1;i<tbl.length;i++) if (x <= tbl[i][0]) return tbl[i-1][1] + (tbl[i][1]-tbl[i-1][1])*(x-tbl[i-1][0])/(tbl[i][0]-tbl[i-1][0]); return tbl[tbl.length-1][1]; }
export function firstLogTime(){ const t = S.workouts.filter(w=>w.exercises.some(doneCount)).map(w=>parseYmd(w.date).getTime()); return t.length ? Math.min(...t) : Date.now(); }
export function trainingStart(){ const p = S.profile; if (p.start && /^\d{4}-\d{2}$/.test(p.start)){ const [y,m] = p.start.split("-").map(Number); return new Date(y,m-1,1).getTime(); } return firstLogTime(); }
export const ageMonths = t => Math.max(0, (t - trainingStart())/MONTH);
export function loggedFreq(){
  const now = Date.now(), from = now - 42*DAY;
  const dates = [...new Set(S.workouts.filter(w=>w.exercises.some(doneCount) && parseYmd(w.date).getTime() >= from).map(w=>w.date))];
  const span = (now - firstLogTime())/DAY;
  if (dates.length < 3 || span < 21) return null;
  return dates.length / (Math.min(42, span)/7);
}
export function effFreq(){ const l = loggedFreq(), st = Number(S.profile.freq) || 0; if (l !== null && st) return (l+st)/2; return l ?? (st || 2.5); }
export function modelRate(e, st, age){
  const ret = !!S.profile.returning;
  let r = ret && age < 4 ? .085 : ret && age < 8 ? .045 : AGE_RATES.find(([m])=>age < m)[1];
  if (st){ const lv = levelOf(e, st); let cap = LEVEL_CAP[lv.idx+1]; if (ret && age < 12) cap *= 1.6; r = Math.min(r, cap); }
  return r * interp(FREQ_F, effFreq());
}
/* устойчивый наклон (Тейл–Сен), кг в день */
export function theilSen(pts, key){ const sl = []; for (let i=0;i<pts.length;i++) for (let j=i+1;j<pts.length;j++){ const dt = (pts[j].t-pts[i].t)/DAY; if (dt >= 3) sl.push((pts[j][key]-pts[i][key])/dt); } if (!sl.length) return null; sl.sort((a,b)=>a-b); return sl[Math.floor(sl.length/2)]; }
export function forecastFor(ex, pts){
  const n = pts.length, last = pts[n-1];
  const recent = pts.filter(p=>p.t >= last.t - 42*DAY).slice(-3);
  const e0 = Math.max(...recent.map(p=>p.e));            /* старт = лучшее из 3 последних: неполная тренировка не тянет вниз */
  const st = standardsFor(ex);
  const win = pts.filter(p=>p.t >= last.t - 70*DAY), span = win.length ? (win[win.length-1].t - win[0].t)/DAY : 0;
  let personal = null, w = 0;
  if (win.length >= 4 && span >= 21){ const s = theilSen(win, "e"); if (s !== null) personal = Math.max(0, s*30.44/e0); w = Math.min(.7, (win.length-3)*.15); }
  const conf = n < 2 ? 0 : (win.length >= 8 && span >= 42) ? 3 : (win.length >= 4 && span >= 21) ? 2 : 1;
  const now = Date.now();
  /* личный темп сильнее всего влияет на ближайшие месяцы и плавно уходит к модели за полгода */
  const rateAt = (e, m) => { let r = modelRate(e, st, ageMonths(now + m*MONTH)); if (personal !== null){ const wm = w*Math.max(0, 1 - m/6); r = (1-wm)*r + wm*Math.min(personal, Math.max(2*r, .08)); } return r; };
  const sim = months => { let e = e0; for (let m=0;m<months;m++) e *= 1 + rateAt(e, m); return e; };
  let eta = null;
  if (st){ const lv = levelOf(e0, st); if (lv.idx < 4){ const target = st[lv.idx+1]; let e = e0, m = 0; while (e < target && m < 240){ e *= 1 + rateAt(e, m); m++; } eta = {target, idx:lv.idx+1, months:m}; } }
  return {e0, st, conf, personal, w, sim, eta, rate0:modelRate(e0, st, ageMonths(now)), n, win:win.length, span};
}
export const CONF = ["Мало данных","Предварительно","Средняя точность","Высокая точность"];

/* ===== история по упражнению ===== */
export function sessionsFor(exId){
  const map = new Map(), ex = exById(exId);
  S.workouts.forEach(w=>w.exercises.forEach(e=>{
    if (e.exId !== exId) return;
    const done = e.sets.filter(s=>s.done && s.weight!=="" && Number(s.reps)>0);
    if (!done.length) return;
    const t = parseYmd(w.date).getTime(), em = s => e1rm(loadOf(ex, s.weight, t), s.reps);
    const best = done.reduce((b,s)=> em(s) > em(b) ? s : b, done[0]);
    const cur = {date:w.date, t, e:em(best), best, minW:Math.min(...done.map(s=>Number(s.weight)||0))};
    const p = map.get(w.date);
    if (!p || cur.e > p.e) map.set(w.date, cur);
  }));
  return [...map.values()].sort((a,b)=>a.t-b.t);
}
export function personalSlope(pts, key){
  if (pts.length < 3) return null;
  const last = pts[pts.length-1].t, win = pts.filter(p=>p.t >= last - 56*DAY);
  if (win.length < 3 || (win[win.length-1].t - win[0].t) < 14*DAY) return null;
  const n = win.length, xs = win.map(p=>p.t/MONTH), ys = win.map(p=>p[key]);
  const mx = xs.reduce((a,b)=>a+b)/n, my = ys.reduce((a,b)=>a+b)/n;
  let num = 0, den = 0; for (let i=0;i<n;i++){ num += (xs[i]-mx)*(ys[i]-my); den += (xs[i]-mx)**2; }
  return den ? num/den : null;
}
export function stepFor(ex, w){
  if (w < 10) return 1;
  const eq = (ex && ex.equipment) || "";
  if (/гир/i.test(eq)) return 4;
  if (/свобод|гантел/i.test(eq)) return 2;
  return 2.5;
}
/* шаг веса: заданный пользователем для упражнения (хук интерфейса) или по оборудованию */
export const weightStep = (ex, w) => (ex && hooks.stepOverride(ex)) || stepFor(ex, w);
/* рабочие подходы: максимальный вес (у гравитрона — минимальная помощь) */
function workOf(ex, sets0){
  const sets = (sets0 || []).filter(s=>s.weight!=="" && s.reps!=="");
  if (!sets.length) return null;
  const w = ex.assisted ? Math.min(...sets.map(s=>Number(s.weight))) : Math.max(...sets.map(s=>Number(s.weight)));
  const work = sets.filter(s=>Number(s.weight)===w);
  return {w, n:Math.max(work.length, 1), minReps:Math.min(...work.map(s=>Number(s.reps)||0)), done:work.every(s=>s.done), none:work.every(s=>!s.done)};
}
/* двойная прогрессия: цель на следующую тренировку по последнему результату (sets) и предпоследнему (prevSets).
   Две тренировки подряд с одним весом ниже нижней границы диапазона — откат на ~10% нагрузки. */
export function nextTarget(ex, sets, prevSets){
  const a = workOf(ex, sets); if (!a) return null;
  const [lo, hi] = parseRange(ex.reps), w = a.w;
  if (a.none) return {weight:w, reps:Math.max(lo, Math.min(hi, a.minReps||lo)), sets:a.n, unmarked:true, why:"В прошлый раз подходы не отмечены — повтори тот же вес."};
  if (a.done && a.minReps >= hi){
    const st = weightStep(ex, w), nw = ex.assisted ? Math.max(0, r05(w - st)) : r05(w + st);
    return {weight:nw, reps:lo, sets:a.n, up:true, why:"Все подходы сделаны на "+hi+" — "+(ex.assisted?"уменьши помощь":"добавь вес")+" и начни снова с "+lo+"."};
  }
  const b = workOf(ex, prevSets);
  if (a.done && a.minReps < lo && b && b.done && Math.abs(b.w - w) < 0.01 && b.minReps < lo){
    const st = weightStep(ex, w), load = ex.assisted ? (curBW() ? Math.max(curBW() - w, st) : w) : w;
    const k = Math.max(1, Math.round(load * 0.1 / st));
    const nw = ex.assisted ? r05(w + k * st) : Math.max(0, r05(w - k * st));
    return {weight:nw, reps:lo, sets:a.n, deload:true, why:"Две тренировки подряд меньше "+lo+" повторов — "+(ex.assisted?"добавь помощь":"сними вес")+" на ~10% и набирай повторы заново до "+hi+"."};
  }
  return {weight:w, reps:Math.min(hi, Math.max(lo, (a.minReps||lo) + 1)), sets:a.n, why:"Цель — "+hi+" повторов во всех подходах, после этого вес вырастет. Сегодня добавь повтор."};
}
export function recommend(exId, exceptId){
  const ex = exById(exId); if (!ex) return null;
  const [last, prev] = lastResults(exId, exceptId, 2); if (!last) return null;
  return nextTarget(ex, last.sets, prev && prev.sets);
}

/* ===== отчёт по тренировке (считается локально) ===== */
export const MAIN_GROUPS = ["Грудь","Спина","Ноги","Плечи"];
export const WEEK_SETS = [10,20]; /* ориентир рабочих подходов на группу мышц за неделю */
export function reportFor(w){
  const wt = parseYmd(w.date).getTime();
  let done = 0, total = 0, reps = 0;
  const items = [], groupsToday = {};
  w.exercises.forEach(e=>{
    total += e.sets.length;
    const ds = e.sets.filter(s=>s.done && Number(s.reps)>0 && s.weight!=="");
    done += ds.length; reps += ds.reduce((a,s)=>a+(Number(s.reps)||0),0);
    const ex = exById(e.exId);
    const g = (ex && ex.group) || "Другое";
    if (ds.length) groupsToday[g] = (groupsToday[g]||0) + ds.length;
    if (!ds.length){ items.push({name:ex?ex.name:e.name, skipped:true, undone:e.sets.length}); return; }
    const lw = ex && !byLoad(ex), em = s => e1rm(loadOf(ex, s.weight, wt), s.reps);
    const best = ds.reduce((b,s)=> em(s) > em(b) ? s : b, ds[0]);
    const cur = lw ? Math.min(...ds.map(s=>Number(s.weight))) : em(best);
    const prev = e.exId ? sessionsFor(e.exId).filter(p=>p.t < wt) : [];
    const key = lw ? "minW" : "e";
    const last = prev[prev.length-1] || null;
    const prevBest = prev.length ? (lw ? Math.min(...prev.map(p=>p.minW)) : Math.max(...prev.map(p=>p.e))) : null;
    const delta = last ? cur - last[key] : null;
    const pr = prevBest !== null && (lw ? cur < prevBest - 0.01 : cur > prevBest + 0.05);
    const plateau = prev.length >= 3 && !pr && (lw ? cur >= Math.min(...prev.slice(-3).map(p=>p.minW)) : cur <= Math.max(...prev.slice(-3).map(p=>p.e)));
    const before = ex ? resultBefore(e.exId, w) : null, next = ex ? progressionFromSets(ex, e.sets, before && before.sets) : null;
    const st = ex ? standardsFor(ex) : null, lv = st ? levelOf(cur, st) : null;
    items.push({name:ex?ex.name:e.name, group:g, assisted:!!lw, gravitron:!!(ex&&ex.assisted), best, cur, delta, pr, plateau, first:!prev.length, next, lv, undone:e.sets.length-ds.length, sets:ds.map(s=>s.weight+"×"+s.reps).join(", ")});
  });
  /* недельный объём: 7 дней по дату тренировки включительно */
  const week = {};
  S.workouts.forEach(x=>{ const t = parseYmd(x.date).getTime(); if (t > wt || t <= wt - 7*DAY) return;
    x.exercises.forEach(e=>{ const ex = exById(e.exId); const g = (ex && ex.group) || "Другое"; const n = doneCount(e); if (n) week[g] = (week[g]||0) + n; }); });
  const signals = [];
  const undone = total - done; if (undone) signals.push("Не отмечено "+undone+" из "+total+" подходов — если они выполнены, отметь, иначе прогресс считается неточно.");
  items.filter(i=>i.plateau).forEach(i=>{ if (i.next && i.next.up){ i.plateau = false; i.stuckTop = true; signals.push("«"+i.name+"»: верх диапазона взят, а вес не менялся несколько тренировок — в следующий раз поставь "+fmtNum(i.next.weight)+" кг."); }
    else signals.push("«"+i.name+"»: 1ПМ не растёт 4 тренировки подряд. Попробуй сменить диапазон повторов или снизить вес на ~10% и набрать повторы."); });
  items.filter(i=>!i.skipped && i.delta!==null && !i.assisted && i.cur < (i.cur-i.delta)*0.95).forEach(i=>signals.push("«"+i.name+"»: результат ниже прошлого более чем на 5% — возможно, недовосстановление."));
  MAIN_GROUPS.forEach(g=>{ if (!week[g]) signals.push("За 7 дней нет подходов на группу «"+g+"»."); });
  return {date:w.date, done, total, reps, items, groupsToday, week, signals, prs:items.filter(i=>i.pr).length};
}
export function progressionFromSets(ex, sets, prevSets){
  const t = nextTarget(ex, sets, prevSets);
  return t && {up:!!t.up, deload:!!t.deload, weight:t.weight, reps:t.reps};
}
