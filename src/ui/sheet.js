/* Шторка, подтверждение, тост (поведение как в v1, новая подача). */
import { $, esc } from '../core/util.js';
import { I } from './icons.js';
import { sheetIn } from '../motion/motion.js';

const sheet = () => $("#sheet");
let lastFocus = null;
export function openSheet(title, body, mount){
  const el = sheet();
  lastFocus = document.activeElement;
  el.innerHTML = '<div class="sheet-bg" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="sheet-head"><div class="h2">'+esc(title)+'</div><button class="mini" data-close aria-label="Закрыть">'+I.x+'</button></div>'+body+'</div>';
  el.hidden = false;
  el.querySelectorAll("[data-close]").forEach(x=>x.onclick = closeSheet);
  sheetIn(el.querySelector(".sheet"), el.querySelector(".sheet-bg"));
  mount && mount(el);
}
export function closeSheet(){
  const el = sheet(); if (el.hidden) return;
  el.hidden = true; el.innerHTML = "";
  if (lastFocus && document.contains(lastFocus)) try{ lastFocus.focus({preventScroll:true}); }catch(e){}
}
export const sheetOpen = () => !sheet().hidden;
export function askConfirm(text, ok, cb){
  openSheet("Подтверди", '<p style="margin:0 0 16px">'+esc(text)+'</p><div class="row"><button class="btn sec grow" data-close>Отмена</button><button class="btn redfill grow" id="cf-ok">'+esc(ok)+'</button></div>', root=>{
    root.querySelectorAll("[data-close]").forEach(x=>x.onclick = closeSheet);
    root.querySelector("#cf-ok").onclick = ()=>{ closeSheet(); cb(); };
  });
}
let toastT = null;
export function toast(msg){
  let t = $(".toast");
  if (!t){ t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(()=>{ t.hidden = true; }, 2200);
}
document.addEventListener("keydown", e=>{ if (e.key === "Escape") closeSheet(); });
