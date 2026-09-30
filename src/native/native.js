/* Мост к платформе. В Capacitor — нативные плагины, в браузере — веб-API.
   Никаких сторонних серверов: всё локально. */
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';

export const isNative = () => Capacitor.isNativePlatform();

/* лёгкая вибрация: light (подход), medium (рекорд), heavy (конец отдыха), success (ранг) */
export function haptic(kind = "light"){
  try{
    if (isNative()){
      if (kind === "success") Haptics.notification({type:NotificationType.Success});
      else Haptics.impact({style:kind === "heavy" ? ImpactStyle.Heavy : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light});
      return;
    }
    if (navigator.vibrate) navigator.vibrate(kind === "heavy" ? [60, 60, 60] : kind === "medium" || kind === "success" ? 25 : 12);
  }catch(e){}
}

/* экран не гаснет во время тренировки (Wake Lock в браузере, плагин в приложении) */
let awake = false;
export async function keepAwake(on){
  if (on === awake) return;
  awake = on;
  try{ if (on) await KeepAwake.keepAwake(); else await KeepAwake.allowSleep(); }catch(e){ awake = false; }
}
document.addEventListener("visibilitychange", ()=>{ if (document.visibilityState === "visible" && awake){ awake = false; keepAwake(true); } });

/* цвет значков статус-бара под тему */
export function statusBar(dark){
  if (!isNative()) return;
  try{ SystemBars.setStyle({style:dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light}); }catch(e){}
}

/* сохранение резервной копии: в приложении — файл + системное «Поделиться» */
export async function saveFileNative(name, data){
  if (!isNative()) return false;
  const res = await Filesystem.writeFile({path:name, data, directory:Directory.Cache, encoding:Encoding.UTF8});
  await Share.share({title:name, url:res.uri, dialogTitle:"Сохранить резервную копию"});
  return true;
}

export function nativeReady(onBack){
  if (!isNative()) return;
  try{ SplashScreen.hide(); }catch(e){}
  try{ App.addListener("backButton", ()=>{ if (!onBack()) App.minimizeApp(); }); }catch(e){}
}
