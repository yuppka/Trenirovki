/* История тренировок: компактный список по месяцам, «+ Прошлая», повтор. */
import { S } from '../../core/store.js';
import { byRecent, doneCount } from '../../core/training.js';
import { esc, cap, fmtTitle, parseYmd, today } from '../../core/util.js';
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

export function viewHistory(){
  const ws = [...S.workouts].sort(byRecent);
  let h = topbar({plus:{act:"plus", label:"Тренировка"}, tabs:[tabLink("Главная", "today"), tabLink("История", "history", true)]});
  h += '<div class="section-head"><h1 class="h1 grow">История</h1><button class="btn sec small" data-act="addPast">+ Прошлая</button></div>';
  if (!ws.length) return h + '<div class="card">'+emptyState("Записей пока нет", "Начни тренировку на главной или добавь прошлую — прогноз станет точнее быстрее.", '<button class="btn" data-act="start">Начать тренировку</button>')+'</div>';
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
