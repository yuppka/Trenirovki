/* Анимации интерфейса без сторонних библиотек: CSS + Web Animations API.
   Правила: анимируются только transform и opacity; во время ввода ≤ 300 мс; слои эффектов
   не перехватывают касания (pointer-events:none), поэтому ввод никогда не блокируется.
   «Меньше эффектов» или системное prefers-reduced-motion → мгновенная смена или fade 120 мс.
   Кривая берётся из темы (--ease): в Premium — пружина (linear()), в Aero — мягкий cubic-bezier. */
import { prefs } from '../ui/state.js';
import { I } from '../ui/icons.js';

const root = document.documentElement;
const css = n => getComputedStyle(root).getPropertyValue(n).trim();
const ms = n => { const v = css(n); return v.endsWith("ms") ? parseFloat(v) : (parseFloat(v) || 0) * 1000; };
export const T = {};
const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : {matches:false, addEventListener(){}};

export const reduced = () => !!prefs.lessFx || mq.matches;

/* кривая темы с проверкой поддержки (linear() есть не во всех браузерах) */
const FALLBACK = "cubic-bezier(.2,.8,.2,1)";
let easeCache = null;
export function ease(){
  if (easeCache) return easeCache;
  const e = css("--ease") || FALLBACK;
  try{ document.createElement("div").animate([{opacity:0},{opacity:1}], {duration:1, easing:e}).cancel(); easeCache = e; }
  catch(err){ easeCache = css("--ease-fallback") || FALLBACK; }
  return easeCache;
}
export const resetEase = () => { easeCache = null; };

export function initMotion(){
  Object.assign(T, {
    fade:ms("--dur-fade"), digit:ms("--dur-digit"), set:ms("--dur-set"), input:ms("--dur-input"),
    screen:ms("--dur-screen"), rank:ms("--dur-rank"), record:ms("--dur-record"), freeze:ms("--dur-freeze"),
    stagger:ms("--stagger"), staggerMax:parseInt(css("--stagger-max"),10) || 8, shift:parseFloat(css("--shift")) || 24
  });
  applyLessFx();
  mq.addEventListener?.("change", applyLessFx);
}
export function applyLessFx(){ root.classList.toggle("less-fx", reduced()); }

/* обёртка над element.animate */
export function anim(el, frames, duration, o = {}){
  if (!el || !el.animate) return null;
  return el.animate(frames, {duration, delay:o.delay || 0, easing:o.easing || ease(), fill:o.fill || "none", iterations:o.iterations || 1, direction:o.direction || "normal"});
}
/* плавное изменение числа (для кольца прогресса), только через transform в onUpdate */
export function tween(from, to, duration, onUpdate, o = {}){
  const fn = o.linear ? (t=>t) : (t=>1 - Math.pow(1 - t, 3));
  let raf = 0, start = 0, done = false;
  const step = now => {
    if (!start) start = now + (o.delay || 0);
    const t = Math.max(0, Math.min(1, (now - start) / Math.max(1, duration)));
    onUpdate(from + (to - from) * fn(t));
    if (t < 1 && !done) raf = requestAnimationFrame(step); else { done = true; o.onDone && o.onDone(); }
  };
  raf = requestAnimationFrame(step);
  return { kill(){ done = true; cancelAnimationFrame(raf); }, finish(){ if (done) return; done = true; cancelAnimationFrame(raf); onUpdate(to); o.onDone && o.onDone(); } };
}

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
  el.getAnimations?.().forEach(a=>a.cancel());
  if (reduced()){ anim(el, [{opacity:0},{opacity:1}], T.fade, {easing:"linear"}); return; }
  if (!veil){ veil = document.createElement("div"); veil.className = "fx-veil"; document.body.appendChild(veil); }
  anim(veil, [{opacity:1},{opacity:0}], T.screen);
  anim(el, [{transform:"translateX("+((dir || 1) * T.shift)+"px)", opacity:0},{transform:"none", opacity:1}], T.screen);
}

/* ---------- каскад списков: 40 мс на элемент, максимум 8 ---------- */
export function cascade(container){
  if (!container || reduced()) return;
  [...container.querySelectorAll("[data-st]")].slice(0, T.staggerMax).forEach((el, i)=>
    anim(el, [{transform:"translateY(12px)", opacity:0},{transform:"none", opacity:1}], T.input, {delay:i * T.stagger, fill:"backwards"}));
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
  el.querySelectorAll(".n").forEach(x=>anim(x, [{transform:"translateY("+(dir * 100)+"%)"},{transform:"none"}], T.digit));
  el.querySelectorAll(".o").forEach(x=>{ const an = anim(x, [{transform:"none", opacity:1},{transform:"translateY("+(-dir * 100)+"%)", opacity:0}], T.digit, {fill:"forwards"}); if (an) an.onfinish = ()=>x.remove(); else x.remove(); });
}

/* ---------- «Подход выполнен»: вспышка обводки строки + пульс кнопки, 250 мс ---------- */
export function setDoneFx(row, btn){
  if (reduced()) return;
  const flash = row && row.querySelector(".flash");
  if (flash) anim(flash, [{opacity:1},{opacity:0}], T.set, {easing:"linear"});
  if (btn) anim(btn, [{transform:"scale(1)"},{transform:"scale(1.04)"},{transform:"scale(1)"}], T.set);
}
export function pulse(el, amount = 1.08){
  if (!el || reduced()) return;
  anim(el, [{transform:"scale(1)"},{transform:"scale("+amount+")"},{transform:"scale(1)"}], 300);
}

/* слой для эффектов поверх интерфейса; касание пропускает эффект, но событие не перехватывается */
function fxLayer(){ let l = document.querySelector(".fx-layer"); if (!l){ l = document.createElement("div"); l.className = "fx-layer"; l.setAttribute("aria-hidden", "true"); document.body.appendChild(l); } return l; }
/* группа анимаций: завершается по последней; касание мгновенно доводит всё до конца */
function group(items, cleanup){
  const list = items.filter(Boolean);
  let ended = false;
  const end = ()=>{ if (ended) return; ended = true; document.removeEventListener("pointerdown", skip, {capture:true}); cleanup && cleanup(); };
  const skip = ()=>{ list.forEach(a=>{ try{ a.finish(); }catch(e){} }); end(); };
  document.addEventListener("pointerdown", skip, {capture:true, once:true, passive:true});
  Promise.all(list.map(a=>a.finished ? a.finished.catch(()=>{}) : new Promise(r=>{ const f = a.finish; a.finish = ()=>{ f(); r(); }; }))).then(end);
  return skip;
}

/* ---------- новый рекорд: заморозка 100 мс, свечение от числа, вспышка звезды; ≤ 1 с, пропуск тапом ---------- */
export function recordFx(anchor){
  if (!anchor || reduced()) return;
  const r = anchor.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, layer = fxLayer();
  const glow = document.createElement("div"); glow.className = "fx-glow";
  const st = document.createElement("div"); st.className = "fx-star"; st.innerHTML = I.star;
  [glow, st].forEach(el=>{ el.style.left = x+"px"; el.style.top = y+"px"; layer.appendChild(el); });
  const d = T.freeze;
  group([
    anim(anchor, [{transform:"scale(1)"},{transform:"scale(1.07)"},{transform:"scale(1)"}], 240, {delay:d}),
    anim(glow, [{transform:"scale(.2)", opacity:.95},{transform:"scale(2.6)", opacity:0}], 600, {delay:d, fill:"both"}),
    anim(st, [{transform:"scale(0) rotate(-45deg)", opacity:1, offset:0},{transform:"scale(1.15) rotate(0deg)", opacity:1, offset:.37},{transform:"scale(1.15) rotate(0deg)", opacity:1, offset:.6},{transform:"scale(.2) rotate(0deg)", opacity:0, offset:1}], 760, {delay:d + 40, fill:"both", easing:"ease-out"})
  ], ()=>{ glow.remove(); st.remove(); });
}

/* ---------- повышение ранга: кольцо дозаполняется, световая волна, кроссфейд арта; 900 мс ---------- */
export function rankUpFx({card, ring, from = 0, to = 0, artOld, artNew, onDone}){
  if (reduced()){
    setRing(ring, to);
    if (artOld) artOld.style.opacity = 0;
    if (artNew) artNew.style.opacity = 1;
    if (card) anim(card, [{opacity:0},{opacity:1}], T.fade, {easing:"linear"});
    onDone && setTimeout(onDone, 1600);
    return;
  }
  const d = T.rank, layer = fxLayer();
  const wave = document.createElement("div"); wave.className = "fx-wave";
  const r = card.getBoundingClientRect();
  Object.assign(wave.style, {left:r.left+"px", top:r.top+"px", width:r.width+"px", height:r.height+"px"});
  layer.appendChild(wave);
  const t1 = tween(from, 1, d * .45, p=>setRing(ring, p));
  const t2 = tween(0, to, d * .3, p=>setRing(ring, p), {delay:d * .6});
  const parts = [
    anim(card, [{transform:"translateY(16px)", opacity:0, offset:0},{transform:"none", opacity:1, offset:.1},{transform:"none", opacity:1, offset:.92},{transform:"translateY(8px)", opacity:0, offset:1}], d + 1300, {fill:"forwards", easing:"linear"}),
    anim(wave, [{transform:"scale(1)", opacity:.85},{transform:"scale(1.22)", opacity:0}], d * .6, {delay:d * .35, fill:"both"}),
    artNew && anim(artNew, [{opacity:0},{opacity:1}], d * .4, {delay:d * .4, fill:"both"}),
    artOld && anim(artOld, [{opacity:1},{opacity:0}], d * .4, {delay:d * .4, fill:"forwards"})
  ];
  group(parts, ()=>{ t1.kill(); t2.finish(); wave.remove(); onDone && onDone(); });
}

/* ---------- шторка ---------- */
export function sheetIn(sheet, bg){
  if (reduced()){ [sheet, bg].forEach(x=>anim(x, [{opacity:0},{opacity:1}], T.fade, {easing:"linear"})); return; }
  anim(bg, [{opacity:0},{opacity:1}], T.set, {easing:"linear"});
  anim(sheet, [{transform:"translateY("+(T.shift * 2)+"px)", opacity:0},{transform:"none", opacity:1}], T.input + 120);
}
