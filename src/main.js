/* Точка входа. */
import './styles/fonts.css';
import './styles/theme.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';

import { S, hadLocal, dirty, writeLocal, updateSync, initCloud, mergeLibrary, touchMeta } from './core/store.js';
import { setAiSample } from './core/ai.js';
import { hooks } from './core/hooks.js';
import { getTheme, applyTheme, onThemeChange, isDark, prefs, savePrefs } from './ui/state.js';
import { initMotion } from './motion/motion.js';
import { toast } from './ui/sheet.js';
import { render, handleBack } from './ui/app.js';
import { statusBar, nativeReady } from './native/native.js';
import { registerUpdates } from './ui/update.js';
import { initAchievements, collectNew } from './ui/achievements.js';
import './ui/egg.js';

initMotion();
onThemeChange(statusBar);
applyTheme(getTheme());
hooks.render = render;
hooks.toast = toast;

/* старт — как в v1 */
if (mergeLibrary()){ S.updatedAt = hadLocal ? Date.now() : 0; dirty.state = hadLocal; }
writeLocal();
/* разово: у стартового «Трицепс жим (тренажер)» не было эталона — подставляем новый (жим на трицепс в тренажёре сидя).
   Если потом эталон уберут вручную, повторно не трогаем. */
if (!prefs.migTriStd){
  const ex = S.catalog.find(x=>x.id === "n3e64fb0877458125");
  if (ex && !ex.std && /трицепс.*жим|жим.*трицепс/i.test(ex.name)){ ex.std = "seated_dip_machine"; touchMeta(); }
  prefs.migTriStd = true; savePrefs();
}
initAchievements(); collectNew();
render(); updateSync(); initCloud();
if (window.claude && typeof window.claude.use === "function") window.claude.use("sample").then(sm=>{ if (sm){ setAiSample(sm); render(); } }).catch(()=>{});

nativeReady(handleBack);
statusBar(isDark());

/* офлайн-режим сайта и обновления: service worker кэширует приложение, шрифты и арты */
registerUpdates();
