/* Таймер отдыха: тонкое красное кольцо сужается; в последние 5 секунд — пульс раз в секунду.
   Живёт в постоянном доке над навигацией, не мешает вводу и переживает перерисовки экранов. */
import { $ } from '../core/util.js';
import { parseRange } from '../core/util.js';
import { ring } from './components.js';
import { I } from './icons.js';
import { setRing, pulse, reduced, gsap } from '../motion/motion.js';
import { haptic } from '../native/native.js';

const R = {end:0, total:0, timer:null, tween:null, left:-1};
export const restDefault = ex => { const lo = parseRange(ex && ex.reps)[0]; return lo <= 6 ? 180 : lo <= 12 ? 120 : 90; };
const fmt = s => Math.floor(s / 60)+":"+String(s % 60).padStart(2, "0");

export function startRest(seconds){
  stopRest(true);
  R.total = seconds; R.end = Date.now() + seconds * 1000; R.left = -1;
  const box = $("#rest");
  box.innerHTML = '<div class="rest" role="timer" aria-label="Отдых">'+ring(1, "", "", "")
    + '<div><span class="cap">Отдых</span><div class="time" aria-live="off">'+fmt(seconds)+'</div></div>'
    + '<button class="mini" data-rest="-15" aria-label="Минус 15 секунд">−15</button><button class="mini" data-rest="15" aria-label="Плюс 15 секунд">+15</button>'
    + '<button class="mini" data-rest="stop" aria-label="Пропустить отдых">'+I.x+'</button></div>';
  box.hidden = false;
  animateRing();
  R.timer = setInterval(tick, 250); tick();
  window.dispatchEvent(new Event("dockchange"));
}
function animateRing(){
  const el = $("#rest .ring"); if (!el) return;
  if (R.tween) R.tween.kill();
  const left = Math.max(0, (R.end - Date.now()) / 1000), p0 = left / R.total;
  if (reduced()){ setRing(el, p0); return; }
  const o = {p:p0};
  R.tween = gsap.to(o, {p:0, duration:left, ease:"none", onUpdate:()=>setRing(el, o.p)});
}
function tick(){
  const left = Math.max(0, Math.ceil((R.end - Date.now()) / 1000));
  if (left === R.left) return;
  R.left = left;
  const box = $("#rest .rest"); if (!box) return;
  box.querySelector(".time").textContent = fmt(left);
  if (reduced()) setRing(box.querySelector(".ring"), left / R.total);
  if (left <= 5 && left > 0){ box.classList.add("end"); pulse(box.querySelector(".ring"), 1.1); }
  if (left === 0){ haptic("heavy"); box.querySelector(".cap").textContent = "Пора"; setTimeout(()=>{ if (R.left === 0) stopRest(); }, 4000); clearInterval(R.timer); R.timer = null; }
}
export function stopRest(silent){
  clearInterval(R.timer); R.timer = null; if (R.tween){ R.tween.kill(); R.tween = null; }
  const box = $("#rest"); if (box){ box.innerHTML = ""; box.hidden = true; }
  R.end = 0; R.left = -1;
  if (!silent) window.dispatchEvent(new Event("dockchange"));
}
export function adjustRest(d){
  if (!R.end) return;
  R.end = Math.max(Date.now() + 1000, R.end + d * 1000);
  R.total = Math.max(R.total + d, 1, Math.ceil((R.end - Date.now()) / 1000));
  R.left = -1; $("#rest .rest")?.classList.remove("end");
  if (!R.timer) R.timer = setInterval(tick, 250);
  animateRing(); tick();
}
document.addEventListener("click", e=>{
  const b = e.target.closest("[data-rest]"); if (!b) return;
  const v = b.dataset.rest; if (v === "stop") stopRest(); else adjustRest(+v);
});
