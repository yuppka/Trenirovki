/* История тренировок: компактный список по месяцам, «+ Прошлая», повтор. */
import { S } from '../../core/store.js';
import { byRecent, doneCount } from '../../core/training.js';
import { esc, cap, fmtTitle, parseYmd, today, ymd } from '../../core/util.js';
import { topbar, tabLink, emptyState } from '../components.js';
import { I } from '../icons.js';
import { workoutTitle, plural, W_WORDS } from '../derive.js';

/* строка: дата слева, название и упражнения в одну строку, повтор — справа в той же строке */
export function workoutRow(w){
  let done = 0, total = 0; w.exercises.forEach(e=>{ total += e.sets.length; done += doneCount(e); });
  const d = parseYmd(w.date);
  const names = w.exercises.map(e=>e.name).slice(0, 3).join(", ") + (w.exercises.length > 3 ? " +"+(w.exercises.length - 3) : "");
  return '<div class="h-row" data-st><button class="item h-item" data-act="openWorkout" data-id="'+w.id+'" aria-label="'+esc(workoutTitle(w)+", "+fmtTitle(w.date))+'">'
    + '<span class="h-date"><b>'+d.getDate()+'</b><span>'+esc(d.toLocaleDateString("ru-RU", {weekday:"short"}))+'</span></span>'
    + '<span class="grow"><span class="t">'+esc(workoutTitle(w))+'</span><span class="s">'+esc(names || "Без упражнений")+(total ? ' · '+done+'/'+total : '')+'</span></span></button>'
    + (w.date !== today() && w.exercises.length ? '<button class="mini h-rep" data-act="repeat" data-id="'+w.id+'" aria-label="Повторить тренировку '+esc(fmtTitle(w.date))+' сегодня">'+I.repeat+'</button>' : '')+'</div>';
}

/* календарь за 16 недель: клетка — день (строки пн–вс), яркость — отмеченные подходы за день; день с тренировкой открывает её */
const CAL_WEEKS = 16, CAL_STEPS = [1, 10, 20, 30];
function calendar(){
  const t0 = parseYmd(today()), dow = (t0.getDay() + 6) % 7;
  const start = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() - dow - (CAL_WEEKS - 1) * 7), from = ymd(start);
  const days = new Map();
  S.workouts.forEach(w=>{ if (w.date < from || !w.exercises.length) return;
    const d = days.get(w.date) || {n:0, id:null, up:-1}; d.n += w.exercises.reduce((a, e)=>a + doneCount(e), 0);
    if ((w.updatedAt || 0) > d.up){ d.id = w.id; d.up = w.updatedAt || 0; } days.set(w.date, d); });
  const lvl = n => n <= 0 ? 0 : CAL_STEPS.filter(s=>n >= s).length;
  let cells = "", active = 0;
  for (let i = 0; i < CAL_WEEKS * 7; i++){
    const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), key = ymd(dt), d = days.get(key);
    if (key > today()){ cells += '<i class="cal-c fut"></i>'; continue; }
    const now = key === today() ? ' now' : '', lab = fmtTitle(key)+(d ? ": "+plural(d.n, ["подход","подхода","подходов"]) : "");
    if (d){ if (d.n > 0) active++; cells += '<button class="cal-c l'+lvl(d.n)+now+'" data-act="openWorkout" data-id="'+d.id+'" aria-label="'+esc(lab)+'" title="'+esc(lab)+'"></button>'; }
    else cells += '<i class="cal-c'+now+'" title="'+esc(fmtTitle(key))+'"></i>';
  }
  return '<section class="card cal-card"><div class="row" style="margin-bottom:10px"><h2 class="h2 grow">16 недель</h2><span class="muted small">'+plural(active, ["день","дня","дней"])+' с подходами</span></div>'
    + '<div class="cal"><div class="cal-wd" aria-hidden="true"><span>пн</span><span></span><span>ср</span><span></span><span>пт</span><span></span><span></span></div><div class="cal-grid">'+cells+'</div></div>'
    + '<div class="cal-legend" aria-hidden="true">меньше<i class="cal-c l0"></i><i class="cal-c l1"></i><i class="cal-c l2"></i><i class="cal-c l3"></i><i class="cal-c l4"></i>больше</div></section>';
}

export function viewHistory(){
  const ws = [...S.workouts].sort(byRecent);
  let h = topbar({title:"История", right:'<button class="btn sec small" data-act="addPast">+ Прошлая</button>'});
  if (!ws.length) return h + '<div class="card">'+emptyState("Записей пока нет", "Начни тренировку на главной или добавь прошлую — прогноз станет точнее быстрее.", '<button class="btn" data-act="start">Начать тренировку</button>')+'</div>';
  h += calendar();
  h += '<p class="muted small" style="margin:0 0 8px">'+I.repeat.replace('<svg','<svg style="width:14px;height:14px;vertical-align:-2px"')+' — повторить упражнения сегодня.</p>';
  /* группы по месяцам */
  const months = new Map();
  ws.forEach(w=>{ const k = w.date.slice(0, 7); if (!months.has(k)) months.set(k, []); months.get(k).push(w); });
  months.forEach((list, k)=>{
    const d = parseYmd(k+"-01"), y = d.getFullYear() !== new Date().getFullYear() ? " "+d.getFullYear() : "";
    h += '<h2 class="h-month cap">'+esc(cap(d.toLocaleDateString("ru-RU", {month:"long"}))+y)+'<span class="muted"> · '+plural(list.length, W_WORDS)+'</span></h2>' + list.map(workoutRow).join("");
  });
  return h;
}
