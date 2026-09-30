/* Пасхалка: 7 касаний подряд по звезде ✦ на баннере главной (не дольше 4 секунд) открывают гифку
   из public/assets/. Звезда выглядит как декор и не выдаёт себя ни подписью, ни курсором. */
import { gsap, reduced } from '../motion/motion.js';
import { I } from './icons.js';
import { prefs, savePrefs } from './state.js';
import { haptic } from '../native/native.js';
import { collectNew, notifyAchievements } from './achievements.js';

const BASE = import.meta.env.BASE_URL + "assets/";
/* принимаются разные написания имени файла */
const NAMES = ["easter-egg.gif", "Easter Egg.gif", "easter egg.gif", "EasterEgg.gif", "Easter_Egg.gif", "easter_egg.gif", "easter-egg.webp", "Easter Egg.webp"];
const TAPS = 7, WINDOW = 4000;
let taps = [];

document.addEventListener("pointerdown", e=>{
  if (!e.target.closest("[data-egg]")) return;
  const now = Date.now();
  taps = taps.filter(t=>now - t < WINDOW); taps.push(now);
  if (taps.length >= TAPS){ taps = []; open(); }
}, {passive:true});

function findGif(){
  return new Promise(resolve=>{
    let i = 0;
    const next = ()=>{ if (i >= NAMES.length){ resolve(null); return; }
      const src = BASE + encodeURI(NAMES[i++]), img = new Image();
      img.onload = ()=>resolve(src); img.onerror = next; img.src = src; };
    next();
  });
}

async function open(){
  if (document.querySelector(".egg")) return;
  haptic("success");
  const src = await findGif();
  const el = document.createElement("div");
  el.className = "egg"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Пасхалка");
  el.innerHTML = '<div class="egg-card">'+(src ? '<img src="'+src+'" alt="">' : '<div class="egg-empty">'+I.star+'</div>')+'</div>'
    + Array.from({length:6}, ()=>'<span class="star4" aria-hidden="true">'+I.star+'</span>').join("");
  document.body.appendChild(el);
  const close = ()=>{ el.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e=>{ if (e.key === "Escape") close(); };
  el.addEventListener("click", close); document.addEventListener("keydown", onKey);
  if (!reduced()){
    gsap.fromTo(el.querySelector(".egg-card"), {scale:.6, rotation:-6, opacity:0}, {scale:1, rotation:0, opacity:1, duration:.5, ease:"back.out(1.8)"});
    el.querySelectorAll(".star4").forEach((s, k)=>{
      const a = k / 6 * Math.PI * 2, r = 150 + Math.random() * 60;
      gsap.fromTo(s, {x:0, y:0, scale:0, opacity:1}, {x:Math.cos(a) * r, y:Math.sin(a) * r, scale:1.2, rotation:90, opacity:0, duration:.9, delay:.1 + k * .03, ease:"ui"});
    });
  } else gsap.fromTo(el, {opacity:0}, {opacity:1, duration:.12, ease:"none"});
  if (!prefs.egg){ prefs.egg = true; savePrefs(); notifyAchievements(collectNew(), 900); }
}
