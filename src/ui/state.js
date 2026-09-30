/* Состояние интерфейса и настройки отображения.
   Настройки UI хранятся в отдельном ключе localStorage (wd.ui) — схема данных дневника (wd.data.v1) не меняется. */
import { LS_THEME } from '../core/data.js';

export const ui = {
  tab:"today", reportId:null, workoutId:null, returnTab:"today",
  catQuery:"", catGroup:"", progEx:null,
  focus:{wid:null, e:0, s:{}},   /* экран тренировки: текущее упражнение и выбранный подход по упражнениям */
  heroSlide:0
};

const LS_UI = "wd.ui";
const DEFAULT_PREFS = {lessFx:false, steps:{}, hidden:{}, bar:20, rest:{}};
function loadPrefs(){
  try{ const p = JSON.parse(localStorage.getItem(LS_UI) || "{}"); return Object.assign({}, DEFAULT_PREFS, p && typeof p === "object" ? p : {}); }
  catch(e){ return Object.assign({}, DEFAULT_PREFS); }
}
export const prefs = loadPrefs();
export function savePrefs(){ try{ localStorage.setItem(LS_UI, JSON.stringify(prefs)); }catch(e){} }

/* тема: auto (по системе) | light | dark; выбор сохраняется (ключ тот же, что в v1) */
export function getTheme(){ try{ return localStorage.getItem(LS_THEME) || "auto"; }catch(e){ return "auto"; } }
const listeners = new Set();
export const onThemeChange = fn => listeners.add(fn);
export function isDark(){
  const t = document.documentElement.getAttribute("data-theme");
  if (t) return t === "dark";
  return !window.matchMedia || !window.matchMedia("(prefers-color-scheme: light)").matches;
}
export function applyTheme(t){
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isDark() ? "#0A0B10" : "#F3F4F7");
  listeners.forEach(fn=>fn(isDark()));
}
export function setTheme(t){ try{ localStorage.setItem(LS_THEME, t); }catch(e){} applyTheme(t); }
if (window.matchMedia) window.matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", ()=>{ if (getTheme() === "auto") applyTheme("auto"); });
