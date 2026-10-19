/* Каркас интерфейса: рендер экранов, переходы, общие действия и обработчики событий.
   Поведение действий — как в v1 (index.html), изменена только подача. */
import { S, touchMeta, touchWorkout, localOk } from '../core/store.js';
import { todayWorkout, newWorkout, addExerciseTo, repeatWorkout, removeWorkout, lastResult, doneCount } from '../core/training.js';
import { runAI } from '../core/ai.js';
import { $, esc, uid, toNum, fmtTitle, ymd, today, DAY } from '../core/util.js';
import { ui } from './state.js';
import { actions } from './actions.js';
import { openSheet, closeSheet, sheetOpen, toast, askConfirm } from './sheet.js';
import { errorState, skeletonLines } from './components.js';
import { I } from './icons.js';
import { MUSCLE_GROUPS, MUSCLES, musclesOf } from '../core/muscles.js';
import { plural, SET_WORDS } from './derive.js';
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
  /* в тренировке и итогах навигация скрыта: место — под ввод и главное действие, выход — кнопкой «Назад» */
  const focus = key === "workout" || key === "report";
  if (document.body.classList.contains("in-workout") !== focus){ document.body.classList.toggle("in-workout", focus); window.dispatchEvent(new Event("dockchange")); }
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

/* выбор упражнения для тренировки: группа → мышца → упражнение, поиск по всему каталогу (логика добавления — как в v1) */
function pickExercise(w){
  let q = "", g = "", m = "";
  const searchIco = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>';
  openSheet("Добавить упражнение",
    '<div class="search">'+searchIco+'<input type="search" id="pk-q" placeholder="Поиск по названию или мышце" aria-label="Поиск" enterkeyhint="search"></div>'
   +'<div id="pk-crumbs" class="pk-crumbs"></div><div id="pk-body"></div>'
   +'<button class="btn sec block" id="pk-new" style="margin:12px 0 4px">+ Новое упражнение</button>',
    root=>{
      const body = root.querySelector("#pk-body"), crumbs = root.querySelector("#pk-crumbs"), nb = root.querySelector("#pk-new"), qIn = root.querySelector("#pk-q");
      const norm = s => String(s || "").toLowerCase().replace(/ё/g, "е");
      const exRow = x=>{ const inW = w.exercises.some(e=>e.exId===x.id), l = lastResult(x.id, w.id), mu = MUSCLES[x.muscle];
        return '<button class="item" data-pick="'+x.id+'"><div class="grow"><div class="t">'+esc(x.name)+'</div><div class="s">'+esc((mu ? mu.group+" › "+mu.name : x.group || "Без мышцы")+(x.equipment ? " · "+x.equipment : ""))+(inW?' · уже в тренировке':'')+'</div>'+(l?'<div class="c">Последний раз '+esc(fmtTitle(l.date))+'</div>':'')+'</div><span style="font-size:24px;color:var(--accent-text);font-weight:800" aria-hidden="true">+</span></button>'; };
      const sorted = list => list.sort((a,b)=>a.name.localeCompare(b.name,"ru"));
      const empty = '<div class="state"><div class="h3">Ничего не найдено</div><div>Создай упражнение кнопкой ниже.</div></div>';
      const draw = ()=>{
        nb.textContent = q ? "+ Создать «"+qIn.value.trim()+"»" : m ? "+ Новое упражнение: "+MUSCLES[m].name.toLowerCase() : "+ Новое упражнение";
        if (q){
          crumbs.innerHTML = "";
          const items = sorted(S.catalog.filter(x=>norm(x.name).includes(q) || norm((MUSCLES[x.muscle] || {}).name).includes(q) || norm(x.group).includes(q)));
          body.innerHTML = items.length ? items.map(exRow).join("") : empty; return;
        }
        crumbs.innerHTML = g ? '<button class="mini" data-pk="back" aria-label="Назад">'+I.back+'</button><span class="grow"><span class="muted">'+esc(g)+'</span>'+(m ? ' › <b>'+esc(MUSCLES[m].name)+'</b>' : '')+'</span>' : '';
        if (!g){
          const un = S.catalog.filter(x=>!MUSCLES[x.muscle]);
          body.innerHTML = '<div class="pk-grid">'+MUSCLE_GROUPS.map(gr=>{ const n = S.catalog.filter(x=>MUSCLES[x.muscle] && MUSCLES[x.muscle].group === gr.name).length;
            return '<button class="pk-tile" data-pk="g" data-v="'+esc(gr.name)+'"><b>'+esc(gr.name)+'</b><span class="muted small">'+n+' упр.</span></button>'; }).join("")+'</div>'
            + (un.length ? '<h3>Без мышцы</h3>'+sorted(un).map(exRow).join("") : '');
        } else if (!m){
          body.innerHTML = musclesOf(g).map(id=>{ const n = S.catalog.filter(x=>x.muscle === id).length;
            return '<button class="item" data-pk="m" data-v="'+id+'"><div class="grow"><div class="t">'+esc(MUSCLES[id].name)+'</div><div class="s">'+esc(MUSCLES[id].where)+'</div><div class="c">'+n+' упр.</div></div>'+I.chev+'</button>'; }).join("");
        } else {
          const items = sorted(S.catalog.filter(x=>x.muscle === m));
          body.innerHTML = items.length ? items.map(exRow).join("") : empty;
        }
        body.scrollTop = 0;
      };
      draw();
      qIn.oninput = e=>{ q = norm(e.target.value.trim()); draw(); };
      const focusLast = ()=>{ ui.focus.e = w.exercises.length - 1; ui.focus.s = {}; };
      root.querySelector(".sheet").addEventListener("click", e=>{
        const nav = e.target.closest("[data-pk]");
        if (nav){ const k = nav.dataset.pk; if (k === "g"){ g = nav.dataset.v; m = ""; } else if (k === "m") m = nav.dataset.v; else if (k === "back"){ if (m) m = ""; else g = ""; } draw(); root.querySelector(".sheet").scrollTop = 0; return; }
        const b = e.target.closest("[data-pick]"); if (!b) return;
        addExerciseTo(w, b.dataset.pick); closeSheet(); focusLast(); render();
      });
      nb.onclick = ()=> exForm(null, {name:qIn.value.trim(), muscle:m}, ex=>{ addExerciseTo(w, ex.id); focusLast(); render(); });
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
  /* завершение: заполненные, но не отмеченные подходы не попадают в статистику — спрашиваем, что с ними сделать */
  finish: ()=>{
    const w = curW(); if (!w) return;
    const go = ()=>{ if (w.exercises.some(doneCount)){ ui.reportId = w.id; ui.workoutId = null; render(); window.scrollTo(0,0); } else actions.closeWorkout(); };
    const filled = s => !s.done && s.weight !== "" && Number(s.reps) > 0, n = w.exercises.reduce((a, e)=>a + e.sets.filter(filled).length, 0);
    if (!n){ go(); return; }
    openSheet("Завершить тренировку", '<p style="margin:0 0 16px">Не отмечено '+plural(n, SET_WORDS)+'. Если они сделаны — отметь, иначе в статистику и прогноз они не попадут.</p>'
      + '<div class="stack"><button class="btn block" id="fn-mark">Отметить и завершить</button><button class="btn sec block" id="fn-drop">Убрать их и завершить</button><button class="btn ghost block" data-close>Вернуться к тренировке</button></div>', root=>{
      root.querySelector("[data-close]").onclick = closeSheet;
      root.querySelector("#fn-mark").onclick = ()=>{ w.exercises.forEach(e=>e.sets.forEach(s=>{ if (filled(s)) s.done = true; })); touchWorkout(w); closeSheet(); go(); };
      root.querySelector("#fn-drop").onclick = ()=>{ w.exercises.forEach(e=>{ e.sets = e.sets.filter(s=>s.done); }); touchWorkout(w); closeSheet(); go(); };
    });
  },
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
  if (ui.tab === "catalog" && (ui.catMuscle || ui.catGroup)){ actions.catBack(); return true; }
  if (ui.tab !== "today"){ actions.tab({dataset:{tab:"today"}}); return true; }
  return false;
}
