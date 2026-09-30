/* Каркас интерфейса: рендер экранов, переходы, общие действия и обработчики событий.
   Поведение действий — как в v1 (index.html), изменена только подача. */
import { S, touchMeta, touchWorkout, localOk } from '../core/store.js';
import { todayWorkout, newWorkout, addExerciseTo, repeatWorkout, removeWorkout, lastResult, allGroups, doneCount } from '../core/training.js';
import { runAI } from '../core/ai.js';
import { $, esc, uid, toNum, fmtTitle, ymd, today, DAY } from '../core/util.js';
import { ui } from './state.js';
import { actions } from './actions.js';
import { openSheet, closeSheet, sheetOpen, toast, askConfirm } from './sheet.js';
import { errorState, skeletonLines } from './components.js';
import { viewToday, mountToday } from './views/home.js';
import { viewWorkout, workoutDock, mountWorkout, curW } from './views/workout.js';
import { viewReport } from './views/report.js';
import { viewProgress } from './views/progress.js';
import { viewHistory } from './views/history.js';
import { viewCatalog, renderCatList, exForm } from './views/catalog.js';
import { viewProfile, mountProfile, exportJson } from './views/profile.js';
import { screenIn, cascade } from '../motion/motion.js';
import { keepAwake } from '../native/native.js';

const main = $("#main");
const ORDER = {today:0, progress:1, history:2, catalog:3, profile:4, workout:5, report:6, error:7};
const VIEWS = {today:[viewToday, mountToday], progress:[viewProgress], history:[viewHistory], catalog:[viewCatalog], profile:[viewProfile, mountProfile]};
let lastKey = null;

export function render(){
  const top = ui.workoutId || ui.reportId ? null : ui.tab;
  document.querySelectorAll("#nav button").forEach(b=>{ if (b.dataset.tab === top) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
  let key, html, mount = null;
  try{
    if (ui.reportId && S.workouts.some(w=>w.id===ui.reportId)){ key = "report"; html = viewReport(); }
    else if (ui.workoutId && S.workouts.some(w=>w.id===ui.workoutId)){ key = "workout"; html = viewWorkout(); mount = mountWorkout; }
    else { ui.workoutId = null; ui.reportId = null; key = ui.tab; const v = VIEWS[ui.tab] || VIEWS.today; html = v[0](); mount = v[1] || null; }
  }catch(e){
    console.error(e); key = "error";
    html = '<div class="card" style="margin-top:24px">'+errorState("Не удалось показать экран", "Данные на месте. Попробуй ещё раз или сохрани резервную копию.", '<div class="stack" style="margin-top:14px"><button class="btn block" data-act="retry">Попробовать снова</button><button class="btn sec block" data-act="exportJson">Сохранить резервную копию</button></div>')+'</div>';
  }
  if (!localOk) html = '<div class="banner err" role="alert"><div class="txt">Данные не сохраняются на этом устройстве (хранилище недоступно). Сделай резервную копию в профиле.</div></div>' + html;
  main.innerHTML = html;
  $("#dock-action").innerHTML = key === "workout" ? workoutDock() : "";
  if (key === "catalog") renderCatList();
  try{ mount && mount(main); }catch(e){ console.error(e); }
  keepAwake(key === "workout");
  if (key !== lastKey){
    const dir = lastKey === null || ORDER[key] >= ORDER[lastKey] ? 1 : -1;
    lastKey = key;
    screenIn(main, dir); cascade(main);
  }
}

function openWorkout(id){ if (!ui.workoutId && !ui.reportId) ui.returnTab = ui.tab; ui.reportId = null; ui.workoutId = id; render(); window.scrollTo(0,0); }

/* выбор упражнения для тренировки (как в v1) */
function pickExercise(w){
  let q = "", g = "";
  openSheet("Добавить упражнение",
    '<div class="search">'+'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>'+'<input type="search" id="pk-q" placeholder="Поиск по названию" aria-label="Поиск" enterkeyhint="search"></div>'
   +'<div class="chips" style="margin-top:10px" id="pk-g"><button class="chip solid on" data-g="" aria-pressed="true">Все</button>'+allGroups().map(x=>'<button class="chip" data-g="'+esc(x)+'" aria-pressed="false">'+esc(x)+'</button>').join("")+'</div>'
   +'<button class="btn sec block" id="pk-new" style="margin:6px 0 12px">+ Новое упражнение</button><div id="pk-list"></div>',
    root=>{
      const list = root.querySelector("#pk-list"), nb = root.querySelector("#pk-new");
      const draw = ()=>{
        nb.textContent = q ? "+ Создать «"+root.querySelector("#pk-q").value.trim()+"»" : "+ Новое упражнение";
        const items = S.catalog.filter(x=>(!g||x.group===g)&&(!q||x.name.toLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name,"ru"));
        list.innerHTML = items.length ? items.map(x=>{ const inW = w.exercises.some(e=>e.exId===x.id); const l = lastResult(x.id, w.id);
          return '<button class="item" data-pick="'+x.id+'"><div class="grow"><div class="t">'+esc(x.name)+'</div><div class="s">'+esc(x.group)+(inW?' · уже в тренировке':'')+'</div>'+(l?'<div class="c">Последний раз '+esc(fmtTitle(l.date))+'</div>':'')+'</div><span style="font-size:24px;color:var(--accent-text);font-weight:800" aria-hidden="true">+</span></button>'; }).join("")
          : '<div class="state"><div class="h3">Ничего не найдено</div><div>Создай упражнение кнопкой выше.</div></div>';
      };
      draw();
      root.querySelector("#pk-q").oninput = e=>{ q = e.target.value.trim().toLowerCase(); draw(); };
      root.querySelector("#pk-g").onclick = e=>{ const b = e.target.closest("[data-g]"); if (!b) return; g = b.dataset.g; root.querySelectorAll("#pk-g .chip").forEach(c=>{ c.setAttribute("aria-pressed", c===b); c.classList.toggle("solid", c===b); c.classList.toggle("on", c===b); }); draw(); };
      const focusLast = ()=>{ ui.focus.e = w.exercises.length - 1; ui.focus.s = {}; };
      list.onclick = e=>{ const b = e.target.closest("[data-pick]"); if (!b) return; addExerciseTo(w, b.dataset.pick); closeSheet(); focusLast(); render(); };
      nb.onclick = ()=> exForm(null, {name:root.querySelector("#pk-q").value.trim(), group:g}, ex=>{ addExerciseTo(w, ex.id); focusLast(); render(); });
    });
}

Object.assign(actions, {
  noop: ()=>{},
  retry: ()=>render(),
  exportJson,
  tab: el=>{ ui.tab = el.dataset.tab; ui.workoutId = null; ui.reportId = null; if (ui.tab !== "progress") ui.progEx = null; render(); window.scrollTo(0,0); },
  plus: ()=>{ const cur = todayWorkout(); if (cur) openWorkout(cur.id); else actions.start(); },
  addPast: ()=>openSheet("Прошлая тренировка", '<label class="f"><span>Дата</span><input type="date" id="pp-d" max="'+today()+'" value="'+ymd(new Date(Date.now()-2*DAY))+'"></label><button class="btn block" id="pp-go">Создать и добавить упражнения</button>', root=>{
    root.querySelector("#pp-go").onclick = ()=>{ const d = root.querySelector("#pp-d").value; if (!d || d > today()){ toast("Выбери дату не позже сегодня"); return; }
      const w = {id:uid(), date:d, updatedAt:0, dayName:"", exercises:[]}; S.workouts.push(w); touchWorkout(w); closeSheet(); openWorkout(w.id); pickExercise(w); };
  }),
  start: ()=>{ const w = todayWorkout() || newWorkout(); openWorkout(w.id); pickExercise(w); },
  repeat: el=>{ const src = S.workouts.find(x=>x.id===el.dataset.id); if (!src) return; const w = repeatWorkout(src); ui.workoutId = null; openWorkout(w.id); },
  openWorkout: el=>openWorkout(el.dataset.id),
  closeWorkout: ()=>{ ui.workoutId = null; ui.reportId = null; ui.tab = ui.returnTab; render(); window.scrollTo(0,0); },
  finish: ()=>{ const w = curW(); if (w && w.exercises.some(doneCount)){ ui.reportId = w.id; ui.workoutId = null; render(); window.scrollTo(0,0); } else actions.closeWorkout(); },
  report: el=>{ ui.reportId = el.dataset.id; ui.workoutId = null; render(); window.scrollTo(0,0); },
  reportBack: ()=>{ const id = ui.reportId; ui.reportId = null; ui.workoutId = id; render(); window.scrollTo(0,0); },
  reportDone: ()=>{ ui.reportId = null; ui.workoutId = null; ui.tab = ui.returnTab; render(); window.scrollTo(0,0); },
  aiRun: el=>{ const w = S.workouts.find(x=>x.id===el.dataset.id); if (!w) return; const out = $("#ai-out"); runAI(w, out, el); out.innerHTML = skeletonLines(4)+'<span class="sr">Думаю…</span>'; },
  deleteWorkout: ()=>{ const w = curW(); askConfirm("Удалить тренировку "+fmtTitle(w.date)+"?", "Удалить", ()=>{ removeWorkout(w.id); ui.workoutId = null; ui.tab = ui.returnTab; render(); toast("Тренировка удалена"); }); },
  addEx: ()=>pickExercise(curW()),
  progEx: el=>{ const moved = ui.tab !== "progress" || ui.workoutId || ui.reportId; ui.progEx = el.dataset.id; ui.tab = "progress"; ui.workoutId = null; ui.reportId = null; render(); if (moved) window.scrollTo(0,0); }
});

/* ---------- события ---------- */
document.addEventListener("click", e=>{
  const nav = e.target.closest("#nav button[data-tab]"); if (nav){ actions.tab(nav); return; }
  const sx = e.target.closest("#pf-sex [data-sex]"); if (sx){ S.profile.sex = sx.dataset.sex; touchMeta(); render(); return; }
  const el = e.target.closest("[data-act]"); if (!el || $("#sheet").contains(el) || el.disabled) return;
  const f = actions[el.dataset.act]; if (f) f(el);
});
main.addEventListener("input", e=>{
  const el = e.target;
  if (el.id === "catq"){ ui.catQuery = el.value; renderCatList(); }
});
main.addEventListener("change", e=>{
  const el = e.target;
  if (el.dataset.in === "pf"){ S.profile[el.dataset.k] = el.dataset.k === "start" ? el.value : toNum(el.value); touchMeta(); render(); }
  if (el.id === "pf-ret"){ S.profile.returning = el.checked; touchMeta(); }
});
main.addEventListener("keydown", e=>{ if (e.target.id === "bw-in" && e.key === "Enter") actions.addBW(); });

/* клавиатура открыта → прячем навигацию и док, чтобы не перекрывали поля */
if (window.visualViewport){
  const vv = window.visualViewport;
  const onVV = ()=>{ document.body.classList.toggle("kb", window.innerHeight - vv.height > 150); };
  vv.addEventListener("resize", onVV);
}
document.addEventListener("focusin", e=>{
  const el = e.target;
  if (el.matches && el.matches("input:not([type=checkbox]):not([type=file]),textarea,select") && !el.closest(".sheet"))
    setTimeout(()=>{ const r = el.getBoundingClientRect(), vh = window.visualViewport ? window.visualViewport.height : window.innerHeight; if (r.bottom > vh - 24 || r.top < 60) el.scrollIntoView({block:"center"}); }, 320);
});

/* высота дока → отступ снизу у контента */
const dock = $("#dock");
const setDockH = ()=>document.documentElement.style.setProperty("--dock-h", (dock.offsetHeight ? dock.offsetHeight + 10 : 0)+"px");
if (window.ResizeObserver) new ResizeObserver(setDockH).observe(dock);
window.addEventListener("dockchange", setDockH);

/* «Назад» на Android */
export function handleBack(){
  if (sheetOpen()){ closeSheet(); return true; }
  if (ui.reportId){ actions.reportBack(); return true; }
  if (ui.workoutId){ actions.closeWorkout(); return true; }
  if (ui.tab !== "today"){ actions.tab({dataset:{tab:"today"}}); return true; }
  return false;
}
