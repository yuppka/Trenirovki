/* HTML-компоненты интерфейса. */
import { esc } from '../core/util.js';
import { LEVELS, lvName } from '../core/data.js';
import { I, star } from './icons.js';
import { ringTransforms } from '../motion/motion.js';

export { lvName };
export const lvColor = i => i < 0 ? "var(--lv0)" : "var(--lv"+i+")";
export const lvChip = lv => '<span class="lvl"><i style="background:'+lvColor(lv.idx)+'"></i>'+lvName(lv.idx)+'</span>';
export const nextLevelName = idx => idx < 4 ? LEVELS[idx + 1] : "";

/* ---------- арт с заглушкой той же формы ----------
   Ищет public/assets/<имя>; если файла нет — пробует .webp; если нет и его — тёмная заглушка.
   Ленивая загрузка, асинхронное декодирование; браузер и Service Worker кэшируют файлы. */
const BASE = import.meta.env.BASE_URL + "assets/";
const loaded = new Set(), missing = new Set(), resolved = new Map();
export function art(file, cls = "", alt = ""){
  const a11y = alt ? '' : ' aria-hidden="true"';
  if (!file || missing.has(file)) return '<div class="art missing '+cls+'"'+a11y+'></div>';
  const src = resolved.get(file) || BASE + file;
  const state = loaded.has(file) ? "loaded" : "loading";
  return '<div class="art '+state+' '+cls+'"'+a11y+'><img src="'+src+'" alt="'+esc(alt)+'" loading="lazy" decoding="async" data-file="'+esc(file)+'" draggable="false"></div>';
}
document.addEventListener("load", e=>{
  const img = e.target; if (!(img instanceof HTMLImageElement) || !img.dataset.file) return;
  loaded.add(img.dataset.file); resolved.set(img.dataset.file, img.getAttribute("src"));
  const a = img.parentElement; a.classList.remove("loading"); a.classList.add("loaded");
}, true);
document.addEventListener("error", e=>{
  const img = e.target; if (!(img instanceof HTMLImageElement) || !img.dataset.file) return;
  const f = img.dataset.file;
  if (!img.dataset.webp && !/\.webp$/i.test(f)){ img.dataset.webp = "1"; img.src = BASE + f.replace(/\.[a-z0-9]+$/i, ".webp"); return; }
  missing.add(f);
  const a = img.parentElement; a.classList.remove("loading"); a.classList.add("missing"); img.remove();
}, true);

/* ---------- кольцо ---------- */
export function ring(p, center = "", cls = "", label = ""){
  const t = ringTransforms(p);
  return '<div class="ring '+cls+'" data-p="'+p+'"'+(label ? ' role="img" aria-label="'+esc(label)+'"' : '')+'><div class="track"></div>'
    + '<div class="half r"><i style="transform:rotate('+t.r+'deg);opacity:'+t.ro+'"></i></div>'
    + '<div class="half l"><i style="transform:rotate('+t.l+'deg);opacity:'+t.lo+'"></i></div><div class="center">'+center+'</div></div>';
}

/* ---------- верхняя панель: круглая кнопка, красная «+», вкладки справа ---------- */
export function topbar({back = null, plus = null, tabs = []} = {}){
  const left = back
    ? '<button class="round" data-act="'+back+'" aria-label="Назад">'+I.back+'</button>'
    : '<button class="round" data-act="tab" data-tab="profile" aria-label="Профиль">'+I.profile+'</button>';
  const p = plus ? '<button class="plus" data-act="'+plus.act+'"'+(plus.attrs || '')+' aria-label="'+esc(plus.label)+'">'+I.plus+'</button>' : '';
  const t = tabs.map(x=>'<button class="tab" data-act="'+x.act+'"'+(x.attrs || '')+(x.current ? ' aria-current="page"' : '')+(x.disabled ? ' disabled' : '')+'>'+esc(x.label)+'</button>').join("");
  return '<header class="topbar">'+left+p+'<nav class="tabs" aria-label="Разделы экрана">'+t+'</nav></header>';
}
export const tabLink = (label, tab, current) => ({label, act:"tab", attrs:' data-tab="'+tab+'"', current});

/* ---------- состояния ---------- */
export const emptyState = (title, text = "", action = "") =>
  '<div class="state">'+star()+'<div class="h3">'+esc(title)+'</div>'+(text ? '<div>'+esc(text)+'</div>' : '')+action+'</div>';
export const errorState = (title, text = "", action = "") =>
  '<div class="state err" role="alert">'+star()+'<div class="h3">'+esc(title)+'</div>'+(text ? '<div>'+esc(text)+'</div>' : '')+action+'</div>';
export const skeletonScreen = () =>
  '<div aria-busy="true" aria-label="Загрузка"><div class="topbar"><div class="sk" style="width:44px;height:44px;border-radius:50%"></div><div class="sk" style="width:44px;height:44px;border-radius:14px"></div></div>'
  + '<div class="sk hero"></div><div class="sk line" style="width:40%;margin-top:28px"></div><div class="kv" style="margin-top:12px"><div class="sk card"></div><div class="sk card"></div></div><div class="sk card" style="margin-top:12px"></div></div>';
export const skeletonLines = (n = 3) => Array.from({length:n}, (_, i)=>'<div class="sk line" style="width:'+(92 - i * 14)+'%"></div>').join("");

export const metric = (label, value, unit = "", sub = "") =>
  '<div class="metric" data-st><div class="cap">'+esc(label)+'</div><div class="num">'+value+(unit ? '<small>'+esc(unit)+'</small>' : '')+'</div>'+(sub ? '<div class="sub">'+sub+'</div>' : '')+'</div>';
