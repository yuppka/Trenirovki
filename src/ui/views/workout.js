/* Тренировка: фокус на одном упражнении, лента упражнений, ввод веса и повторов крупно,
   список подходов, «Подход выполнен» в доке над навигацией. Логика данных — как в v1. */
import { S, touchWorkout } from '../../core/store.js';
import { exById, doneCount, lastResult } from '../../core/training.js';
import { recommend, stepFor, sessionsFor, standardsFor, levelOf, byLoad, loadOf } from '../../core/calc.js';
import { esc, fmtNum, fmtTitle, fmtWeekday, parseRange, rangeText, parseYmd, e1rm, toNum, today, $ } from '../../core/util.js';
import { hooks } from '../../core/hooks.js';
import { ui, prefs, savePrefs } from '../state.js';
import { topbar, art, emptyState, ring, lvName } from '../components.js';
import { I, star } from '../icons.js';
import { openSheet, closeSheet, toast, askConfirm } from '../sheet.js';
import { actions, act } from '../actions.js';
import { workoutTitle, autoTitle, overallRank, rankArt } from '../derive.js';
import { setDigits, setDoneFx, recordFx, rankUpFx, reduced, anim } from '../../motion/motion.js';
import { haptic } from '../../native/native.js';
import { startRest, restFor, logRest } from '../rest.js';
import { collectNew, notifyAchievements } from '../achievements.js';

export const curW = () => S.workouts.find(x=>x.id===ui.workoutId);
const numText = v => (v === "" || v == null || isNaN(v)) ? "0" : String(Math.round(Number(v) * 100) / 100).replace(".", ",");
const isBarbell = ex => !!ex && /штанг/i.test((ex.equipment || "")+" "+ex.name);

function focusState(w){
  if (ui.focus.wid !== w.id){
    const first = w.exercises.findIndex(e=>e.sets.some(s=>!s.done));
    ui.focus = {wid:w.id, e:first >= 0 ? first : 0, s:{}};
  }
  ui.focus.e = Math.max(0, Math.min(ui.focus.e, w.exercises.length - 1));
  return ui.focus;
}
export function curSetIdx(w, ei){
  const e = w.exercises[ei]; if (!e || !e.sets.length) return -1;
  const sel = ui.focus.s[ei]; if (sel != null && sel < e.sets.length) return sel;
  const u = e.sets.findIndex(s=>!s.done); return u >= 0 ? u : e.sets.length - 1;
}
const stepOf = (ex, f, s) => {
  const p = prefs.steps[ex ? ex.id : ""] || {};
  return f === "reps" ? (p.r || 1) : (p.w || stepFor(ex, Number(s && s.weight) || 0));
};

/* прошлый результат одной строкой: «59,5 × 8, 7, 6» или «40 × 8 · 59,5 × 8, 6» */
function setsSummary(sets){
  const out = [];
  sets.filter(x=>x.weight !== "" && x.reps !== "").forEach(x=>{
    const l = out[out.length - 1];
    if (l && l.w === Number(x.weight)) l.r.push(numText(x.reps)); else out.push({w:Number(x.weight), r:[numText(x.reps)]});
  });
  return out.map(g=>numText(g.w)+" × "+g.r.join(", ")).join(" · ");
}

export function viewWorkout(){
  const w = curW(), F = focusState(w);
  let h = topbar({back:"closeWorkout", plus:{act:"addEx", label:"Добавить упражнение"},
    tabs:[{label:"Тренировка", act:"noop", current:true}, {label:"Итоги", act:"report", attrs:' data-id="'+w.id+'"', disabled:!w.exercises.some(doneCount)}]});
  h += '<div class="w-head"><div class="grow"><div class="h3">'+esc(workoutTitle(w))+'</div><div class="cap">'+esc(fmtTitle(w.date)+", "+parseYmd(w.date).toLocaleDateString("ru-RU", {weekday:"short"}))+'</div></div>'
    + (w.exercises.length ? '<button class="btn sec small w-finish" data-act="finish">'+I.flag+'Завершить</button>' : '')
    + '<button class="mini" data-act="workoutMenu" aria-label="Действия с тренировкой">'+I.more+'</button></div>';
  if (!w.exercises.length) return h + '<div class="card">'+emptyState("Добавь первое упражнение", "Вес и повторы подставятся из прошлой тренировки.", '<button class="btn" data-act="addEx">+ Упражнение</button>')+'</div>';

  h += '<div class="chips ribbon" id="ribbon" role="tablist" aria-label="Упражнения">'+w.exercises.map((e, i)=>{
    const ex = exById(e.exId), d = doneCount(e), all = e.sets.length && d === e.sets.length;
    return '<button class="chip'+(i === F.e ? ' solid on' : '')+(all ? ' done' : '')+'" role="tab" aria-selected="'+(i === F.e)+'" data-act="focusEx" data-e="'+i+'"><span class="n">'+(i + 1)+'</span><span>'+esc(ex ? ex.name : e.name)+'</span><span class="badge">'+d+'/'+e.sets.length+'</span></button>';
  }).join("")+'<button class="chip" data-act="addEx" aria-label="Добавить упражнение">'+I.plus+'</button></div>';

  const i = F.e, e = w.exercises[i], ex = exById(e.exId), rec = ex ? recommend(e.exId, w.id) : null, range = ex ? parseRange(ex.reps) : null;
  const j = curSetIdx(w, i), s = e.sets[j], last = ex ? lastResult(e.exId, w.id) : null, pre = ex && ex.assisted ? "помощь " : "";
  /* всё про текущее упражнение — в одном блоке: по нему листаются упражнения свайпом */
  h += '<div class="w-swipe" id="w-swipe"><div class="ex-title"><div class="grow"><h1 class="h2">'+esc(ex ? ex.name : e.name)+'</h1>'
    + '<div class="hint">'+esc([ex && ex.group, range && ("диапазон "+rangeText(range)+" повт.")].filter(Boolean).join(" · "))+(ex && ex.assisted ? ' · помощь: меньше — лучше' : '')+'</div></div></div>';
  if (rec || last){
    const differs = rec && s && !s.done && (Number(s.weight) !== rec.weight || Number(s.reps) !== rec.reps);
    h += '<div class="rec">'+(rec ? '<button class="txt" data-act="recWhy" data-why="'+esc(rec.why)+'" aria-label="Цель: '+pre+fmtNum(rec.weight)+' кг на '+rec.reps+'. '+esc(rec.why)+'"><span class="k">Цель</span> <b>'+pre+fmtNum(rec.weight)+' × '+rec.reps+'</b>'
        + (rec.up ? ' <span class="up">'+(ex.assisted ? '↓' : '↑ вес')+'</span>' : rec.deload ? ' <span class="down">откат</span>' : '')+'</button>' : '')
      + (last ? '<span class="prev">в прошлый раз '+esc(setsSummary(last.sets))+'</span>' : '')
      + (differs ? '<button class="btn sec small" data-act="applyRec" data-e="'+i+'">Подставить</button>' : '')+'</div>';
  }

  if (s){
    const wl = ex && ex.assisted ? "Помощь, кг" : "Вес, кг";
    const row = (f, label) => '<div class="in-row"><div class="in-lbl"><span class="cap" id="lbl-'+f+'">'+label+'</span><button class="stepcap" data-act="stepPick" data-f="'+f+'">шаг '+numText(stepOf(ex, f, s))+(f === "reps" ? "" : " кг")+'</button></div>'
      + '<div class="in-ctl"><span class="pm"><button data-pm="'+f+'" data-d="-1" aria-label="'+(f === "reps" ? "Меньше повторов" : "Меньше веса")+'">'+I.minus+'</button></span>'
      + '<button class="numbtn" data-act="editNum" data-f="'+f+'" aria-describedby="lbl-'+f+'" aria-label="'+label+': '+numText(s[f])+'. Нажми, чтобы ввести"><span class="bigval" data-num="'+f+'"></span></button>'
      + '<span class="pm"><button data-pm="'+f+'" data-d="1" aria-label="'+(f === "reps" ? "Больше повторов" : "Больше веса")+'">'+I.plus+'</button></span></div></div>';
    h += '<section class="input-card" aria-label="Подход '+(j + 1)+'">'+row("weight", wl)+row("reps", "Повторы")
      + (isBarbell(ex) ? '<button class="btn ghost small" style="margin-top:10px;width:100%" data-act="plates">'+I.plate+' Блины на штангу</button>' : '')+'</section>';
  }

  h += '<section class="sets" aria-label="Подходы"><div class="cap sets-cap">Подходы · '+doneCount(e)+' из '+e.sets.length+'<span class="muted"> · нажми, чтобы выбрать</span></div><div class="set-grid">';
  e.sets.forEach((x, k)=>{
    const cls = k === j ? "cur" : x.done ? "done" : "future";
    h += '<div class="set-cell" data-st><button class="set '+cls+'" data-act="selSet" data-s="'+k+'" aria-pressed="'+(k === j)+'" aria-label="Подход '+(k + 1)+': '+numText(x.weight)+' кг на '+numText(x.reps)+(x.done ? ', выполнен' : '')+'">'
      + '<span class="top"><span class="n">'+(k + 1)+'</span><span class="mark">'+(x.done ? I.check : '')+'</span></span><span class="v">'+numText(x.weight)+' × '+numText(x.reps)+'</span><span class="flash"></span></button>'
      + (k === j ? '<button class="set-del" data-act="delSet" data-e="'+i+'" data-s="'+k+'" aria-label="Удалить подход '+(k + 1)+'">'+I.x+'</button>' : '')+'</div>';
  });
  h += '<button class="set add" data-act="addSet" data-e="'+i+'" aria-label="Добавить подход">'+I.plus+'<span>Подход</span></button></div></section></div>';
  return h + workoutFooter(w);
}

/* док над краем экрана — одно главное действие: отметить подход → перейти к следующему упражнению → завершить */
export function workoutDock(){
  const w = curW(); if (!w || !w.exercises.length) return "";
  const i = ui.focus.e, e = w.exercises[i], j = curSetIdx(w, i), s = e && e.sets[j];
  if (s && !s.done) return '<button class="btn xl block done-btn" id="done-btn" data-act="doneSet"><span>Подход '+(j + 1)+' выполнен</span><small id="done-val">'+numText(s.weight)+' кг × '+numText(s.reps)+'</small></button>';
  if (ui.focus.s[i] != null) return "";
  const next = w.exercises.findIndex((x, k)=>k !== i && x.sets.some(y=>!y.done));
  if (e && e.sets.length && e.sets.every(x=>x.done) && next >= 0){ const nx = exById(w.exercises[next].exId); return '<button class="btn xl block done-btn" data-act="focusEx" data-e="'+next+'"><span>Дальше: '+esc(nx ? nx.name : w.exercises[next].name)+'</span></button>'; }
  if (w.exercises.every(x=>x.sets.length && x.sets.every(y=>y.done))) return '<button class="btn xl block done-btn" data-act="finish">'+I.flag+' Завершить тренировку</button>';
  return "";
}

/* под подходами — только снятие отметки с выбранного подхода */
function workoutFooter(w){
  const i = ui.focus.e, e = w.exercises[i], j = curSetIdx(w, i), s = e && e.sets[j];
  if (!(s && s.done && ui.focus.s[i] != null)) return "";
  return '<div class="w-foot"><button class="btn sec block" data-act="undoSet">Снять отметку с подхода '+(j + 1)+'</button></div>';
}

/* после рендера: числа, ленту, долгое нажатие */
export function mountWorkout(root){
  const w = curW(); if (!w || !w.exercises.length) return;
  const i = ui.focus.e, e = w.exercises[i], s = e.sets[curSetIdx(w, i)];
  if (s) root.querySelectorAll("[data-num]").forEach(el=>setDigits(el, numText(s[el.dataset.num]), false));
  const on = root.querySelector("#ribbon .chip.on");
  if (on) on.scrollIntoView({block:"nearest", inline:"center", behavior:reduced() ? "auto" : "smooth"});
}

/* свайп влево/вправо по блоку упражнения — соседнее упражнение */
let sw = null, swiped = 0;
document.addEventListener("touchstart", ev=>{
  sw = null;
  if (ev.touches.length !== 1 || !ev.target.closest("#w-swipe") || ev.target.closest("input")) return;
  const t = ev.touches[0]; sw = {x:t.clientX, y:t.clientY, at:Date.now()};
}, {passive:true});
document.addEventListener("touchend", ev=>{
  if (!sw) return;
  const t = ev.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y, quick = Date.now() - sw.at < 700; sw = null;
  if (!quick || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
  const w = curW(); if (!w) return;
  const n = ui.focus.e + (dx < 0 ? 1 : -1); if (n < 0 || n >= w.exercises.length) return;
  swiped = Date.now(); clearTimeout(lp);
  ui.focus.e = n; hooks.render(); haptic("light");
  const box = $("#w-swipe"); if (box && !reduced()) anim(box, [{transform:"translateX("+(dx < 0 ? 32 : -32)+"px)", opacity:0}, {transform:"none", opacity:1}], 220);
}, {passive:true});
/* касание, которым был свайп, не должно нажать кнопку под пальцем */
document.addEventListener("click", ev=>{ if (Date.now() - swiped < 400){ ev.stopPropagation(); ev.preventDefault(); } }, true);

/* ± : короткое нажатие — шаг, долгое — выбор шага */
let lp = null, suppress = false;
document.addEventListener("pointerdown", ev=>{
  const b = ev.target.closest("[data-pm]"); if (!b) return;
  suppress = false; clearTimeout(lp);
  lp = setTimeout(()=>{ suppress = true; haptic("light"); stepPicker(b.dataset.pm); }, 450);
}, {passive:true});
["pointerup","pointercancel","pointerleave"].forEach(t=>document.addEventListener(t, ()=>clearTimeout(lp), {passive:true}));
document.addEventListener("contextmenu", ev=>{ if (ev.target.closest("[data-pm]")) ev.preventDefault(); });
document.addEventListener("click", ev=>{
  const b = ev.target.closest("[data-pm]"); if (!b) return;
  if (suppress){ suppress = false; return; }
  applyStep(b.dataset.pm, +b.dataset.d);
});

function applyStep(f, dir){
  const w = curW(); if (!w) return;
  const i = ui.focus.e, e = w.exercises[i], j = curSetIdx(w, i), s = e && e.sets[j]; if (!s) return;
  const ex = exById(e.exId), step = stepOf(ex, f, s);
  let v = Number(s[f]) || 0;
  v = f === "reps" ? Math.max(0, Math.round(v + dir * step)) : Math.max(0, Math.round((v + dir * step) * 100) / 100);
  s[f] = v; touchWorkout(w);
  patchSet(f, s, j);
}
function patchSet(f, s, j){
  const el = document.querySelector('[data-num="'+f+'"]'); if (el) setDigits(el, numText(s[f]), true);
  const row = document.querySelector('.set[data-s="'+j+'"] .v'); if (row) row.textContent = numText(s.weight)+" × "+numText(s.reps);
  const dv = document.getElementById("done-val"); if (dv) dv.textContent = numText(s.weight)+" кг × "+numText(s.reps);
  const nb = document.querySelector('.numbtn[data-f="'+f+'"]'); if (nb) nb.setAttribute("aria-label", nb.getAttribute("aria-label").replace(/: [^.]*\./, ": "+numText(s[f])+"."));
}

function stepPicker(f){
  const w = curW(); if (!w) return;
  const e = w.exercises[ui.focus.e], ex = exById(e.exId); if (!ex) return;
  const s = e.sets[curSetIdx(w, ui.focus.e)];
  const opts = f === "reps" ? [1, 2, 5] : [0.5, 1, 1.25, 2.5, 5, 10];
  const cur = stepOf(ex, f, s), auto = f === "reps" ? 1 : stepFor(ex, Number(s && s.weight) || 0);
  const has = !!(prefs.steps[ex.id] && prefs.steps[ex.id][f === "reps" ? "r" : "w"]);
  openSheet(f === "reps" ? "Шаг повторов" : "Шаг веса",
    '<p class="muted small" style="margin:0 0 12px">Для «'+esc(ex.name)+'». Запоминается для этого упражнения.</p><div class="chips" style="flex-wrap:wrap" id="stp">'
    + '<button class="chip'+(!has ? ' solid on' : '')+'" data-v="">Авто · '+numText(auto)+'</button>'
    + opts.map(v=>'<button class="chip'+(has && v === cur ? ' solid on' : '')+'" data-v="'+v+'">'+numText(v)+(f === "reps" ? '' : ' кг')+'</button>').join("")+'</div>',
    root=>{ root.querySelector("#stp").onclick = ev=>{ const b = ev.target.closest("[data-v]"); if (!b) return;
      const k = f === "reps" ? "r" : "w", p = prefs.steps[ex.id] = prefs.steps[ex.id] || {};
      if (b.dataset.v === "") delete p[k]; else p[k] = +b.dataset.v;
      if (!Object.keys(p).length) delete prefs.steps[ex.id];
      savePrefs(); closeSheet(); hooks.render(); }; });
}

/* ввод числа с клавиатуры: поле не перекрывается клавиатурой */
function editNum(f){
  const w = curW(); if (!w) return;
  const i = ui.focus.e, j = curSetIdx(w, i), s = w.exercises[i].sets[j]; if (!s) return;
  const btn = document.querySelector('.numbtn[data-f="'+f+'"]'); if (!btn) return;
  const inp = document.createElement("input");
  inp.type = "text"; inp.inputMode = f === "reps" ? "numeric" : "decimal"; inp.className = "numedit"; inp.value = s[f] === "" ? "" : numText(s[f]);
  inp.setAttribute("aria-label", f === "reps" ? "Повторы" : "Вес, кг"); inp.setAttribute("enterkeyhint", "done");
  btn.replaceWith(inp); inp.focus(); inp.select();
  setTimeout(()=>inp.scrollIntoView({block:"center", behavior:"auto"}), 320);
  let done = false;
  const commit = ()=>{ if (done) return; done = true; s[f] = toNum(inp.value); touchWorkout(w); hooks.render(); };
  inp.addEventListener("blur", commit);
  inp.addEventListener("keydown", ev=>{ if (ev.key === "Enter"){ ev.preventDefault(); inp.blur(); } if (ev.key === "Escape"){ done = true; hooks.render(); } });
}

/* живой рекорд и повышение уровня: считаются существующими функциями, формулы не меняются */
function detectFx(w, e, j){
  const s = e.sets[j], ex = exById(e.exId), out = {record:false, lv:null};
  if (!ex || s.weight === "" || !(Number(s.reps) > 0)) return out;
  const wt = parseYmd(w.date).getTime(), prev = sessionsFor(ex.id).filter(p=>p.t < wt);
  const others = e.sets.filter((x, k)=>k !== j && x.done && x.weight !== "" && Number(x.reps) > 0);
  if (!byLoad(ex)){
    const cand = Number(s.weight), pm = prev.length ? Math.min(...prev.map(p=>p.minW)) : null;
    const tm = others.length ? Math.min(...others.map(x=>Number(x.weight))) : Infinity;
    out.record = pm !== null && cand < Math.min(pm, tm) - 0.01;
    return out;
  }
  const em = x => e1rm(loadOf(ex, x.weight, wt), x.reps);
  const cand = em(s), pb = prev.length ? Math.max(...prev.map(p=>p.e)) : null;
  const tb = others.length ? Math.max(...others.map(em)) : 0;
  out.record = pb !== null && cand > Math.max(pb, tb) + 0.05;
  const st = standardsFor(ex), before = Math.max(pb || 0, tb);
  if (st && before > 0){ const a = levelOf(before, st), b = levelOf(Math.max(before, cand), st); if (b.idx > a.idx) out.lv = {name:ex.name, from:a, to:b}; }
  return out;
}

function rankOverlay(title, sub, fromIdx, toIdx, fromP, toP){
  let layer = document.querySelector(".fx-layer");
  if (!layer){ layer = document.createElement("div"); layer.className = "fx-layer"; layer.setAttribute("aria-hidden", "true"); document.body.appendChild(layer); }
  const card = document.createElement("div");
  card.className = "rankfx";
  card.innerHTML = '<div class="rank-stack">'+art(rankArt(fromIdx), "contain r-old", "", {cut:true})+art(rankArt(toIdx), "contain r-new", "", {cut:true})+'</div>'
    + '<div class="grow"><div class="cap">'+esc(sub)+'</div><div class="h2">'+esc(title)+'</div></div>'+ring(fromP, star(), "", "");
  layer.appendChild(card);
  const live = $("#live"); if (live) live.textContent = sub+": "+title;
  rankUpFx({card, ring:card.querySelector(".ring"), from:fromP, to:toP, artOld:card.querySelector(".r-old"), artNew:card.querySelector(".r-new"), onDone:()=>card.remove()});
}

let lastDone = null;   /* время прошлой отметки — для замера реального отдыха */
function doneSet(){
  const w = curW(); if (!w) return;
  const i = ui.focus.e, e = w.exercises[i], j = curSetIdx(w, i), s = e && e.sets[j]; if (!s || s.done) return;
  const before = overallRank(), fx = detectFx(w, e, j);
  s.done = true;
  /* следующий подход начинается с того, что реально сделано в этом (а не с прошлой тренировки) */
  const nx = e.sets[j + 1]; if (nx && !nx.done){ nx.weight = s.weight; nx.reps = s.reps; }
  touchWorkout(w);
  const after = overallRank();
  delete ui.focus.s[i];
  hooks.render();
  haptic("light");
  setDoneFx(document.querySelector('.set[data-s="'+j+'"]'), $("#done-btn") || document.querySelector(".done-btn"));
  const ex = exById(e.exId);
  const now = Date.now();
  if (ex && lastDone && lastDone.wid === w.id && lastDone.e === i) logRest(ex.id, (now - lastDone.t) / 1000, s.reps);
  lastDone = {wid:w.id, e:i, t:now};
  startRest(restFor(ex));
  let delay = 0;
  if (fx.record){
    haptic("medium"); delay = reduced() ? 0 : 1000;
    recordFx(document.querySelector('[data-num="weight"]') || document.querySelector(".input-card"));
    const live = $("#live"); if (live) live.textContent = "Новый рекорд";
    if (reduced()) toast("Новый рекорд: "+numText(s.weight)+" кг × "+s.reps);
  }
  let shown = false;
  if (before && after && after.idx > before.idx){ shown = true; setTimeout(()=>{ haptic("success"); rankOverlay(lvName(after.idx), "Новый ранг", before.idx, after.idx, before.p, after.p); }, delay); }
  else if (fx.lv){ shown = true; setTimeout(()=>{ haptic("success"); rankOverlay(lvName(fx.lv.to.idx), fx.lv.name, fx.lv.from.idx, fx.lv.to.idx, fx.lv.from.frac, fx.lv.to.idx === 4 ? 1 : fx.lv.to.frac); }, delay); }
  notifyAchievements(collectNew(), delay + (shown ? (reduced() ? 1700 : 2400) : 0));
}

/* меню тренировки: название, дата, порядок, удаление, итоги */
function workoutMenu(){
  const w = curW(); if (!w) return;
  const i = ui.focus.e, e = w.exercises[i], ex = e && exById(e.exId);
  const item = (id, icon, t, cls = "") => '<button class="item '+cls+'" data-m="'+id+'">'+icon+'<span class="grow t">'+esc(t)+'</span></button>';
  let b = '<label class="f"><span>Название тренировки</span><input type="text" id="wm-name" maxlength="60" value="'+esc(w.dayName)+'" placeholder="'+esc(autoTitle(w) || "Например, Грудь и спина")+'"></label>'
    + '<label class="f"><span>Дата</span><input type="date" id="wm-date" value="'+w.date+'" max="'+today()+'"></label>';
  if (e){
    b += '<h3>Упражнение · '+esc(ex ? ex.name : e.name)+'</h3><div class="menu">'
      + (ex ? item("editEx", I.settings, "Настройки упражнения") : '')
      + (isBarbell(ex) ? item("plates", I.plate, "Калькулятор блинов") : '')
      + (i > 0 ? item("up", I.up, "Переместить выше") : '')
      + (i < w.exercises.length - 1 ? item("down", I.down, "Переместить ниже") : '')
      + item("removeEx", I.x, "Убрать из тренировки", "danger")+'</div>';
  }
  b += '<h3>Тренировка</h3><div class="menu">'
    + (w.exercises.some(doneCount) ? item("report", I.report, "Итоги тренировки") : '')
    + (w.date !== today() && w.exercises.length ? item("repeat", I.repeat, "Повторить сегодня") : '')
    + item("finish", I.flag, "Готово")
    + item("deleteWorkout", I.trash, "Удалить тренировку")+'</div>';
  openSheet("Тренировка", b, root=>{
    const nm = root.querySelector("#wm-name");
    nm.addEventListener("change", ()=>{ w.dayName = nm.value.trim(); touchWorkout(w); hooks.render(); });
    root.querySelector("#wm-date").addEventListener("change", ev=>{
      const el = ev.target; if (!el.value) return;
      if (el.value > today()){ toast("Дата не может быть в будущем"); el.value = w.date; return; }
      w.date = el.value; touchWorkout(w); hooks.render(); toast("Дата изменена");
    });
    root.querySelector(".sheet").addEventListener("click", ev=>{
      const b2 = ev.target.closest("[data-m]"); if (!b2) return;
      const m = b2.dataset.m;
      if (nm.value.trim() !== (w.dayName || "")){ w.dayName = nm.value.trim(); touchWorkout(w); }
      closeSheet();
      if (m === "editEx") act("editEx", {id:ex.id});
      else if (m === "plates") act("plates");
      else if (m === "up") act("moveEx", {e:i, d:-1});
      else if (m === "down") act("moveEx", {e:i, d:1});
      else if (m === "removeEx") act("removeEx", {e:i});
      else if (m === "report") act("report", {id:w.id});
      else if (m === "repeat") act("repeat", {id:w.id});
      else act(m);
    });
  });
}

/* калькулятор блинов */
function platesSheet(){
  const w = curW(); const e = w && w.exercises[ui.focus.e]; const s = e && e.sets[curSetIdx(w, ui.focus.e)];
  const PL = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
  openSheet("Блины на штангу",
    '<div class="kv"><label class="f"><span>Общий вес, кг</span><input type="text" inputmode="decimal" id="pl-w" value="'+(s && s.weight !== "" ? numText(s.weight) : "")+'"></label>'
    + '<label class="f"><span>Гриф, кг</span><div class="seg" style="grid-template-columns:repeat(3,1fr)" id="pl-bar">'+[20, 15, 10].map(v=>'<button data-bar="'+v+'" aria-pressed="'+(prefs.bar === v)+'">'+v+'</button>').join("")+'</div></label></div>'
    + '<div id="pl-out"></div>',
    root=>{
      const draw = ()=>{
        const total = Number(toNum(root.querySelector("#pl-w").value)) || 0, bar = prefs.bar || 20;
        let side = (total - bar) / 2; const out = [];
        if (total > 0 && side >= 0){ for (const p of PL){ while (side >= p - 1e-9){ out.push(p); side = Math.round((side - p) * 1000) / 1000; } } }
        root.querySelector("#pl-out").innerHTML = total <= 0 ? '<p class="muted">Введи вес.</p>' : total < bar ? '<p class="muted">Вес меньше грифа.</p>'
          : '<div class="cap">На каждую сторону</div><div class="plates" aria-hidden="true"><span class="bar"></span>'+out.map(p=>'<span class="p" style="height:'+(40 + p * 3)+'px">'+numText(p)+'</span>').join("")+'</div>'
          + '<p style="margin:0;font-weight:800">'+(out.length ? out.map(numText).join(" + ")+' кг' : 'Только гриф')+'</p>'
          + (side > 0.001 ? '<p class="note">Остаток '+numText(side * 2)+' кг не набирается стандартными блинами.</p>' : '');
      };
      root.querySelector("#pl-w").addEventListener("input", draw);
      root.querySelector("#pl-bar").onclick = ev=>{ const b = ev.target.closest("[data-bar]"); if (!b) return; prefs.bar = +b.dataset.bar; savePrefs(); root.querySelectorAll("#pl-bar button").forEach(x=>x.setAttribute("aria-pressed", x === b)); draw(); };
      draw();
    });
}

Object.assign(actions, {
  focusEx: el=>{ ui.focus.e = +el.dataset.e; hooks.render(); },
  selSet: el=>{ const k = +el.dataset.s, i = ui.focus.e; const w = curW(); if (!w) return;
    ui.focus.s[i] = (curSetIdx(w, i) === k && ui.focus.s[i] === k) ? undefined : k; if (ui.focus.s[i] === undefined) delete ui.focus.s[i]; hooks.render(); },
  doneSet, undoSet: ()=>{ const w = curW(), i = ui.focus.e, j = curSetIdx(w, i), s = w.exercises[i].sets[j]; if (!s) return; s.done = false; touchWorkout(w); delete ui.focus.s[i]; hooks.render(); },
  editNum: el=>editNum(el.dataset.f),
  recWhy: el=>toast(el.dataset.why),
  stepPick: el=>stepPicker(el.dataset.f),
  workoutMenu, plates:platesSheet,
  /* ниже — действия v1 с той же логикой данных */
  /* цель — в текущий подход и в неотмеченные рабочие (самый большой вес); разминочные не трогаем */
  applyRec: el=>{ const w = curW(), i = +el.dataset.e, e = w.exercises[i], ex = exById(e.exId), rec = recommend(e.exId, w.id); if (!rec) return;
    const cur = e.sets[curSetIdx(w, i)], open = e.sets.filter(s=>!s.done), ws = open.filter(s=>s.weight !== "").map(s=>Number(s.weight));
    const top = ws.length ? (ex && ex.assisted ? Math.min(...ws) : Math.max(...ws)) : null;
    open.forEach(s=>{ if (s === cur || s.weight === "" || Number(s.weight) === top){ s.reps = rec.reps; s.weight = rec.weight; } });
    touchWorkout(w); hooks.render(); toast("Цель подставлена"); },
  addSet: el=>{ const w = curW(), i = +el.dataset.e, e = w.exercises[i]; const last = e.sets[e.sets.length-1]; const ex = exById(e.exId);
    e.sets.push(last ? {reps:last.reps, weight:last.weight, done:false} : {reps:parseRange(ex&&ex.reps)[0], weight:ex?ex.weight:"", done:false}); touchWorkout(w);
    ui.focus.e = i; ui.focus.s[i] = e.sets.length - 1; hooks.render(); },
  delSet: el=>{ const w = curW(), i = +el.dataset.e; w.exercises[i].sets.splice(+el.dataset.s,1); touchWorkout(w); delete ui.focus.s[i]; hooks.render(); },
  moveEx: el=>{ const w = curW(), i = +el.dataset.e, j = i + (+el.dataset.d); if (j<0||j>=w.exercises.length) return; [w.exercises[i], w.exercises[j]] = [w.exercises[j], w.exercises[i]]; touchWorkout(w); ui.focus.e = j; ui.focus.s = {}; hooks.render(); },
  removeEx: el=>{ const w = curW(), idx = +el.dataset.e, e = w.exercises[idx]; const go = ()=>{ w.exercises.splice(idx,1); touchWorkout(w); ui.focus.s = {}; ui.focus.e = Math.max(0, Math.min(ui.focus.e, w.exercises.length - 1)); hooks.render(); };
    if (e.sets.some(s=>s.done)) askConfirm("Убрать «"+e.name+"» из тренировки? Отмеченные подходы пропадут.", "Убрать", go); else go(); }
});
