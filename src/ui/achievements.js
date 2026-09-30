/* Достижения. Считаются по уже записанным данным (тренировки, каталог, вес тела) существующими
   функциями расчёта, поэтому работают для прошлых записей и после импорта. Схема данных не меняется:
   в настройках UI (wd.ui) хранится только «что уже показано» и отметка о пасхалке. */
import { S } from '../core/store.js';
import { exById, doneCount } from '../core/training.js';
import { sessionsFor, standardsFor, levelOf, MAIN_GROUPS } from '../core/calc.js';
import { parseYmd, DAY, fmtNum, esc } from '../core/util.js';
import { prefs, savePrefs } from './state.js';
import { overallRank, recordEvents } from './derive.js';
import { I } from './icons.js';
import { openSheet, toast } from './sheet.js';
import { rankUpFx } from '../motion/motion.js';
import { ring } from './components.js';
import { haptic } from '../native/native.js';

export const CATS = ["Постоянство", "Сила", "Объём", "Разнообразие", "Дисциплина", "Секретное"];

/* один проход по данным → показатели */
function stats(){
  const dates = [...new Set(S.workouts.filter(w=>w.exercises.some(doneCount)).map(w=>w.date))].sort();
  const ts = dates.map(d=>parseYmd(d).getTime());
  /* 3 тренировки за 7 дней */
  let week3 = 0; for (let i = 2; i < ts.length; i++) if (ts[i] - ts[i-2] < 7*DAY) week3 = 1;
  /* серия недель подряд с ≥ 2 тренировками (неделя с понедельника) */
  const wk = t => { const d = new Date(t); const dow = (d.getDay() + 6) % 7; return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow).getTime()) / (7*DAY)); };
  const perWeek = new Map(); ts.forEach(t=>perWeek.set(wk(t), (perWeek.get(wk(t)) || 0) + 1));
  const good = [...perWeek.entries()].filter(([, n])=>n >= 2).map(([k])=>k).sort((a,b)=>a-b);
  let streak = 0, run = 0; good.forEach((k, i)=>{ run = i && k === good[i-1] + 1 ? run + 1 : 1; streak = Math.max(streak, run); });
  /* объём, разнообразие, идеальные тренировки, группы за неделю */
  let tonnage = 0, reps = 0, perfect = 0;
  const exDone = new Set(), groupsByDate = new Map();
  S.workouts.forEach(w=>{
    const total = w.exercises.reduce((a, e)=>a + e.sets.length, 0), done = w.exercises.reduce((a, e)=>a + doneCount(e), 0);
    if (total >= 9 && done === total) perfect++;
    w.exercises.forEach(e=>{
      const ex = exById(e.exId);
      e.sets.forEach(s=>{
        if (!s.done || !(Number(s.reps) > 0)) return;
        reps += Number(s.reps);
        if (s.weight !== "" && !(ex && ex.assisted)) tonnage += Number(s.weight) * Number(s.reps);
        if (e.exId) exDone.add(e.exId);
        if (ex && ex.group){ const g = groupsByDate.get(w.date) || new Set(); g.add(ex.group); groupsByDate.set(w.date, g); }
      });
    });
  });
  let allGroups = 0;
  dates.forEach(d=>{ const end = parseYmd(d).getTime(), seen = new Set();
    groupsByDate.forEach((g, dd)=>{ const t = parseYmd(dd).getTime(); if (t <= end && t > end - 7*DAY) g.forEach(x=>seen.add(x)); });
    if (MAIN_GROUPS.every(g=>seen.has(g))) allGroups = 1; });
  /* сила: лучший уровень в любом упражнении, гравитрон */
  let bestLv = -1, assistDrop = 0, noAssist = 0;
  S.catalog.forEach(ex=>{
    const pts = sessionsFor(ex.id); if (!pts.length) return;
    if (ex.assisted){ const mins = pts.map(p=>p.minW); assistDrop = Math.max(assistDrop, mins[0] - Math.min(...mins)); if (Math.min(...mins) <= 0) noAssist = 1; return; }
    const st = standardsFor(ex); if (st) bestLv = Math.max(bestLv, levelOf(Math.max(...pts.map(p=>p.e)), st).idx);
  });
  const rank = overallRank();
  return {workouts:dates.length, week3, streak, records:recordEvents(Infinity).length, bestLv, rank:rank ? rank.idx : -1,
    tonnage, reps, allGroups, exercises:exDone.size, perfect, body:S.bodyLog.length, assistDrop, noAssist, egg:prefs.egg ? 1 : 0};
}

const t1 = v => fmtNum(v / 1000, 1)+" т";
/* [id, категория, название, описание, показатель, цель, формат прогресса] */
const DEFS = [
  ["w1", 0, "Первый шаг", "Первая тренировка с отмеченными подходами", s=>s.workouts, 1],
  ["w10", 0, "Десятка", "10 тренировок", s=>s.workouts, 10],
  ["w25", 0, "Четверть сотни", "25 тренировок", s=>s.workouts, 25],
  ["w50", 0, "Полсотни", "50 тренировок", s=>s.workouts, 50],
  ["w100", 0, "Сотня", "100 тренировок", s=>s.workouts, 100],
  ["week3", 0, "Неделя в ритме", "3 тренировки за 7 дней", s=>s.week3, 1],
  ["str4", 0, "Месяц без пропусков", "4 недели подряд по 2+ тренировки", s=>s.streak, 4],
  ["str12", 0, "Сезон дисциплины", "12 недель подряд по 2+ тренировки", s=>s.streak, 12],
  ["pr1", 1, "Первый рекорд", "Побить свой лучший 1ПМ", s=>s.records, 1],
  ["pr10", 1, "Коллекционер рекордов", "10 рекордов", s=>s.records, 10],
  ["pr50", 1, "Рекордсмен", "50 рекордов", s=>s.records, 50],
  ["lv2", 1, "Средний уровень", "Уровень «Средний» в любом упражнении", s=>s.bestLv >= 2 ? 1 : 0, 1],
  ["lv3", 1, "Продвинутый", "Уровень «Продвинутый» в любом упражнении", s=>s.bestLv >= 3 ? 1 : 0, 1],
  ["lv4", 1, "Элита", "Уровень «Элита» в любом упражнении", s=>s.bestLv >= 4 ? 1 : 0, 1],
  ["rank2", 1, "Крепкая середина", "Общий ранг «Средний»", s=>s.rank >= 2 ? 1 : 0, 1],
  ["t1", 2, "Первая тонна", "Поднять 1 т за всё время", s=>s.tonnage, 1000, t1],
  ["t10", 2, "Десять тонн", "Поднять 10 т за всё время", s=>s.tonnage, 10000, t1],
  ["t100", 2, "Сто тонн", "Поднять 100 т за всё время", s=>s.tonnage, 100000, t1],
  ["r1k", 2, "Тысяча повторов", "1 000 повторений", s=>s.reps, 1000],
  ["r10k", 2, "Десять тысяч повторов", "10 000 повторений", s=>s.reps, 10000],
  ["grp", 3, "Всё тело", "Грудь, спина, ноги и плечи за одну неделю", s=>s.allGroups, 1],
  ["ex10", 3, "Разнообразие", "10 разных упражнений", s=>s.exercises, 10],
  ["ex20", 3, "Широкий арсенал", "20 разных упражнений", s=>s.exercises, 20],
  ["perf", 4, "Идеальная тренировка", "Все подходы отмечены, 9 и больше", s=>s.perfect, 1],
  ["body10", 4, "На весах", "10 записей веса тела", s=>s.body, 10],
  ["as10", 4, "Меньше помощи", "Помощь гравитрона меньше на 10 кг", s=>s.assistDrop, 10, v=>fmtNum(v)+" кг"],
  ["as0", 4, "Без помощи", "Подход на гравитроне без противовеса", s=>s.noAssist, 1],
  ["egg", 5, "???", "Секрет", s=>s.egg, 1]
];

export function achievements(){
  const s = stats();
  return DEFS.map(([id, cat, title, desc, fn, goal, fmt])=>{
    const v = fn(s), done = v >= goal;
    const secret = id === "egg" && !done;
    return {id, cat, title:secret ? "???" : (id === "egg" ? "Любопытство" : title), desc:secret ? "Найди сам" : (id === "egg" ? "Найти пасхалку" : desc), done, p:Math.min(1, v / goal),
      prog:done || goal === 1 ? "" : (fmt ? fmt(v) + " / " + fmt(goal) : fmtNum(Math.floor(v)) + " / " + fmtNum(goal))};
  });
}
export const unlockedIds = () => achievements().filter(a=>a.done).map(a=>a.id);

/* первое открытие: всё уже полученное считаем показанным, чтобы не засыпать уведомлениями */
export function initAchievements(){
  if (!Array.isArray(prefs.achShown)){ prefs.achShown = unlockedIds(); prefs.achNew = []; savePrefs(); }
}
/* новые достижения после изменения данных → отметка «новое» и список для уведомления */
export function collectNew(){
  const shown = new Set(prefs.achShown || []), fresh = achievements().filter(a=>a.done && !shown.has(a.id));
  if (fresh.length){ prefs.achShown = [...shown, ...fresh.map(a=>a.id)]; prefs.achNew = [...new Set([...(prefs.achNew || []), ...fresh.map(a=>a.id)])]; savePrefs(); }
  return fresh;
}

const badge = a => '<button class="badge-card'+(a.done ? ' on' : '')+((prefs.achNew || []).includes(a.id) ? ' new' : '')+'" data-ach="'+a.id+'" aria-label="'+esc(a.title+". "+a.desc+(a.done ? ". Получено" : a.prog ? ". "+a.prog : ""))+'">'
  + '<span class="b-star">'+I.star+'</span><span class="b-t">'+esc(a.title)+'</span>'
  + (a.done ? '' : '<span class="b-bar"><i style="transform:scaleX('+a.p.toFixed(3)+')"></i></span>'+(a.prog ? '<span class="b-p">'+esc(a.prog)+'</span>' : ''))+'</button>';

/* блок в профиле: счётчик, ближайшие и новые */
export function achievementsSection(){
  const list = achievements(), got = list.filter(a=>a.done).length, isNew = new Set(prefs.achNew || []);
  const pick = [...list].sort((a,b)=>(isNew.has(b.id) - isNew.has(a.id)) || (b.done - a.done) || (b.p - a.p)).slice(0, 6);
  return '<section class="card"><div class="section-head" style="margin-bottom:12px"><h2 class="h2">Достижения</h2><span class="num" style="font-size:18px">'+got+'<span class="muted" style="font-size:14px"> / '+list.length+'</span></span></div>'
    + '<div class="badges">'+pick.map(badge).join("")+'</div><button class="btn sec block" style="margin-top:12px" data-act="achAll">Все достижения</button></section>';
}
export function openAchievements(){
  const list = achievements();
  openSheet("Достижения", CATS.map((c, i)=>{ const items = list.filter(a=>a.cat === i); return '<h3>'+c+'</h3><div class="badges">'+items.map(badge).join("")+'</div>'; }).join("")
    + '<p class="note">Считаются по записанным тренировкам: прошлые данные и импорт тоже учитываются.</p>');
  prefs.achNew = []; savePrefs();
}

/* тап по значку — описание и прогресс */
document.addEventListener("click", e=>{
  const b = e.target.closest("[data-ach]"); if (!b) return;
  const a = achievements().find(x=>x.id === b.dataset.ach); if (!a) return;
  toast(a.title+" — "+a.desc+(a.done ? " · получено" : a.prog ? " · "+a.prog : ""));
});

/* всплывающая карточка нового достижения (слой эффектов, касания проходят насквозь) */
export function notifyAchievements(fresh, delay = 0){
  if (!fresh.length) return;
  setTimeout(()=>{
    let layer = document.querySelector(".fx-layer");
    if (!layer){ layer = document.createElement("div"); layer.className = "fx-layer"; layer.setAttribute("aria-hidden", "true"); document.body.appendChild(layer); }
    const card = document.createElement("div"); card.className = "rankfx";
    card.innerHTML = '<div class="rank-stack ach-star"><span class="r-new">'+I.star+'</span></div><div class="grow"><div class="cap">Достижение'+(fresh.length > 1 ? ' · ещё '+(fresh.length - 1) : '')+'</div><div class="h2">'+esc(fresh[0].title)+'</div><div class="muted small">'+esc(fresh[0].desc)+'</div></div>'+ring(0, "", "", "");
    layer.appendChild(card);
    const live = document.getElementById("live"); if (live) live.textContent = "Новое достижение: "+fresh.map(a=>a.title).join(", ");
    haptic("success");
    rankUpFx({card, ring:card.querySelector(".ring"), from:0, to:1, artNew:card.querySelector(".r-new"), onDone:()=>card.remove()});
  }, delay);
}
