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

/* тема: premium (тёмная, по умолчанию) | aero (светлая, Frutiger Aero). Выбор хранится в том же ключе, что в v1;
   старые значения переводятся: light → aero, dark/auto → premium. */
export const THEMES = ["premium", "aero"];
export function getTheme(){
  let v = "premium";
  try{ v = localStorage.getItem(LS_THEME) || "premium"; }catch(e){}
  if (v === "light") return "aero";
  return THEMES.includes(v) ? v : "premium";
}
const listeners = new Set();
export const onThemeChange = fn => listeners.add(fn);
export const isDark = () => document.documentElement.getAttribute("data-theme") !== "aero";
export function applyTheme(t){
  document.documentElement.setAttribute("data-theme", THEMES.includes(t) ? t : "premium");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isDark() ? "#000000" : "#CFEFFF");
  listeners.forEach(fn=>fn(isDark()));
}
export function setTheme(t){ try{ localStorage.setItem(LS_THEME, t); }catch(e){} applyTheme(t); }
