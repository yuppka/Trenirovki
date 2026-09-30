/* Обновления приложения. При каждой сборке рядом с сайтом кладётся version.json с номером сборки.
   «Проверить обновления» сравнивает его с текущей сборкой и, если есть новая, подтягивает её через
   service worker и перезапускает страницу. Данные (localStorage) при этом не трогаются — импорт не нужен. */
import { toast } from './sheet.js';
import { isNative } from '../native/native.js';
import { hooks } from '../core/hooks.js';

/* eslint-disable no-undef */
export const BUILD = __BUILD__;
/* eslint-enable no-undef */

let reg = null;
export const updateState = {available:false, checking:false};

export function registerUpdates(){
  if (isNative() || !("serviceWorker" in navigator) || !(location.protocol === "https:" || location.hostname === "localhost")) return;
  import('virtual:pwa-register').then(({registerSW})=>registerSW({immediate:true, onRegisteredSW:(url, r)=>{ reg = r || null; }})).catch(()=>{});
  /* тихая проверка при возвращении в приложение (не чаще раза в 30 минут) — только показывает значок, без перезапуска */
  let last = 0;
  document.addEventListener("visibilitychange", ()=>{
    if (document.visibilityState !== "visible" || Date.now() - last < 30*60e3) return;
    last = Date.now();
    latestBuild().then(id=>{ if (id && id !== BUILD.id && !updateState.available){ updateState.available = true; hooks.render(); } }).catch(()=>{});
  });
}

async function latestBuild(){
  const r = await fetch("version.json?t="+Date.now(), {cache:"no-store"});
  if (!r.ok) throw new Error("http "+r.status);
  return (await r.json()).id;
}

export async function checkForUpdate(btn){
  if (updateState.checking) return;
  if (isNative()){ toast("В приложении обновления приходят с новой сборкой из магазина или APK"); return; }
  updateState.checking = true;
  const label = btn && btn.textContent;
  if (btn){ btn.disabled = true; btn.textContent = "Проверяю…"; }
  try{
    const id = await latestBuild();
    if (id === BUILD.id){ updateState.available = false; toast("Установлена последняя версия"); return; }
    toast("Нашлась новая версия — обновляю, данные сохранятся");
    /* после активации нового service worker страница перезапустится сама (registerType: autoUpdate) */
    if (reg){ try{ await reg.update(); }catch(e){} }
    setTimeout(()=>location.reload(), reg ? 6000 : 800);
  }catch(e){
    toast(navigator.onLine === false ? "Нет интернета — проверь обновления позже" : "Не удалось проверить обновления, попробуй позже");
  }finally{
    updateState.checking = false;
    if (btn && document.contains(btn)){ btn.disabled = false; btn.textContent = label; }
  }
}

export const buildLabel = () => "Версия "+BUILD.version+" · сборка "+new Date(BUILD.time).toLocaleString("ru-RU", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"})+(BUILD.sha ? " · "+BUILD.sha : "");
