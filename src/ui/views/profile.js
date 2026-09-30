/* Профиль: карточка героя с артом и данными, редактирование (данные идут в расчёт уровней —
   логика v1 не меняется), оформление (тема, «Меньше эффектов»), данные и резервная копия. */
import { S, cloud, touchMeta, normalize, valid, dirty, writeLocal, scheduleFlush, updateSync, mergeLibrary, setS } from '../../core/store.js';
import { curBW, loggedFreq, sessionsFor, standardsFor, levelOf } from '../../core/calc.js';
import { aiSample, getKey, LS_AIKEY } from '../../core/ai.js';
import { esc, fmtNum, fmtTitle, today, toNum, parseYmd } from '../../core/util.js';
import { hooks } from '../../core/hooks.js';
import { ui, prefs, savePrefs, getTheme, setTheme } from '../state.js';
import { topbar, tabLink, art, lvChip, lvName, emptyState } from '../components.js';
import { I, star } from '../icons.js';
import { openSheet, closeSheet, toast, askConfirm } from '../sheet.js';
import { overallRank, rankArt } from '../derive.js';
import { chart } from './progress.js';
import { actions } from '../actions.js';
import { applyLessFx } from '../../motion/motion.js';
import { saveFileNative, isNative } from '../../native/native.js';
import { achievementsSection, openAchievements, collectNew, notifyAchievements } from '../achievements.js';

export function viewProfile(){
  const p = S.profile, bw = curBW(), r = overallRank();
  let h = topbar({plus:{act:"plus", label:"Тренировка"}, tabs:[tabLink("Главная", "today"), tabLink("Профиль", "profile", true)]});
  /* карточка героя */
  h += '<section class="p-hero"><div class="dots"></div>'+art("profile-hero.png", "p-art contain")
    + '<div class="body"><div class="cap">Профиль '+star()+'</div><div class="h2" style="margin-top:6px">'+(r ? esc(lvName(r.idx)) : 'Без ранга')+'</div>'
    + '<div class="p-grid">'
    + [["Пол", p.sex==="m"?"М":p.sex==="f"?"Ж":"—"],["Возраст", p.age||"—"],["Вес", bw?fmtNum(bw):"—"],["Рост", p.height||"—"]].map(([l,v])=>'<div><div class="cap">'+l+'</div><div class="num">'+esc(v)+'</div></div>').join("")
    + '</div>'+(r ? '<div class="p-rank">'+art(rankArt(r.idx))+'<span class="small muted">ранг по '+r.n+' упр. · '+Math.round(r.p*100)+'% до следующего</span></div>' : '')+'</div></section>';

  h += '<section class="card"><h2 class="h2">О себе</h2><label class="f"><span>Пол</span><div class="seg" style="grid-template-columns:1fr 1fr" id="pf-sex"><button data-sex="m" aria-pressed="'+(p.sex==="m")+'">Мужской</button><button data-sex="f" aria-pressed="'+(p.sex==="f")+'">Женский</button></div></label>'
     + '<div class="kv"><label class="f"><span>Возраст, лет</span><input type="number" inputmode="numeric" min="10" max="100" data-in="pf" data-k="age" value="'+esc(p.age)+'"></label><label class="f"><span>Рост, см</span><input type="number" inputmode="decimal" min="100" max="250" data-in="pf" data-k="height" value="'+esc(p.height)+'"></label></div>'
     + '<p class="note" style="margin-top:0">Пол и вес тела задают эталоны силы. Возраст даёт поправку: после 40 лет и до 20 эталоны ниже. Рост нужен для индекса массы тела; на эталоны силы напрямую не влияет.</p></section>';
  const lf = loggedFreq();
  h += '<section class="card"><h2 class="h2">Тренировки</h2><div class="kv"><label class="f"><span>Регулярно с</span><input type="month" data-in="pf" data-k="start" value="'+esc(p.start)+'" max="'+today().slice(0,7)+'"></label><label class="f"><span>Раз в неделю</span><input type="number" inputmode="decimal" step="0.5" min="1" max="7" data-in="pf" data-k="freq" value="'+esc(p.freq)+'" placeholder="2.5"></label></div>'
     + '<label class="check"><input type="checkbox" id="pf-ret"'+(p.returning?' checked':'')+'><span>Раньше уже занимался с перерывами — сила возвращается быстрее, чем набирается с нуля</span></label>'
     + '<p class="note" style="margin-top:0">'+(lf!==null?'По журналу за последние недели: '+fmtNum(lf)+' тренировки в неделю. В прогнозе используется среднее между журналом и твоей оценкой.':'Когда в журнале наберётся 3+ тренировки за 3 недели, частота будет считаться и по нему.')+' Стаж растёт сам — дату менять не нужно.</p></section>';
  h += '<section class="card"><h2 class="h2">Вес тела</h2><div class="row" style="align-items:flex-end"><div class="grow"><div class="bignum">'+(bw?fmtNum(bw):'—')+'<small>кг</small></div>';
  if (bw && S.bodyLog.length>1){ const d = bw - S.bodyLog[0].weight; h += '<div class="muted small" style="margin-top:6px">'+(d>=0?'+':'−')+fmtNum(Math.abs(d))+' кг с '+esc(fmtTitle(S.bodyLog[0].date))+'</div>'; }
  h += '</div>';
  if (bw && p.height){ const bmi = bw/Math.pow(p.height/100,2); const cat = bmi<18.5?"ниже нормы":bmi<25?"норма":bmi<30?"выше нормы":"ожирение"; h += '<div style="text-align:right"><div class="num num-m">'+fmtNum(bmi)+'</div><div class="muted small">ИМТ, '+cat+'</div></div>'; }
  h += '</div><div class="row" style="margin-top:14px"><input type="number" inputmode="decimal" step="0.1" id="bw-in" class="grow" placeholder="Вес сегодня, кг" aria-label="Вес сегодня" enterkeyhint="done"><button class="btn" data-act="addBW">Записать</button></div>';
  if (S.bodyLog.length > 1) h += chart({pts:S.bodyLog.map(x=>({t:parseYmd(x.date).getTime(), y:Number(x.weight)})), color:"var(--lv2)"});
  if (S.bodyLog.length) h += '<div style="margin-top:8px">'+[...S.bodyLog].reverse().slice(0,6).map(x=>'<div class="lrow"><div class="grow">'+esc(fmtTitle(x.date))+'</div><div class="num" style="font-size:17px">'+fmtNum(x.weight)+' кг</div><button class="mini danger" style="width:40px;height:40px" data-act="delBW" data-d="'+x.date+'" aria-label="Удалить запись">'+I.x+'</button></div>').join("")+'</div>';
  else h += emptyState("Записей веса нет", "Взвешивайся утром натощак и записывай сюда.");
  h += '<p class="note">ИМТ не различает мышцы и жир, поэтому у тренирующихся он бывает завышен. Взвешивайся утром натощак 1–2 раза в неделю — так цифры сравнимы.</p></section>';
  if (bw){
    const top = S.catalog.map(ex=>{ const pts = sessionsFor(ex.id), st = standardsFor(ex); if (!pts.length || !st) return null; const e = pts[pts.length-1].e; return {ex, e, lv:levelOf(e, st)}; }).filter(Boolean).sort((a,b)=>b.lv.idx-a.lv.idx || b.lv.frac-a.lv.frac);
    if (top.length) h += '<section class="card"><h2 class="h2">Сила относительно веса тела</h2>'+top.map(r=>'<div class="lrow" data-st><div class="grow small" style="font-weight:700">'+esc(r.ex.name)+'</div>'+lvChip(r.lv)+'<div class="num" style="font-size:17px;width:58px;text-align:right">'+fmtNum(r.e/bw,2)+'×</div></div>').join("")+'<p class="note">1ПМ, делённый на вес тела.</p></section>';
  }
  h += achievementsSection();
  /* оформление */
  const th = getTheme();
  h += '<section class="card"><h2 class="h2">Оформление</h2><label class="f"><span>Тема</span><div class="seg" style="grid-template-columns:repeat(3,1fr)" id="th">'+[["auto","Система"],["light","Светлая"],["dark","Тёмная"]].map(([k,l])=>'<button data-th="'+k+'" aria-pressed="'+(th===k)+'">'+l+'</button>').join("")+'</div></label>'
    + '<label class="switch"><input type="checkbox" id="less-fx"'+(prefs.lessFx?' checked':'')+'><span class="track"></span><span class="grow"><b>Меньше эффектов</b><br><span class="muted small">Без движения и вспышек: мгновенная смена или короткое затухание. Включается и системной настройкой «Уменьшить движение».</span></span></label></section>';
  h += '<section class="card"><h2 class="h2">Данные</h2><p class="muted small" style="margin:0 0 12px">'+storageText()+'</p><button class="btn sec block" data-act="openData">Резервная копия и ИИ</button></section>';
  return h;
}
const storageText = () => cloud.ok ? "Данные хранятся в личном облачном хранилище этой страницы и на устройстве." : isNative() ? "Данные хранятся в приложении на этом устройстве. Периодически делай резервную копию." : "Данные хранятся в этом браузере на этом устройстве. Очистка данных браузера их удалит — периодически делай резервную копию.";

/* --- Данные: хранение, ИИ-ключ, резервная копия (как в v1; тема переехала в профиль) --- */
export function openData(){
  openSheet("Данные",
    '<h3>Хранение</h3><p class="muted small" style="margin:0 0 14px">'+storageText()+'</p>'
   +'<h3>ИИ-разбор тренировок</h3>'+(aiSample ? '<p class="muted small" style="margin:0 0 14px">Работает через твой аккаунт Claude — ключ не нужен.</p>' :
      '<p class="muted small" style="margin:0 0 8px">Вставь свой API-ключ Anthropic (console.anthropic.com → API Keys). Он хранится только на этом устройстве и отправляется только в Anthropic. Не вставляй ключ на чужих устройствах.</p><div class="row"><input type="text" id="ai-key" class="grow" placeholder="sk-ant-…" autocomplete="off" value="'+(getKey()?'••••••••'+esc(getKey().slice(-4)):'')+'" aria-label="API-ключ"><button class="btn small" id="ai-save">'+(getKey()?'Сменить':'Сохранить')+'</button></div>'+(getKey()?'<button class="btn ghost block" id="ai-del" style="margin-top:8px">Удалить ключ</button>':''))
   +'<h3>Резервная копия</h3><div class="stack"><button class="btn block" id="ex-save">Экспорт в JSON</button>'+(canShareFiles() ? '<button class="btn sec block" id="ex-share">Отправить файлом</button>' : '')+'<button class="btn sec block" id="ex-show">Показать JSON для копирования</button>'
   +'<label class="btn sec block" style="cursor:pointer">Импорт из файла<input type="file" accept="application/json,.json" id="im-file" class="sr"></label>'
   +'<textarea id="im-text" placeholder="Или вставь сюда JSON резервной копии" aria-label="JSON для импорта"></textarea><button class="btn sec block" id="im-go">Импортировать вставленный JSON</button></div>'
   +'<p class="note">Импорт заменяет все текущие данные. Копии из прошлых версий тоже подходят. Мессенджеры делят длинный текст на несколько сообщений — надёжнее передавать файлом; если копируешь текстом, вставь все части подряд.</p>',
    root=>{
      const ks = root.querySelector("#ai-save");
      if (ks) ks.onclick = ()=>{ const v = root.querySelector("#ai-key").value.trim(); if (!/^sk-ant-/.test(v)){ toast("Ключ должен начинаться с sk-ant-"); return; } try{ localStorage.setItem(LS_AIKEY, v); }catch(e){} toast("Ключ сохранён"); closeSheet(); hooks.render(); };
      const kd = root.querySelector("#ai-del");
      if (kd) kd.onclick = ()=>{ try{ localStorage.removeItem(LS_AIKEY); }catch(e){} toast("Ключ удалён"); closeSheet(); hooks.render(); };
      root.querySelector("#ex-save").onclick = exportJson;
      root.querySelector("#ex-show").onclick = ()=>{ const ta = root.querySelector("#im-text"); ta.value = exportString(true); ta.focus(); ta.select(); const kb = Math.round(ta.value.length / 1024); try{ navigator.clipboard.writeText(ta.value).then(()=>toast("JSON скопирован · "+kb+" КБ"),()=>toast("Выдели и скопируй текст")); }catch(e){ toast("Выдели и скопируй текст"); } };
      const sh = root.querySelector("#ex-share"); if (sh) sh.onclick = shareBackup;
      root.querySelector("#im-file").onchange = e=>{ const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ()=>importJson(String(r.result)); r.onerror = ()=>toast("Не удалось прочитать файл"); r.readAsText(f); e.target.value=""; };
      root.querySelector("#im-go").onclick = ()=>{ const v = root.querySelector("#im-text").value.trim(); if (!v){ toast("Вставь JSON"); return; } importJson(v); };
    });
}
/* формат копии как в v1; compact — без отступов, для копирования текстом (в ~2 раза короче) */
export function exportString(compact){ return JSON.stringify({app:"dnevnik-trenirovok", version:3, exportedAt:new Date().toISOString(), catalog:S.catalog, workouts:S.workouts, profile:S.profile, bodyLog:S.bodyLog, libVersion:S.libVersion}, null, compact ? 0 : 2); }
const backupName = () => "trenirovki-"+today()+".json";
function canShareFiles(){ try{ return !isNative() && !!navigator.canShare && navigator.canShare({files:[new File(["{}"], "t.json", {type:"application/json"})]}); }catch(e){ return false; } }
async function shareBackup(){
  const file = new File([exportString()], backupName(), {type:"application/json"});
  try{ await navigator.share({files:[file], title:backupName()}); }catch(e){ if (!e || e.name !== "AbortError") toast("Не удалось отправить — используй «Экспорт в JSON»"); }
}

/* Разбор вставленной копии. Мессенджеры и буфер обмена могут добавить невидимые символы, неразрывные пробелы,
   текст вокруг JSON или разбить длинное сообщение на части с переносами строк. Переводы строк внутри JSON-строк
   в наших копиях всегда экранированы, поэтому «сырые» переносы можно безопасно убрать. */
export function parseBackup(raw){
  const s = String(raw || "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/\u00A0/g, " ").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0) return {error:"В тексте нет JSON — скопируй копию целиком, начиная с «{»."};
  const base = b > a ? s.slice(a, b + 1) : s.slice(a), flat = base.replace(/[\r\n]+/g, "");
  for (const x of [base, flat, flat.replace(/[\u201C\u201D\u201E]/g, '"')]){ try{ return {data:JSON.parse(x)}; }catch(e){} }
  let depth = 0, str = false, esc = false;
  for (const ch of flat){ if (str){ if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') str = false; } else if (ch === '"') str = true; else if (ch === "{" || ch === "[") depth++; else if (ch === "}" || ch === "]") depth--; }
  if (depth > 0 || str) return {error:"Копия обрезана — не хватает конца (вставлено "+Math.round(s.length / 1024)+" КБ). Вставь все части сообщения подряд или передай копию файлом."};
  return {error:"Текст повреждён и не читается как JSON. Передай копию файлом: «Экспорт в JSON» или «Отправить файлом»."};
}
export async function exportJson(){
  const data = exportString(), name = backupName();
  try{ if (await saveFileNative(name, data)){ toast("Файл готов"); return; } }catch(e){ if (e && /cancel/i.test(String(e.message || e))) return; }
  let dl = null; try{ dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null; }catch(e){}
  if (dl){ try{ await dl.save({filename:name, data}); toast("Файл сохранён"); return; }catch(e){ if (e && e.code === "declined"){ toast("Сохранение отменено"); return; } } }
  try{ const url = URL.createObjectURL(new Blob([data],{type:"application/json"})); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 5000); toast("Файл сохранён в загрузки"); }
  catch(e){ toast("Скачивание недоступно — используй «Показать JSON»"); }
}
function importJson(text){
  const res = parseBackup(text); if (res.error){ toast(res.error); return; }
  const d = res.data;
  if (!valid(d)){ toast("Файл не похож на резервную копию дневника"); return; }
  askConfirm("Заменить все текущие данные копией? Упражнений: "+d.catalog.length+", тренировок: "+d.workouts.length+".", "Заменить", ()=>{
    const n = normalize(d), now = Date.now(); n.updatedAt = now; n.workouts.forEach(w=>{ w.updatedAt = now; });
    const keep = new Set(n.workouts.map(w=>w.id));
    n.deleted = [...new Set([...S.deleted, ...S.workouts.map(w=>w.id), ...cloud.serverIds])].filter(id=>!keep.has(id));
    setS(n); mergeLibrary(); dirty.state = true; dirty.w = new Set(n.workouts.map(w=>w.id)); ui.workoutId = null; ui.progEx = null;
    writeLocal(); scheduleFlush(); updateSync(); collectNew(); hooks.render(); toast("Данные восстановлены");
  });
}

/* обработчики профиля */
export function mountProfile(root){
  const th = root.querySelector("#th");
  if (th) th.onclick = e=>{ const b = e.target.closest("[data-th]"); if (!b) return; setTheme(b.dataset.th); th.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", x===b)); };
  const lf = root.querySelector("#less-fx");
  if (lf) lf.onchange = ()=>{ prefs.lessFx = lf.checked; savePrefs(); applyLessFx(); toast(lf.checked ? "Эффекты уменьшены" : "Эффекты включены"); };
}

Object.assign(actions, {
  openData,
  achAll: ()=>openAchievements(),
  addBW: ()=>{ const v = toNum(document.getElementById("bw-in").value); if (v === "" || v < 25 || v > 300){ toast("Введи вес в кг"); return; } const d = today(); S.bodyLog = S.bodyLog.filter(x=>x.date!==d); S.bodyLog.push({date:d, weight:v}); S.bodyLog.sort((a,b)=>a.date.localeCompare(b.date)); touchMeta(); hooks.render(); toast("Вес записан"); notifyAchievements(collectNew(), 600); },
  delBW: el=>{ S.bodyLog = S.bodyLog.filter(x=>x.date!==el.dataset.d); touchMeta(); hooks.render(); }
});
