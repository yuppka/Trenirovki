/* Состояние, локальное хранение и облако claude.ai (логика без изменений из v1). */
import { STD, guessStd, guessAssisted, LIB_VERSION, LIB, SEED, LS_KEY } from './data.js';
import { hooks } from './hooks.js';
import { $, clone, toNum, parseRange, rangeText } from './util.js';
export function mergeLibrary(){
  if ((S.libVersion||0) >= LIB_VERSION) return false;
  const norm = t => t.toLowerCase().replace(/ё/g,"е").replace(/[^a-zа-я0-9]/g,"");
  const names = new Set(S.catalog.map(x=>norm(x.name))), stds = new Set(S.catalog.map(x=>x.std).filter(Boolean)), ids = new Set(S.catalog.map(x=>x.id));
  LIB.forEach(x=>{ if (ids.has(x.id) || names.has(norm(x.name)) || (x.std && stds.has(x.std))) return; S.catalog.push(normEx(x)); });
  S.libVersion = LIB_VERSION; return true;
}
/* ===== состояние ===== */
export function normEx(x){
  const seed = SEED.find(s=>s.id===x.id);
  return {id:String(x.id),name:String(x.name),group:x.group||"",equipment:x.equipment||(seed?seed.equipment:""),reps:rangeText(parseRange(x.reps)),weight:toNum(x.weight),comment:x.comment||"",
    std: seed && x.std === undefined ? seed.std : (STD[x.std] ? x.std : (!x.stdChecked && !seed ? guessStd(x.name) : "")),
    assisted: x.assisted !== undefined ? !!x.assisted : (seed ? !!seed.assisted : guessAssisted(x.name+" "+(x.equipment||""))),
    stdChecked: true};
}
export function blank(){ return {version:3, updatedAt:0, libVersion:0, catalog:SEED.map(normEx), workouts:[], profile:normProfile({}), bodyLog:[], deleted:[]}; }
export function valid(d){ return d && typeof d === "object" && Array.isArray(d.catalog) && Array.isArray(d.workouts); }
export function normWorkout(w){
  return {id:String(w.id),date:String(w.date),updatedAt:Number(w.updatedAt)||0,dayName:w.dayName||"",ai:w.ai&&w.ai.text?{text:String(w.ai.text),at:Number(w.ai.at)||0}:undefined,
    exercises:(Array.isArray(w.exercises)?w.exercises:[]).map(e=>({exId:e.exId||"",name:e.name||"Упражнение",sets:(Array.isArray(e.sets)?e.sets:[]).map(s=>({reps:toNum(s.reps),weight:toNum(s.weight),done:!!s.done}))}))};
}
export function normProfile(p){ p = p||{}; return {sex:p.sex==="m"||p.sex==="f"?p.sex:"", age:toNum(p.age), height:toNum(p.height), start:/^\d{4}-\d{2}$/.test(p.start||"")?p.start:"", returning:!!p.returning, freq:toNum(p.freq)}; }
export function normLog(l){ return (Array.isArray(l)?l:[]).filter(x=>x && x.date && toNum(x.weight)!=="").map(x=>({date:String(x.date),weight:toNum(x.weight)})).sort((a,b)=>a.date.localeCompare(b.date)); }
export function normalize(d){
  return {version:3, updatedAt:Number(d.updatedAt)||0, libVersion:Number(d.libVersion)||0,
    catalog:(d.catalog||[]).filter(x=>x && x.id && x.name).map(normEx),
    workouts:(d.workouts||[]).filter(w=>w && w.id && w.date).map(normWorkout),
    profile:normProfile(d.profile), bodyLog:normLog(d.bodyLog),
    deleted:Array.isArray(d.deleted)?d.deleted.map(String):[]};
}
export let hadLocal = false, localOk = true;
export function loadLocal(){
  try{ const raw = localStorage.getItem(LS_KEY); if (raw){ const d = JSON.parse(raw); if (valid(d)){ hadLocal = true; return normalize(d); } } }catch(e){ localOk = false; }
  return blank();
}
export let S = loadLocal();
export const setS = n => { S = n; };
export const dirty = {state:false, w:new Set()};
export function writeLocal(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); localOk = true; }catch(e){ localOk = false; } }
export function touchMeta(){ S.updatedAt = Date.now(); dirty.state = true; writeLocal(); scheduleFlush(); updateSync(); }
export function touchWorkout(w){ w.updatedAt = Date.now(); dirty.w.add(w.id); writeLocal(); scheduleFlush(); updateSync(); }

/* ===== облако: только внутри claude.ai; на обычном сайте пропускается ===== */
export const cloud = {db:null, uid:null, ok:false, state:"local", serverIds:new Set()};
export const stateRef = () => cloud.db.doc("data/users/" + cloud.uid + "/state");
export const wCol = () => stateRef().collection("workouts");
export function updateSync(){
  const el = $("#sync"); let t = "", err = false;
  if (!localOk && !cloud.ok){ t = "Не сохраняется"; err = true; }
  else if (cloud.state === "saving") t = "Сохраняю…";
  else if (cloud.state === "error"){ t = "Нет связи"; err = true; }
  el.textContent = t; el.classList.toggle("err", err);
}
export async function initCloud(){
  try{
    if (!window.claude || typeof window.claude.use !== "function") return;
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!db || !user) return;
    const id = await user.id(); if (!id) return;
    cloud.db = db; cloud.uid = id;
    const [snap, ws] = await Promise.all([stateRef().get(), wCol().get()]);
    let changed = false;
    if (snap.exists){
      const d = clone(snap.data()); const su = Number(d.updatedAt)||0;
      if (!hadLocal || su > S.updatedAt){ const n = normalize({catalog:d.catalog||[],workouts:[],profile:d.profile,bodyLog:d.bodyLog,libVersion:d.libVersion}); S.catalog = n.catalog; S.profile = n.profile; S.bodyLog = n.bodyLog; S.libVersion = n.libVersion; S.updatedAt = su; if (mergeLibrary()){ S.updatedAt = Date.now(); dirty.state = true; } changed = true; }
      else if (su < S.updatedAt) dirty.state = true;
    } else dirty.state = true;
    const del = new Set(S.deleted), local = new Map(S.workouts.map(w=>[w.id,w])), server = new Map();
    ws.docs.forEach(doc=>{
      cloud.serverIds.add(doc.id); const raw = clone(doc.data()); server.set(doc.id, raw);
      if (del.has(doc.id) || !raw.date) return;
      const l = local.get(doc.id);
      if (!l || (Number(raw.updatedAt)||0) > (l.updatedAt||0)){ local.set(doc.id, normWorkout(Object.assign({id:doc.id}, raw))); changed = true; }
    });
    local.forEach((w,wid)=>{ const s = server.get(wid); if (!s || (w.updatedAt||0) > (Number(s.updatedAt)||0)) dirty.w.add(wid); });
    S.workouts = [...local.values()]; S.deleted = S.deleted.filter(x=>cloud.serverIds.has(x));
    cloud.ok = true; cloud.state = "cloud"; writeLocal(); if (changed) hooks.render(); updateSync(); flush();
  }catch(e){ cloud.ok = false; cloud.state = "local"; updateSync(); }
}
export let flushTimer = null, flushing = false;
export function scheduleFlush(){ if (!cloud.ok) return; clearTimeout(flushTimer); flushTimer = setTimeout(flush, 700); }
export async function flush(){
  if (!cloud.ok || flushing) return;
  if (!dirty.state && !dirty.w.size && !S.deleted.length) return;
  flushing = true; cloud.state = "saving"; updateSync(); let failed = false;
  try{
    if (dirty.state){ dirty.state = false; try{ await stateRef().set({catalog:clone(S.catalog),profile:clone(S.profile),bodyLog:clone(S.bodyLog),libVersion:S.libVersion||0,updatedAt:S.updatedAt}); }catch(e){ dirty.state = true; failed = true; } }
    for (const wid of [...dirty.w]){ dirty.w.delete(wid); const w = S.workouts.find(x=>x.id===wid); if (!w) continue;
      try{ await wCol().doc(wid).set(clone(w)); cloud.serverIds.add(wid); }catch(e){ dirty.w.add(wid); failed = true; } }
    for (const wid of [...S.deleted]){ try{ await wCol().doc(wid).delete(); cloud.serverIds.delete(wid); S.deleted = S.deleted.filter(x=>x!==wid); }catch(e){ failed = true; } }
    writeLocal();
  } finally { flushing = false; cloud.state = failed ? "error" : "cloud"; updateSync(); if (failed) setTimeout(flush, 6000); else if (dirty.state || dirty.w.size) scheduleFlush(); }
}
