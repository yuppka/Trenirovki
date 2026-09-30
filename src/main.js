/* Точка входа. */
import './styles/fonts.css';
import './styles/theme.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';

import { S, hadLocal, dirty, writeLocal, updateSync, initCloud, mergeLibrary } from './core/store.js';
import { setAiSample } from './core/ai.js';
import { hooks } from './core/hooks.js';
import { getTheme, applyTheme, onThemeChange, isDark } from './ui/state.js';
import { initMotion } from './motion/motion.js';
import { toast } from './ui/sheet.js';
import { render, handleBack } from './ui/app.js';
import { statusBar, nativeReady, isNative } from './native/native.js';

initMotion();
onThemeChange(statusBar);
applyTheme(getTheme());
hooks.render = render;
hooks.toast = toast;

/* старт — как в v1 */
if (mergeLibrary()){ S.updatedAt = hadLocal ? Date.now() : 0; dirty.state = hadLocal; }
writeLocal();
render(); updateSync(); initCloud();
if (window.claude && typeof window.claude.use === "function") window.claude.use("sample").then(sm=>{ if (sm){ setAiSample(sm); render(); } }).catch(()=>{});

nativeReady(handleBack);
statusBar(isDark());

/* офлайн-режим сайта: service worker кэширует приложение, шрифты и арты */
if (!isNative() && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")){
  import('virtual:pwa-register').then(({registerSW})=>registerSW({immediate:true})).catch(()=>{});
}
