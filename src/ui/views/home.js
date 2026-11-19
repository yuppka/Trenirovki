/* Главная: hero-баннер со слайдами, метрики, «Недавние», карточка рекорда. */
import { S, cloud } from '../../core/store.js';
import { hooks } from '../../core/hooks.js';
import { prefs, savePrefs } from '../state.js';
import { actions } from '../actions.js';
import { byRecent, todayWorkout, doneCount } from '../../core/training.js';
import { curBW, profileReady, muscleVolume } from '../../core/calc.js';
import { MUSCLES } from '../../core/muscles.js';
import { bodyMap } from '../anatomy.js';
import { loadZone } from './report.js';
import { esc, fmtNum, fmtTitle, fmtWeekday, parseYmd, today, DAY } from '../../core/util.js';
import { topbar, tabLink, art, emptyState, metric } from '../components.js';
import { I } from '../icons.js';
import { updateState } from '../update.js';
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

/* мышцы за 7 дней на манекене: зоны и подписи — как в итогах тренировки (основная мышца — подход целиком, помогающие — половина) */
const ZONE_LEGEND = [[1, "1–5"], [6, "6–9"], [10, "10–20"], [21, "21+"]];
function musclesSection(){
  const end = parseYmd(today()).getTime(), vol = muscleVolume(end - 7*DAY, end), heat = {};
  Object.entries(vol).forEach(([m, n])=>{ if (n > 0 && MUSCLES[m]){ const z = loadZone(n); heat[m] = {color:z.color, label:fmtNum(n)+" подх. за 7 дней · "+z.label}; } });
  const legend = '<div class="load-legend">'+ZONE_LEGEND.map(([n, r])=>{ const z = loadZone(n); return '<span><i style="background:'+z.color+'"></i>'+z.label+' · '+r+'</span>'; }).join("")+'</div>';
  return '<section class="section"><h2 class="h2">Мышцы за 7 дней</h2><div class="card">'
    + bodyMap({heat, pick:"anatInfo", hint:Object.keys(heat).length ? "Цвет — зона нагрузки. Нажми на мышцу" : "За 7 дней нет отмеченных подходов"})+legend+'</div></section>';
}

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
