/* Главная: hero-баннер со слайдами, метрики, «Недавние», карточка рекорда. */
import { S, cloud, touchMeta } from '../../core/store.js';
import { hooks } from '../../core/hooks.js';
import { prefs, savePrefs, ui } from '../state.js';
import { actions } from '../actions.js';
import { byRecent, todayWorkout, doneCount, workCount, exById } from '../../core/training.js';
import { curBW, profileReady, muscleVolume } from '../../core/calc.js';
import { MUSCLES, assignMuscle, secondaryFor } from '../../core/muscles.js';
import { bodyMap } from '../anatomy.js';
import { loadZone } from './report.js';
import { esc, fmtNum, fmtTitle, fmtWeekday, parseYmd, today, DAY } from '../../core/util.js';
import { topbar, tabLink, art, emptyState, metric } from '../components.js';
import { I } from '../icons.js';
import { updateState } from '../update.js';
import { openSheet, closeSheet, askConfirm, toast } from '../sheet.js';
import { workoutTitle, setsTotal, plural, EX_WORDS, SET_WORDS, recentExercises, recordEvents } from '../derive.js';

/* напоминание о резервной копии: данные живут только в этом браузере/приложении; раз в неделю, можно отложить */
function backupBanner(n){
  if (cloud.ok || n < 3) return "";
  const now = Date.now(), last = prefs.lastBackup || 0;
  if (now - last < 7*DAY || now < (prefs.backupSnooze || 0)) return "";
  const txt = last ? "Резервной копии "+plural(Math.floor((now - last) / DAY), ["день","дня","дней"])+". Данные — только на этом устройстве." : "Резервной копии ещё нет. Данные — только на этом устройстве.";
  return '<div class="banner"><div class="txt">'+txt+'</div><button class="btn small" data-act="exportJson">Сохранить</button><button class="mini" data-act="snoozeBackup" aria-label="Напомнить через неделю">'+I.x+'</button></div>';
}
actions.snoozeBackup = ()=>{ prefs.backupSnooze = Date.now() + 7*DAY; savePrefs(); hooks.render(); };

export function profileBanner(){
  if (profileReady()) return "";
  return '<div class="banner"><div class="txt">Укажи пол, возраст, рост и вес — уровни и прогноз посчитаются под тебя.</div><button class="btn small" data-act="fillProfile">Заполнить</button></div>';
}

function slide(o, i){
  return '<article class="hero" data-slide="'+i+'" aria-roledescription="слайд" aria-label="'+esc(o.title)+'">'
    + '<div class="halftone"></div>'+art("hero-home.png", "hero-art contain", "", {cut:true})+'<span class="star4 egg-hit" data-egg aria-hidden="true">'+I.star+'</span>'
    + '<div class="hero-body"><div class="h1">'+esc(o.title)+'</div><div class="sub">'+esc(o.sub)+'</div>'
    + '<button class="link" data-act="'+o.act+'"'+(o.id ? ' data-id="'+o.id+'"' : '')+'>'+esc(o.link)+'</button></div><span class="barcode" aria-hidden="true"></span></article>';
}

export function viewToday(){
  const t = today(), cur = todayWorkout();
  const prev = S.workouts.filter(w=>w.date !== t && w.exercises.length).sort(byRecent);
  const trained = S.workouts.filter(w=>w.exercises.some(doneCount));
  const week = new Set(trained.filter(w=>parseYmd(w.date).getTime() >= Date.now() - 7*DAY).map(w=>w.date)).size;

  /* слайды: сегодняшняя тренировка (или новая) + две последние для повтора */
  const slides = [];
  if (cur){
    const n = cur.exercises.length, done = cur.exercises.reduce((a,e)=>a + doneCount(e), 0), total = setsTotal(cur);
    slides.push({title:n ? workoutTitle(cur) : "Тренировка начата", sub:n ? plural(n, EX_WORDS)+", "+done+" из "+total+" подходов" : "Добавь первое упражнение", link:"Продолжить", act:"openWorkout", id:cur.id});
  } else slides.push({title:"Новая тренировка", sub:fmtWeekday(t)+", "+fmtTitle(t), link:"Начать", act:"start"});
  prev.slice(0, 2).forEach(w=>slides.push({title:workoutTitle(w), sub:plural(w.exercises.length, EX_WORDS)+", "+plural(setsTotal(w), SET_WORDS)+" · "+fmtTitle(w.date), link:"Повторить", act:"repeat", id:w.id}));

  let h = topbar({title:"Главная"});
  h += '<div class="hero-rail" id="hero-rail" aria-label="Тренировки">'+slides.map(slide).join("")+'</div>';
  if (slides.length > 1) h += '<div class="pager" id="pager" aria-hidden="true">'+slides.map((_, i)=>'<i class="'+(i ? '' : 'on')+'"></i>').join("")+'</div>';
  if (updateState.available) h += '<div class="banner"><div class="txt">Доступна новая версия приложения. Данные сохранятся.</div><button class="btn small" data-act="checkUpdate">Обновить</button></div>';
  h += profileBanner() + backupBanner(trained.length);

  h += '<div class="metrics">'+metric("За 7 дней", week, "", "тренировок")+metric("Всего", new Set(trained.map(w=>w.date)).size, "", "тренировок")+metric("Вес тела", curBW() ? fmtNum(curBW()) : "—", curBW() ? "кг" : "")+'</div>';

  h += templatesSection();
  if (trained.length) h += musclesSection();

  /* недавние упражнения — одной лентой (тренировки уже есть в слайдах сверху и в «Истории») */
  const recEx = recentExercises(6);
  h += '<section class="section"><div class="section-head"><h2 class="h2 grow">Недавние упражнения</h2>'+(prev.length ? '<button class="btn ghost small" data-act="tab" data-tab="history">История</button>' : '')+'</div>';
  if (!recEx.length) h += '<div class="card flat">'+emptyState("Пока пусто", "Здесь появятся последние упражнения.")+'</div>';
  else h += '<div class="chips">'+recEx.map(ex=>'<button class="chip" data-st data-act="progEx" data-id="'+ex.id+'"><span>'+esc(ex.name)+'</span></button>').join("")+'</div>';
  h += '</section>';

  /* рекорды */
  const recs = recordEvents(3);
  if (recs.length){
    h += recs.map((r, i)=>{
      const b = r.p.best, sub = r.assisted ? "помощь "+fmtNum(r.p.minW)+" кг · рекорд" : (r.ex.assisted ? "помощь " : "")+fmtNum(b.weight)+" кг × "+b.reps+" · рекорд";
      return '<button class="record '+(i ? 'plain' : 'inverse')+'" data-st data-act="progEx" data-id="'+r.ex.id+'"><span class="no">'+String(i + 1).padStart(2, "0")+'</span><span class="grow"><span class="t" style="display:block">'+esc(r.ex.name)+'</span><span class="s" style="display:block">'+esc(sub)+' · '+esc(fmtTitle(r.p.date))+'</span></span>'+I.chev+'</button>';
    }).join("");
  } else if (trained.length) h += '<div class="record plain"><span class="no">01</span><span class="grow"><span class="t" style="display:block">Рекорды впереди</span><span class="s muted" style="display:block">Побей свой лучший 1ПМ — он появится здесь</span></span></div>';
  return h;
}

/* шаблоны: начать тренировку одним нажатием. Создаются в меню тренировки «Сохранить как шаблон» */
function templatesSection(){
  if (!S.templates.length) return "";
  return '<section class="section"><div class="section-head"><h2 class="h2 grow">Шаблоны</h2><button class="btn ghost small" data-act="tplManage">Изменить</button></div>'
    + '<div class="chips">'+S.templates.map(t=>'<button class="chip" data-st data-act="startTpl" data-id="'+t.id+'">'+I.plus.replace('<svg','<svg style="width:13px;height:13px"')+'<span>'+esc(t.name)+'</span></button>').join("")+'</div></section>';
}
/* управление шаблонами: переименовать, удалить */
actions.tplManage = ()=>{
  if (!S.templates.length){ closeSheet(); hooks.render(); return; }
  openSheet("Шаблоны", S.templates.map(t=>'<div class="lrow" style="align-items:flex-start"><div class="grow"><input type="text" maxlength="60" data-tpl-name="'+t.id+'" value="'+esc(t.name)+'" aria-label="Название шаблона">'
    + '<div class="muted small" style="margin-top:6px">'+esc(t.exercises.map(e=>e.name + " · " + e.sets.length).join(", "))+'</div></div>'
    + '<button class="mini danger" data-tpl-del="'+t.id+'" aria-label="Удалить шаблон «'+esc(t.name)+'»">'+I.trash+'</button></div>').join("")
    + '<p class="note">Новый шаблон — в меню тренировки: «Сохранить как шаблон».</p>', root=>{
    const sh = root.querySelector(".sheet");
    sh.addEventListener("change", e=>{ const id = e.target.dataset.tplName, t = id && S.templates.find(x=>x.id === id), v = e.target.value.trim(); if (!t) return;
      if (!v){ e.target.value = t.name; return; } t.name = v; t.updatedAt = Date.now(); touchMeta(); hooks.render(); });
    sh.addEventListener("click", e=>{ const b = e.target.closest("[data-tpl-del]"), t = b && S.templates.find(x=>x.id === b.dataset.tplDel); if (!t) return;
      askConfirm("Удалить шаблон «"+t.name+"»? Тренировки в истории останутся.", "Удалить", ()=>{ S.templates = S.templates.filter(x=>x.id !== t.id); touchMeta(); hooks.render(); toast("Шаблон удалён"); actions.tplManage(); }); });
  });
};

/* мышцы за 7 дней на манекене: зоны и подписи — как в итогах тренировки (основная мышца — подход целиком, помогающие — половина) */
const ZONE_LEGEND = [[1, "1–5"], [6, "6–9"], [10, "10–20"], [21, "21+"]];
function loadHeat(){
  const end = parseYmd(today()).getTime(), vol = muscleVolume(end - 7*DAY, end), heat = {};
  Object.entries(vol).forEach(([m, n])=>{ if (n > 0 && MUSCLES[m]){ const z = loadZone(n); heat[m] = {color:z.color, label:fmtNum(n)+" подх. за 7 дней · "+z.label}; } });
  const legend = '<div class="load-legend">'+ZONE_LEGEND.map(([n, r])=>{ const z = loadZone(n); return '<span><i style="background:'+z.color+'"></i>'+z.label+' · '+r+'</span>'; }).join("")+'</div>';
  return {heat, legend, hint:Object.keys(heat).length ? "Цвет — зона нагрузки. Нажми на мышцу" : "За 7 дней нет отмеченных подходов"};
}

/* восстановление: сколько дней прошло с последней тренировки мышцы. Учитываются тренировки, где на мышцу пришлось от 2 подходов
   (основная мышца упражнения — подход целиком, помогающая — половина). 0–1 день — восстанавливается, 2 — почти, 3+ — готова.
   Это ориентир по датам журнала (крупным мышцам обычно нужно 48–72 часа), а не измерение. */
const REC = [{color:"var(--rec-0)", label:"восстанавливается", range:"0–1 дн."}, {color:"var(--rec-1)", label:"почти", range:"2 дн."}, {color:"var(--rec-2)", label:"готова", range:"3+ дн."}];
function recoveryHeat(){
  const t0 = parseYmd(today()).getTime(), last = {};
  S.workouts.forEach(w=>{
    const t = parseYmd(w.date).getTime(); if (t > t0) return;
    const day = {};
    w.exercises.forEach(e=>{ const ex = exById(e.exId), n = workCount(e); if (!ex || !n) return;
      const m = assignMuscle(ex); if (m) day[m] = (day[m] || 0) + n;
      secondaryFor(ex).forEach(k=>{ day[k] = (day[k] || 0) + n / 2; }); });
    Object.entries(day).forEach(([m, n])=>{ if (MUSCLES[m] && n >= 2 && (!last[m] || t > last[m].t)) last[m] = {t, n}; });
  });
  const heat = {};
  Object.entries(last).forEach(([m, x])=>{ const d = Math.round((t0 - x.t) / DAY), z = REC[Math.min(d, 3) >= 3 ? 2 : d >= 2 ? 1 : 0];
    heat[m] = {color:z.color, label:z.label+" · "+(d === 0 ? "сегодня" : d === 1 ? "вчера" : plural(d, ["день","дня","дней"])+" назад")+", "+fmtNum(x.n)+" подх."}; });
  const legend = '<div class="load-legend">'+REC.map(z=>'<span><i style="background:'+z.color+'"></i>'+z.label+' · '+z.range+'</span>').join("")+'</div>'
    + '<p class="note">Ориентир по датам тренировок: крупным мышцам обычно нужно 48–72 часа. Мышцы без цвета ещё не тренировались.</p>';
  return {heat, legend, hint:"Цвет — восстановление. Нажми на мышцу"};
}
function musclesSection(){
  const mode = ui.homeMap === "rec" ? "rec" : "load", d = mode === "rec" ? recoveryHeat() : loadHeat();
  const seg = '<div class="seg" role="group" aria-label="Что показать" style="grid-template-columns:1fr 1fr;margin-bottom:var(--s3)">'
    + [["load", "Нагрузка за 7 дней"], ["rec", "Восстановление"]].map(([v, l])=>'<button type="button" data-act="homeMap" data-v="'+v+'" aria-pressed="'+(mode === v)+'">'+l+'</button>').join("")+'</div>';
  return '<section class="section"><h2 class="h2">Мышцы</h2>'+seg+'<div class="card">'+bodyMap({heat:d.heat, pick:"anatInfo", hint:d.hint})+d.legend+'</div></section>';
}
actions.homeMap = el=>{ ui.homeMap = el.dataset.v; hooks.render(); };

/* пагинация слайдов по прокрутке */
/* главное действие главной — внизу, под большим пальцем: продолжить сегодняшнюю, повторить прошлую или начать */
export function homeDock(){
  const cur = todayWorkout();
  if (cur) return '<button class="btn xl block" data-act="openWorkout" data-id="'+cur.id+'">Продолжить тренировку</button>';
  const last = S.workouts.filter(w=>w.date !== today() && w.exercises.length).sort(byRecent)[0];
  if (last) return '<button class="btn xl block home-cta" data-act="repeat" data-id="'+last.id+'">'+I.repeat+'<span>Повторить «'+esc(workoutTitle(last))+'»</span></button>';
  return '<button class="btn xl block" data-act="start">Начать тренировку</button>';
}

export function mountToday(root){
  const rail = root.querySelector("#hero-rail"), pager = root.querySelector("#pager");
  if (!rail || !pager) return;
  const dots = pager.querySelectorAll("i");
  let raf = 0;
  rail.addEventListener("scroll", ()=>{ cancelAnimationFrame(raf); raf = requestAnimationFrame(()=>{
    const i = Math.round(rail.scrollLeft / Math.max(1, rail.clientWidth - 20));
    dots.forEach((d, k)=>d.classList.toggle("on", k === i));
  }); }, {passive:true});
}
