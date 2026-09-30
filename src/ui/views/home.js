/* Главная: hero-баннер со слайдами, метрики, «Недавние», карточка рекорда. */
import { S } from '../../core/store.js';
import { byRecent, todayWorkout, doneCount } from '../../core/training.js';
import { curBW, profileReady } from '../../core/calc.js';
import { esc, fmtNum, fmtTitle, fmtWeekday, parseYmd, today, DAY } from '../../core/util.js';
import { topbar, tabLink, art, emptyState, metric } from '../components.js';
import { I } from '../icons.js';
import { updateState } from '../update.js';
import { workoutTitle, setsTotal, plural, EX_WORDS, SET_WORDS, recentExercises, recordEvents, groupArt, mainGroup } from '../derive.js';

export function profileBanner(){
  if (profileReady()) return "";
  return '<div class="banner"><div class="txt">Укажи пол, возраст, рост и вес — уровни и прогноз посчитаются под тебя.</div><button class="btn small" data-act="tab" data-tab="profile">Заполнить</button></div>';
}

function slide(o, i){
  return '<article class="hero" data-slide="'+i+'" aria-roledescription="слайд" aria-label="'+esc(o.title)+'">'
    + '<div class="halftone"></div>'+art("hero-home.png", "hero-art contain")+'<span class="star4 egg-hit" data-egg aria-hidden="true">'+I.star+'</span>'
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

  let h = topbar({plus:{act:"plus", label:cur ? "Продолжить тренировку" : "Начать тренировку"}, tabs:[tabLink("Главная", "today", true), tabLink("Прогресс", "progress")]});
  h += '<div class="hero-rail" id="hero-rail" aria-label="Тренировки">'+slides.map(slide).join("")+'</div>';
  if (slides.length > 1) h += '<div class="pager" id="pager" aria-hidden="true">'+slides.map((_, i)=>'<i class="'+(i ? '' : 'on')+'"></i>').join("")+'</div>';
  if (updateState.available) h += '<div class="banner"><div class="txt">Доступна новая версия приложения. Данные сохранятся.</div><button class="btn small" data-act="checkUpdate">Обновить</button></div>';
  h += profileBanner();

  h += '<div class="metrics">'+metric("За 7 дней", week, "", "тренировок")+metric("Всего", new Set(trained.map(w=>w.date)).size, "", "тренировок")+metric("Вес тела", curBW() ? fmtNum(curBW()) : "—", curBW() ? "кг" : "")+'</div>';

  /* Недавние: две арт-карточки тренировок + три чипа упражнений */
  const recEx = recentExercises(3);
  h += '<section class="section"><div class="section-head"><h2 class="h2">Недавние</h2>'+(prev.length ? '<button class="btn ghost small" data-act="tab" data-tab="history">Все</button>' : '')+'</div>';
  if (!prev.length && !recEx.length) h += '<div class="card flat">'+emptyState("Пока пусто", "Здесь появятся последние тренировки и упражнения.", '<button class="btn" data-act="start">Начать тренировку</button>')+'</div>';
  else {
    const cards = prev.slice(0, 2).map(w=>'<button class="art-card" data-st data-act="openWorkout" data-id="'+w.id+'" aria-label="'+esc(workoutTitle(w)+", "+fmtTitle(w.date))+'">'+art(groupArt(mainGroup(w)))+'<span class="label">'+esc(workoutTitle(w))+'<small>'+esc(fmtTitle(w.date))+'</small></span></button>');
    while (cards.length < 2) cards.push('<div class="art-card" aria-hidden="true">'+art(null)+'</div>');
    const chips = recEx.map(ex=>'<button class="chip" data-st data-act="progEx" data-id="'+ex.id+'"><span>'+esc(ex.name)+'</span></button>').join("");
    h += '<div class="recent-grid">'+cards.join("")+'<div class="chip-col">'+(chips || '<div class="muted small" style="padding:8px">Упражнения появятся после первой тренировки</div>')+'</div></div>';
  }
  h += '</section>';

  /* рекорды */
  const recs = recordEvents(3);
  if (recs.length){
    h += recs.map((r, i)=>{
      const b = r.p.best, sub = r.assisted ? "помощь "+fmtNum(r.p.minW)+" кг · рекорд" : fmtNum(b.weight)+" кг × "+b.reps+" · рекорд";
      return '<button class="record '+(i ? 'plain' : 'inverse')+'" data-st data-act="progEx" data-id="'+r.ex.id+'"><span class="no">'+String(i + 1).padStart(2, "0")+'</span><span class="grow"><span class="t" style="display:block">'+esc(r.ex.name)+'</span><span class="s" style="display:block">'+esc(sub)+' · '+esc(fmtTitle(r.p.date))+'</span></span>'+I.chev+'</button>';
    }).join("");
  } else if (trained.length) h += '<div class="record plain"><span class="no">01</span><span class="grow"><span class="t" style="display:block">Рекорды впереди</span><span class="s muted" style="display:block">Побей свой лучший 1ПМ — он появится здесь</span></span></div>';
  return h;
}

/* пагинация слайдов по прокрутке */
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
