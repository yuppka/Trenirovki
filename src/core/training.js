/* Тренировки (без изменений из v1). */
import { DEFAULT_SETS, GROUPS } from './data.js';
import { S, dirty, writeLocal, touchWorkout, scheduleFlush } from './store.js';
import { hooks } from './hooks.js';
import { uid, today, parseRange } from './util.js';
/* ===== тренировки ===== */
export const exById = id => S.catalog.find(x=>x.id===id);
export const byRecent = (a,b) => b.date.localeCompare(a.date) || (b.updatedAt-a.updatedAt);
export const todayWorkout = () => S.workouts.filter(w=>w.date===today()).sort(byRecent)[0] || null;
export function lastResult(exId, exceptId){
  for (const w of S.workouts.filter(w=>w.id!==exceptId).sort(byRecent)){ const e = w.exercises.find(x=>x.exId===exId && x.sets.length); if (e) return {date:w.date, sets:e.sets}; }
  return null;
}
export function fillSets(exId, exceptId){
  const last = lastResult(exId, exceptId);
  if (last) return last.sets.map(s=>({reps:s.reps, weight:s.weight, done:false}));
  const ex = exById(exId), r = parseRange(ex && ex.reps);
  return Array.from({length:DEFAULT_SETS},()=>({reps:r[0], weight:ex && ex.weight!=="" ? ex.weight : "", done:false}));
}
export function newWorkout(){ const w = {id:uid(), date:today(), updatedAt:0, dayName:"", exercises:[]}; S.workouts.push(w); touchWorkout(w); return w; }
export function addExerciseTo(w, exId){ const ex = exById(exId); if (!ex) return; w.exercises.push({exId, name:ex.name, sets:fillSets(exId, w.id)}); touchWorkout(w); }
export function repeatWorkout(src){
  let w = todayWorkout();
  if (w && w.id === src.id){ hooks.toast("Это и есть сегодняшняя тренировка"); return w; }
  if (!w) w = newWorkout();
  let added = 0;
  src.exercises.forEach(e=>{
    if (w.exercises.some(x=>x.exId && x.exId===e.exId)) return;
    const ok = e.exId && exById(e.exId);
    w.exercises.push({exId:e.exId, name:ok ? exById(e.exId).name : e.name, sets: ok ? fillSets(e.exId, w.id) : e.sets.map(s=>({reps:s.reps,weight:s.weight,done:false}))}); added++;
  });
  touchWorkout(w); hooks.toast(added ? "Добавлено упражнений: "+added : "Все упражнения уже в тренировке"); return w;
}
export function removeWorkout(id){ S.workouts = S.workouts.filter(w=>w.id!==id); dirty.w.delete(id); if (!S.deleted.includes(id)) S.deleted.push(id); writeLocal(); scheduleFlush(); }
export const doneCount = e => e.sets.filter(s=>s.done).length;
export const allGroups = () => [...new Set([...GROUPS, ...S.catalog.map(x=>x.group).filter(Boolean)])];
