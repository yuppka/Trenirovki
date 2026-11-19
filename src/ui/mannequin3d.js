/* 3D-манекен: вращение, зум, выбор мышцы нажатием, подсветка основных/помогающих мышц и нагрузки.
   Работает поверх разметки схемы из anatomy.js: блок <section class="anat" data-3d …> несёт состояние в data-атрибутах,
   а его SVG остаётся в DOM как запасной вид и как «пульт»: нажатие на мышцу в 3D передаётся клику по той же мышце SVG,
   поэтому действия (anatPick, anatInfo) и связь со справочником мышц — общие.
   three.js и модель грузятся отдельным чанком при первом показе; один WebGL-рендерер на всё приложение
   переезжает в актуальный блок. Нет WebGL, включено «Меньше эффектов» или модель не загрузилась — остаётся SVG.
   Модель: public/assets/anatomy/mannequin.glb (объекты названы id мышц из core/muscles.js), см. SOURCES.md. */
import { MUSCLES } from '../core/muscles.js';
import { prefs } from './state.js';
import { I } from './icons.js';

const MODEL_URL = import.meta.env.BASE_URL + "assets/anatomy/mannequin.glb";
const FOV = 28, FULL_H = 1.9;
let T = null;            /* модуль three + аддоны */
let G = null;            /* {renderer, scene, camera, controls, meshes:{id:mesh}, body, ray, center} */
let loading = null, failed = false;
let host = null;         /* текущий блок .anat */
let state = {on:[], sec:[], heat:null, sel:"", hover:""};
let raf = 0, flipAnim = 0;

/* has3D — устройство и настройки позволяют 3D; can3D — и пользователь не переключился на схему */
let glOk;
export const has3D = () => {
  if (failed || prefs.lessFx) return false;
  if (glOk === undefined){ try{ const c = document.createElement("canvas"); glOk = !!(c.getContext("webgl2") || c.getContext("webgl")); }catch(e){ glOk = false; } }
  return glOk;
};
export const can3D = () => has3D() && prefs.anat3d !== false;

/* ---------- цвета из темы ---------- */
let probe = null;
function css(expr){
  if (!probe){ probe = document.createElement("i"); probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden"; document.body.appendChild(probe); }
  probe.style.color = ""; probe.style.color = expr;
  const m = getComputedStyle(probe).color.match(/[\d.]+/g) || [128, 128, 128];
  return new T.Color().setRGB(m[0] / 255, m[1] / 255, m[2] / 255, T.SRGBColorSpace);
}
const rootVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function palette(){
  const sat = rootVar("--anat-sat") || "90%", lit = rootVar("--anat-lit") || "60%", tint = (parseFloat(rootVar("--anat-tint")) || 26) / 100;
  const base = css("var(--anat-base)"), hue = {};
  Object.entries(MUSCLES).forEach(([id, m])=>{ hue[id] = css("hsl("+m.hue+" "+sat+" "+lit+")"); });
  return {base, neutral:css("var(--anat-neutral)"), hue, tint, text:css("var(--text)"), dark:document.documentElement.getAttribute("data-theme") !== "aero"};
}

/* ---------- загрузка ---------- */
function load(){
  if (loading) return loading;
  loading = (async ()=>{
    const [three, gl, oc] = await Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/controls/OrbitControls.js')]);
    T = three;
    const gltf = await new gl.GLTFLoader().loadAsync(MODEL_URL);
    const renderer = new T.WebGLRenderer({antialias:true, alpha:true, powerPreference:"low-power"});
    renderer.setClearColor(0x000000, 0);
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(FOV, 1, 0.1, 30);
    scene.add(new T.HemisphereLight(0xffffff, 0x333344, 1.15));
    const key = new T.DirectionalLight(0xffffff, 1.6); camera.add(key); key.position.set(0.6, 0.9, 1.2); scene.add(camera);
    const meshes = {}; let body = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o=>{
      if (!o.isMesh) return;
      o.geometry.computeVertexNormals();
      /* DoubleSide: у зеркальных половин модели обход треугольников местами обратный — и рисуем, и выбираем лучом обе стороны */
      o.material = new T.MeshStandardMaterial({roughness:.62, metalness:.02, side:T.DoubleSide});
      if (MUSCLES[o.name]) meshes[o.name] = o; else { body = o; o.material.roughness = .85; }
    });
    scene.add(gltf.scene);
    const box = new T.Box3().setFromObject(gltf.scene), center = box.getCenter(new T.Vector3());
    const controls = new oc.OrbitControls(camera, renderer.domElement);
    controls.enablePan = false; controls.enableDamping = false; controls.rotateSpeed = .9; controls.zoomSpeed = .9;
    controls.minDistance = 1.1; controls.maxDistance = 6.5;
    controls.minPolarAngle = Math.PI / 2 - .55; controls.maxPolarAngle = Math.PI / 2 + .4;
    controls.addEventListener("change", draw);
    const cv = renderer.domElement;
    cv.className = "anat-gl"; cv.setAttribute("role", "img");
    /* вертикальный жест пальцем листает страницу, горизонтальный — вращает манекен */
    cv.style.touchAction = "pan-y";
    G = {renderer, scene, camera, controls, meshes, body, ray:new T.Raycaster(), center, box};
    bindPointer(cv);
    new ResizeObserver(resize).observe(cv);
  })().catch(e=>{ console.error("3D-манекен недоступен:", e); failed = true; G = null; document.querySelectorAll(".anat.is-3d").forEach(x=>x.classList.remove("is-3d")); throw e; });
  return loading;
}

function draw(){ if (!G || raf) return; raf = requestAnimationFrame(()=>{ raf = 0; if (G && host && host.isConnected) G.renderer.render(G.scene, G.camera); }); }
function resize(){
  if (!G || !host) return;
  const box = host.querySelector(".anat-canvas"); if (!box) return;
  const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  G.renderer.setSize(w, h, false);
  G.camera.aspect = w / h; G.camera.updateProjectionMatrix();
  draw();
}

/* ---------- состояние → материалы ---------- */
function paint(){
  if (!G) return;
  const P = palette(), on = new Set(state.on), sec = new Set(state.sec), heat = state.heat;
  /* голова, кисти, стопы и невыбираемые мышцы — спокойный нейтральный тон, заметно светлее фона карточки */
  G.body.material.color.copy(P.base.clone().lerp(P.text, P.dark ? .16 : .0));
  /* ромбовидные лежат под трапецией: когда они в деле, трапеция становится полупрозрачной */
  const deep = id => on.has(id) || sec.has(id) || state.sel === id || (heat && heat[id]);
  Object.entries(G.meshes).forEach(([id, m])=>{
    const mat = m.material, hue = P.hue[id];
    let col, em = 0;
    if (heat){ if (heat[id]){ col = css(heat[id]); em = .28; } else col = P.base.clone().lerp(P.text, P.dark ? .09 : 0); }
    else if (on.has(id)){ col = hue.clone(); em = P.dark ? .45 : .2; }
    else if (sec.has(id)) col = P.base.clone().lerp(hue, .58);
    else col = P.base.clone().lerp(hue, on.size ? P.tint * .7 : P.tint + .16);
    if (state.sel === id){ col = col.clone().lerp(P.text, .38); em = Math.max(em, .5); }
    if (state.hover === id) em += .22;
    mat.color.copy(col); mat.emissive.copy(col); mat.emissiveIntensity = em;
    const xray = id === "traps" && deep("rhomboids") && !deep("traps");
    mat.transparent = xray; mat.opacity = xray ? .22 : 1; mat.depthWrite = !xray;
    mat.needsUpdate = true;
  });
  draw();
}

/* ---------- камера ---------- */
function frame(){
  if (!G || !host) return;
  const ids = state.on.filter(id=>G.meshes[id]);
  const fit = (h, w) => Math.max(h, w / Math.max(.4, G.camera.aspect)) / 2 / Math.tan(FOV * Math.PI / 360);
  let target = G.center.clone(), dist = fit(FULL_H, .9), az = 0;
  if (ids.length){
    const b = new T.Box3(); ids.forEach(id=>b.expandByObject(G.meshes[id]));
    const s = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
    /* приближаемся к подсвеченным мышцам, но оставляем вокруг тело, чтобы было понятно, где это */
    target = new T.Vector3(0, c.y, 0).lerp(G.center, .25);
    dist = Math.min(fit(FULL_H, .9), Math.max(2.3, fit(s.y * 2.4, s.x * 2.2)));
    const views = new Set(ids.map(id=>MUSCLES[id].view));
    az = views.size === 1 && views.has("back") ? Math.PI : views.has("back") && !views.has("front") ? Math.PI : views.size === 1 && views.has("both") ? .9 : 0;
    if (ids.length === 1 && ids[0] === "delt_side") az = .9;
  }
  G.controls.target.copy(target);
  G.camera.position.set(target.x + Math.sin(az) * dist, target.y + .05, target.z + Math.cos(az) * dist);
  G.controls.update(); draw();
}
function zoom(k){
  const off = G.camera.position.clone().sub(G.controls.target), d = Math.min(G.controls.maxDistance, Math.max(G.controls.minDistance, off.length() * k));
  G.camera.position.copy(G.controls.target).add(off.setLength(d)); G.controls.update(); draw();
}
function flip(){
  cancelAnimationFrame(flipAnim);
  const t0 = performance.now(), off0 = G.camera.position.clone().sub(G.controls.target), axis = new T.Vector3(0, 1, 0), dur = prefs.lessFx ? 0 : 320;
  const step = now=>{
    const p = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - p, 3);
    G.camera.position.copy(G.controls.target).add(off0.clone().applyAxisAngle(axis, Math.PI * e)); G.controls.update(); draw();
    if (p < 1) flipAnim = requestAnimationFrame(step);
  };
  flipAnim = requestAnimationFrame(step);
}

/* ---------- выбор мышцы ---------- */
function muscleAt(ev){
  const cv = G.renderer.domElement, r = cv.getBoundingClientRect();
  const v = new T.Vector2((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  G.ray.setFromCamera(v, G.camera);
  const hits = G.ray.intersectObjects([G.body, ...Object.values(G.meshes)], false);
  for (const h of hits){
    if (h.object === G.body) return "";
    if (h.object.material.transparent) continue;   /* сквозь полупрозрачную трапецию выбираются ромбовидные */
    return h.object.name;
  }
  return "";
}
function bindPointer(cv){
  let down = null;
  cv.addEventListener("pointerdown", e=>{ down = {x:e.clientX, y:e.clientY, t:Date.now()}; });
  cv.addEventListener("pointerup", e=>{
    const d = down; down = null;
    if (!d || !host || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || Date.now() - d.t > 600) return;
    const id = muscleAt(e); if (!id) return;
    pick(id);
  });
  cv.addEventListener("pointermove", e=>{
    if (e.pointerType !== "mouse" || down || !host) return;
    const id = host.dataset.pick ? muscleAt(e) : "";
    if (id === state.hover) return;
    state.hover = id; cv.style.cursor = id ? "pointer" : "grab"; cv.title = id ? MUSCLES[id].name : ""; paint();
  });
  cv.addEventListener("pointerleave", ()=>{ if (state.hover){ state.hover = ""; paint(); } });
}
/* нажатие в 3D = клик по той же мышце на SVG-схеме блока: действие и подпись — общие */
function pick(id){
  if (!host || !host.dataset.pick) return;
  const g = host.querySelector('.anat-views .rg[data-m="'+id+'"]'); if (!g) return;
  const box = host;
  g.dispatchEvent(new MouseEvent("click", {bubbles:true, cancelable:true}));
  if (box.isConnected && host === box){ const s = box.querySelector(".rg.sel"); state.sel = s ? s.dataset.m : ""; paint(); }
}

/* ---------- подключение к блоку ---------- */
function readState(el){
  const list = k => (el.dataset[k] || "").split(",").filter(id=>MUSCLES[id]);
  let heat = null; if (el.dataset.heat){ try{ heat = JSON.parse(el.dataset.heat); }catch(e){ heat = null; } }
  return {on:list("on"), sec:list("sec"), heat, sel:"", hover:""};
}
function attach(el){
  host = el; state = readState(el);
  const box = el.querySelector(".anat-canvas");
  if (!box.querySelector(".anat-tools")){
    box.insertAdjacentHTML("beforeend", '<div class="anat-tools"><button type="button" class="mini" data-3d="flip" aria-label="Повернуть на 180°" title="Повернуть">'+I.repeat+'</button>'
      + '<button type="button" class="mini" data-3d="out" aria-label="Отдалить">'+I.minus+'</button><button type="button" class="mini" data-3d="in" aria-label="Приблизить">'+I.plus+'</button></div>');
  }
  box.prepend(G.renderer.domElement);
  G.renderer.domElement.setAttribute("aria-label", el.getAttribute("aria-label") || "Манекен");
  el.classList.add("is-3d");
  resize(); paint(); frame();
}
/* ищем блок, которому сейчас нужен 3D (последний в документе; в шторках 3D не используется) */
let scanQueued = false, io = null, waiting = null;
const nearView = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight + 300 && r.bottom > -300; };
function scan(){
  scanQueued = false;
  if (!can3D()){ document.querySelectorAll(".anat.is-3d").forEach(x=>x.classList.remove("is-3d")); return; }
  const all = document.querySelectorAll("#main .anat[data-3d]"), el = all[all.length - 1];
  if (!el){ host = null; return; }
  if (el === host && el.classList.contains("is-3d") && G && el.contains(G.renderer.domElement)) return;
  /* блок ниже экрана (например, на главной) — three и модель грузим, только когда до него докрутили */
  if (!nearView(el)){
    if (waiting !== el){ waiting = el; if (io) io.disconnect(); io = new IntersectionObserver(es=>{ if (es.some(e=>e.isIntersecting)){ io.disconnect(); waiting = null; queue(); } }, {rootMargin:"300px 0px"}); io.observe(el); }
    return;
  }
  waiting = null; if (io) io.disconnect();
  load().then(()=>{ if (el.isConnected && can3D()) attach(el); }).catch(()=>{});
}
const queue = ()=>{ if (!scanQueued){ scanQueued = true; queueMicrotask(scan); } };

export function initMannequin(){
  const main = document.getElementById("main"); if (!main) return;
  new MutationObserver(queue).observe(main, {childList:true, subtree:true});
  new MutationObserver(()=>{ if (G && host) paint(); }).observe(document.documentElement, {attributes:true, attributeFilter:["data-theme"]});
  document.addEventListener("click", e=>{
    const b = e.target.closest("[data-3d]"); if (!b || !G || b.tagName !== "BUTTON") return;
    const k = b.dataset["3d"]; if (k === "flip") flip(); else if (k === "in") zoom(.8); else if (k === "out") zoom(1.25);
  });
  queue();
}
