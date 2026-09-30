/* Производные данные для экранов. Только отображение: используют существующие функции
   расчёта (sessionsFor, levelOf, standardsFor, lastResult) и не меняют ни данных, ни формул. */
import { S } from '../core/store.js';
import { exById, byRecent } from '../core/training.js';
import { sessionsFor, standardsFor, levelOf } from '../core/calc.js';
import { lastResult } from '../core/training.js';
import { parseYmd } from '../core/util.js';
import { prefs } from './state.js';

export const plural = (n, f) => { const a = Math.abs(n) % 10, b = Math.abs(n) % 100; return n+" "+(a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? f[1] : f[2]); };
export const EX_WORDS = ["упражнение","упражнения","упражнений"], SET_WORDS = ["подход","подхода","подходов"], W_WORDS = ["тренировка","тренировки","тренировок"];

/* автоназвание тренировки по группам мышц: «Грудь и спина» */
export function autoTitle(w){
  const cnt = new Map();
  w.exercises.forEach(e=>{ const ex = exById(e.exId); const g = ex && ex.group; if (g) cnt.set(g, (cnt.get(g) || 0) + Math.max(1, e.sets.length)); });
  const gs = [...cnt.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 3).map(([g], i)=> i ? g.toLowerCase() : g);
  if (!gs.length) return "";
  return gs.length === 1 ? gs[0] : gs.slice(0, -1).join(", ") + " и " + gs[gs.length - 1];
}
export const workoutTitle = w => (w.dayName || "").trim() || autoTitle(w) || "Тренировка";
export const setsTotal = w => w.exercises.reduce((a, e)=>a + e.sets.length, 0);

/* общий ранг: медиана уровней по упражнениям с эталоном (последний 1ПМ, как в профиле) */
export function overallRank(){
  const vals = [];
  S.catalog.forEach(ex=>{
    const st = standardsFor(ex); if (!st) return;
    const pts = sessionsFor(ex.id); if (!pts.length) return;
    const lv = levelOf(pts[pts.length - 1].e, st);
    vals.push(lv.idx === 4 ? 5 : lv.idx + lv.frac);
  });
  if (!vals.length) return null;
  vals.sort((a,b)=>a-b);
  const k = vals.length, m = k % 2 ? vals[(k - 1) / 2] : (vals[k / 2 - 1] + vals[k / 2]) / 2;
  const idx = Math.max(-1, Math.min(4, Math.floor(m)));
  return {idx, p:idx === 4 ? 1 : Math.max(0, Math.min(1, m - idx)), n:k};
}

/* рекорды: сессии, где 1ПМ (или помощь гравитрона) превзошли все прошлые */
export function recordEvents(limit = 3){
  const ev = [];
  S.catalog.forEach(ex=>{
    const pts = sessionsFor(ex.id); if (pts.length < 2) return;
    if (ex.assisted){ let best = pts[0].minW; for (let i = 1; i < pts.length; i++) if (pts[i].minW < best - 0.01){ ev.push({ex, p:pts[i], assisted:true}); best = pts[i].minW; } }
    else { let best = pts[0].e; for (let i = 1; i < pts.length; i++) if (pts[i].e > best + 0.05){ ev.push({ex, p:pts[i]}); best = pts[i].e; } }
  });
  return ev.sort((a,b)=>b.p.t - a.p.t).slice(0, limit);
}

/* недавние упражнения (скрытые кнопкой «×» возвращаются, когда упражнение снова делают) */
export function recentExercises(limit = 4){
  const out = [], seen = new Set();
  for (const w of [...S.workouts].sort(byRecent)){
    const ts = Math.max(w.updatedAt || 0, parseYmd(w.date).getTime());
    for (const e of w.exercises){
      if (!e.exId || seen.has(e.exId) || !e.sets.length) continue;
      const ex = exById(e.exId); if (!ex) continue;
      seen.add(e.exId);
      if ((prefs.hidden[e.exId] || 0) >= ts) continue;
      out.push(ex);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/* рабочий вес: последний раз (макс. вес, у гравитрона — мин. помощь), иначе стартовый из каталога */
export function workingWeight(ex){
  const last = lastResult(ex.id);
  const ws = last ? last.sets.map(s=>s.weight).filter(v=>v !== "" && v != null).map(Number) : [];
  if (ws.length) return ex.assisted ? Math.min(...ws) : Math.max(...ws);
  return ex.weight === "" ? null : ex.weight;
}

/* арты: имена файлов в public/assets/ (замена файла не требует правок кода) */
const GROUP_ART = {"Грудь":"muscle-chest.jpg","Спина":"muscle-back.jpg","Плечи":"muscle-shoulders.jpg","Бицепс":"muscle-arms.jpg","Трицепс":"muscle-arms.jpg","Руки":"muscle-arms.jpg","Ноги":"muscle-legs.jpg","Пресс":"muscle-core.jpg","Кор":"muscle-core.jpg","Многосуставные":"muscle-full.jpg"};
export const groupArt = g => GROUP_ART[g] || null;
export const RANK_ART = ["rank-rookie.png","rank-start.png","rank-iron.png","rank-steel.png","rank-titan.png","rank-legend.png"];
export const rankArt = idx => RANK_ART[Math.max(-1, Math.min(4, idx)) + 1];
export function mainGroup(w){
  const cnt = new Map();
  w.exercises.forEach(e=>{ const ex = exById(e.exId); const g = ex && ex.group; if (g) cnt.set(g, (cnt.get(g) || 0) + 1); });
  return [...cnt.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || "";
}
