/* История тренировок (как в v1: список, «+ Прошлая», повтор). */
import { S } from '../../core/store.js';
import { byRecent, doneCount } from '../../core/training.js';
import { esc, fmtTitle, fmtWeekday, today } from '../../core/util.js';
import { topbar, tabLink, art, emptyState } from '../components.js';
import { I } from '../icons.js';
import { workoutTitle, groupArt, mainGroup } from '../derive.js';

export function workoutRow(w){
  let done = 0, total = 0; w.exercises.forEach(e=>{ total += e.sets.length; done += doneCount(e); });
  const names = w.exercises.map(e=>e.name).slice(0,3).join(", ") + (w.exercises.length>3 ? " и ещё "+(w.exercises.length-3) : "");
  return '<div class="itemrow" data-st><button class="item w-card" data-act="openWorkout" data-id="'+w.id+'">'+art(groupArt(mainGroup(w)), "thumb")+'<div class="grow"><div class="cap">'+esc(fmtWeekday(w.date)+" · "+fmtTitle(w.date))+'</div><div class="t">'+esc(workoutTitle(w))+'</div><div class="s">'+esc(names || "Без упражнений")+'</div><div class="c">Подходов выполнено: '+done+' из '+total+'</div></div>'+I.chev+'</button>'
    + (w.date!==today() && w.exercises.length ? '<button class="mini" data-act="repeat" data-id="'+w.id+'" aria-label="Повторить тренировку '+esc(fmtTitle(w.date))+'">'+I.repeat+'</button>' : '')+'</div>';
}

export function viewHistory(){
  const ws = [...S.workouts].sort(byRecent);
  let h = topbar({plus:{act:"plus", label:"Тренировка"}, tabs:[tabLink("Главная", "today"), tabLink("История", "history", true)]});
  h += '<div class="section-head"><h1 class="h1 grow">История</h1><button class="btn sec small" data-act="addPast">+ Прошлая</button></div>';
  h += '<p class="muted small" style="margin:0 0 12px">Внеси прошлые тренировки с датами — прогноз станет точнее быстрее. '+I.repeat.replace('<svg','<svg style="width:14px;height:14px;vertical-align:-2px"')+' добавляет упражнения в сегодняшнюю тренировку.</p>';
  return h + (ws.length ? ws.map(workoutRow).join("") : '<div class="card">'+emptyState("Записей пока нет", "Начни тренировку на главной или добавь прошлую.", '<button class="btn" data-act="start">Начать тренировку</button>')+'</div>');
}
