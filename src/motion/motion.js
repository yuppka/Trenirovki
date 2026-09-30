/* Анимации интерфейса на GSAP.
   Правила: анимируются только transform и opacity; во время ввода ≤ 300 мс; слои эффектов
   не перехватывают касания (pointer-events:none), поэтому ввод никогда не блокируется.
   «Меньше эффектов» или системное reduce motion → мгновенная смена или fade 120 мс. */
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { prefs } from '../ui/state.js';
import { I } from '../ui/icons.js';

gsap.registerPlugin(CustomEase);

const root = document.documentElement;
const css = n => getComputedStyle(root).getPropertyValue(n).trim();
const sec = n => { const v = css(n); return v.endsWith("ms") ? parseFloat(v)/1000 : parseFloat(v) || 0; };
export const T = {};
const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : {matches:false, addEventListener(){}};

export const reduced = () => !!prefs.lessFx || mq.matches;

export function initMotion(){
  Object.assign(T, {
    fade:sec("--dur-fade"), digit:sec("--dur-digit"), set:sec("--dur-set"), input:sec("--dur-input"),
    screen:sec("--dur-screen"), rank:sec("--dur-rank"), record:sec("--dur-record"), freeze:sec("--dur-freeze"),
    stagger:sec("--dur-stagger") || sec("--stagger"), staggerMax:parseInt(css("--stagger-max"),10) || 8, shift:parseFloat(css("--shift")) || 24
  });
  const m = css("--ease").match(/cubic-bezier\(([^)]+)\)/);
  CustomEase.create("ui", m ? m[1] : ".2,.8,.2,1");
  gsap.defaults({ease:"ui", overwrite:"auto"});
  applyLessFx();
  mq.addEventListener?.("change", applyLessFx);
}
export function applyLessFx(){ root.classList.toggle("less-fx", reduced()); }

/* ---------- кольцо прогресса (две половины, только rotate) ---------- */
export function ringTransforms(p){
  const deg = Math.max(0, Math.min(1, p || 0)) * 360, a = Math.min(180, deg), b = Math.max(0, deg - 180);
  return {r:45 + a - 180, l:45 + b - 180, ro:deg > 0 ? 1 : 0, lo:b > 0 ? 1 : 0};
}
export function setRing(el, p){
  if (!el) return;
  const t = ringTransforms(p), r = el.querySelector(".half.r i"), l = el.querySelector(".half.l i");
  r.style.transform = "rotate("+t.r+"deg)"; r.style.opacity = t.ro;
  l.style.transform = "rotate("+t.l+"deg)"; l.style.opacity = t.lo;
  el.dataset.p = p;
}

/* ---------- переходы между экранами: сдвиг 24 px + лёгкое размытие фона, 300 мс ---------- */
let veil = null;
export function screenIn(el, dir){
  gsap.killTweensOf(el);
  if (reduced()){ gsap.fromTo(el, {opacity:0}, {opacity:1, duration:T.fade, ease:"none", clearProps:"opacity"}); return; }
  if (!veil){ veil = document.createElement("div"); veil.className = "fx-veil"; document.body.appendChild(veil); }
  gsap.fromTo(veil, {opacity:1}, {opacity:0, duration:T.screen, ease:"ui"});
  gsap.fromTo(el, {x:(dir || 1) * T.shift, opacity:0}, {x:0, opacity:1, duration:T.screen, clearProps:"transform,opacity"});
}

/* ---------- каскад списков: 40 мс на элемент, максимум 8 ---------- */
export function cascade(container){
  if (!container || reduced()) return;
  const items = [...container.querySelectorAll("[data-st]")].slice(0, T.staggerMax);
  if (!items.length) return;
  gsap.fromTo(items, {y:12, opacity:0}, {y:0, opacity:1, duration:T.input, stagger:T.stagger, clearProps:"transform,opacity"});
}

/* ---------- смена числа: вертикальная прокрутка цифр, 180 мс ---------- */
const digitHTML = c => '<span class="d"><span>'+c+'</span></span>';
export function setDigits(el, text, animate){
  const old = el.dataset.v;
  el.dataset.v = text;
  el.classList.toggle("long", text.length === 4);
  el.classList.toggle("xlong", text.length >= 5);
  if (!animate || reduced() || old === undefined || old === text){ el.innerHTML = [...text].map(digitHTML).join(""); return; }
  const num = s => parseFloat(String(s).replace(",", ".")) || 0;
  const dir = num(text) >= num(old) ? 1 : -1;
  const a = [...text], b = [...old], n = a.length, m = b.length;
  el.innerHTML = a.map((c, i)=>{ const oc = b[m - n + i]; return oc !== undefined && oc !== c ? '<span class="d"><span class="n">'+c+'</span><span class="o">'+oc+'</span></span>' : digitHTML(c); }).join("");
  const ns = el.querySelectorAll(".n"), os = el.querySelectorAll(".o");
  if (!ns.length) return;
  gsap.fromTo(ns, {yPercent:dir * 100}, {yPercent:0, duration:T.digit, clearProps:"transform"});
  gsap.fromTo(os, {yPercent:0, opacity:1}, {yPercent:-dir * 100, opacity:0, duration:T.digit, onComplete:()=>os.forEach(o=>o.remove())});
}

/* ---------- «Подход выполнен»: вспышка обводки строки + пульс кнопки, 250 мс ---------- */
export function setDoneFx(row, btn){
  if (reduced()) return;
  const flash = row && row.querySelector(".flash");
  if (flash) gsap.fromTo(flash, {opacity:1}, {opacity:0, duration:T.set, ease:"none"});
  if (btn) gsap.fromTo(btn, {scale:1}, {scale:1.04, duration:T.set / 2, yoyo:true, repeat:1, ease:"ui", clearProps:"transform"});
}
export function pulse(el, amount = 1.08){
  if (!el || reduced()) return;
  gsap.fromTo(el, {scale:1}, {scale:amount, duration:.15, yoyo:true, repeat:1, ease:"ui", clearProps:"transform"});
}

/* слой для эффектов поверх интерфейса; касание пропускает эффект, но событие не перехватывается */
function fxLayer(){ let l = document.querySelector(".fx-layer"); if (!l){ l = document.createElement("div"); l.className = "fx-layer"; l.setAttribute("aria-hidden", "true"); document.body.appendChild(l); } return l; }
function skippable(tl, cleanup){
  const skip = ()=>{ tl.progress(1); };
  document.addEventListener("pointerdown", skip, {capture:true, once:true, passive:true});
  tl.eventCallback("onComplete", ()=>{ document.removeEventListener("pointerdown", skip, {capture:true}); cleanup && cleanup(); });
}

/* ---------- новый рекорд: заморозка 100 мс, свечение от числа, вспышка звезды; ≤ 1 с, пропуск тапом ---------- */
export function recordFx(anchor){
  if (!anchor || reduced()) return;
  const r = anchor.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, layer = fxLayer();
  const glow = document.createElement("div"); glow.className = "fx-glow";
  const st = document.createElement("div"); st.className = "fx-star"; st.innerHTML = I.star;
  [glow, st].forEach(el=>{ el.style.left = x+"px"; el.style.top = y+"px"; layer.appendChild(el); });
  const tl = gsap.timeline({delay:T.freeze});
  tl.fromTo(anchor, {scale:1}, {scale:1.07, duration:.12, yoyo:true, repeat:1, clearProps:"transform"}, 0)
    .fromTo(glow, {scale:.2, opacity:.95}, {scale:2.6, opacity:0, duration:.6}, 0)
    .fromTo(st, {scale:0, rotation:-45, opacity:1}, {scale:1.15, rotation:0, duration:.28}, .04)
    .to(st, {scale:.2, opacity:0, duration:.3, ease:"power2.in"}, .5);
  skippable(tl, ()=>{ glow.remove(); st.remove(); });
}

/* ---------- повышение ранга: кольцо дозаполняется, световая волна, кроссфейд арта; 900 мс ---------- */
export function rankUpFx({card, ring, from = 0, to = 0, artOld, artNew, onDone}){
  if (reduced()){
    setRing(ring, to);
    if (artOld) artOld.style.opacity = 0;
    if (artNew) artNew.style.opacity = 1;
    if (card) gsap.fromTo(card, {opacity:0}, {opacity:1, duration:T.fade, ease:"none"});
    onDone && setTimeout(onDone, 1600);
    return;
  }
  const d = T.rank, o = {p:from}, layer = fxLayer();
  const wave = document.createElement("div"); wave.className = "fx-wave";
  const r = card.getBoundingClientRect();
  Object.assign(wave.style, {left:r.left+"px", top:r.top+"px", width:r.width+"px", height:r.height+"px"});
  layer.appendChild(wave);
  const tl = gsap.timeline();
  tl.fromTo(card, {y:16, opacity:0}, {y:0, opacity:1, duration:d * .25}, 0)
    .to(o, {p:1, duration:d * .45, onUpdate:()=>setRing(ring, o.p)}, 0)
    .fromTo(wave, {scale:1, opacity:.85}, {scale:1.22, opacity:0, duration:d * .6}, d * .35);
  if (artNew) tl.fromTo(artNew, {opacity:0}, {opacity:1, duration:d * .4}, d * .4);
  if (artOld) tl.to(artOld, {opacity:0, duration:d * .4}, d * .4);
  tl.set(o, {p:0}, d * .6).to(o, {p:to, duration:d * .3, onUpdate:()=>setRing(ring, o.p)}, d * .6)
    .to(card, {opacity:0, y:8, duration:.2}, d + 1.1);
  skippable(tl, ()=>{ wave.remove(); onDone && onDone(); });
}

/* ---------- шторка ---------- */
export function sheetIn(sheet, bg){
  if (reduced()){ gsap.fromTo([sheet, bg], {opacity:0}, {opacity:1, duration:T.fade, ease:"none", clearProps:"opacity"}); return; }
  gsap.fromTo(bg, {opacity:0}, {opacity:1, duration:T.set, ease:"none", clearProps:"opacity"});
  gsap.fromTo(sheet, {y:T.shift * 2, opacity:0}, {y:0, opacity:1, duration:T.input, clearProps:"transform,opacity"});
}

export { gsap };
