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
   Порядок поиска: вырезка public/assets/cutouts/<имя>.png (если просили cut) → исходный файл → .webp → тёмная заглушка.
   Ленивая загрузка, асинхронное декодирование; браузер и Service Worker кэшируют файлы. */
const BASE = import.meta.env.BASE_URL + "assets/";
const loaded = new Set(), missing = new Set(), resolved = new Map();
const cutName = f => "cutouts/" + f.replace(/\.[a-z0-9]+$/i, ".png");
export function art(file, cls = "", alt = "", o = {}){
  const a11y = alt ? '' : ' aria-hidden="true"';
  if (!file) return '<div class="art missing '+cls+'"'+a11y+'></div>';
  const chain = (o.cut ? [cutName(file), file] : [file]).filter(f=>!missing.has(f));
  if (!chain.length) return '<div class="art missing '+cls+'"'+a11y+'></div>';
  const key = chain[0], src = resolved.get(key) || BASE + key;
  const state = loaded.has(key) ? "loaded" : "loading", isCut = key.startsWith("cutouts/") ? " is-cut" : "";
  return '<div class="art '+state+isCut+' '+cls+'"'+a11y+'><img src="'+src+'" alt="'+esc(alt)+'" loading="lazy" decoding="async" data-file="'+esc(key)+'" data-chain="'+esc(chain.slice(1).join("|"))+'" draggable="false"></div>';
}
document.addEventListener("load", e=>{
  const img = e.target; if (!(img instanceof HTMLImageElement) || !img.dataset.file) return;
  loaded.add(img.dataset.file); resolved.set(img.dataset.file, img.getAttribute("src"));
  const a = img.parentElement; a.classList.remove("loading"); a.classList.add("loaded");
  a.classList.toggle("is-cut", img.dataset.file.startsWith("cutouts/"));
}, true);
document.addEventListener("error", e=>{
  const img = e.target; if (!(img instanceof HTMLImageElement) || !img.dataset.file) return;
  const f = img.dataset.file;
  if (!img.dataset.webp && !/\.webp$/i.test(f) && !f.startsWith("cutouts/")){ img.dataset.webp = "1"; img.src = BASE + f.replace(/\.[a-z0-9]+$/i, ".webp"); return; }
  missing.add(f);
  const rest = (img.dataset.chain || "").split("|").filter(Boolean);
  if (rest.length){ img.dataset.file = rest[0]; img.dataset.chain = rest.slice(1).join("|"); delete img.dataset.webp; img.parentElement.classList.remove("is-cut"); img.src = BASE + rest[0]; return; }
  const a = img.parentElement; a.classList.remove("loading", "is-cut"); a.classList.add("missing"); img.remove();
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
