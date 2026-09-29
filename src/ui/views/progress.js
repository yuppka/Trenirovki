/* Прогресс: карточка уровня силы (арт ранга + кольцо), выбор упражнения чипами,
   метрики, график факта (сплошная) и прогноза (пунктир accent). Расчёты — функции v1. */
import { S } from '../../core/store.js';
import { exById } from '../../core/training.js';
import { standardsFor, levelOf, forecastFor, sessionsFor, theilSen, recommend, CONF, curBW, effFreq, loggedFreq, ageMonths } from '../../core/calc.js';
import { LEVELS } from '../../core/data.js';
import { esc, fmtNum, parseRange, workW, monthsWord, pad, DAY, MONTH } from '../../core/util.js';
import { ui } from '../state.js';
import { topbar, tabLink, art, ring, lvChip, lvColor, lvName, nextLevelName, emptyState, metric } from '../components.js';
import { I } from '../icons.js';
import { overallRank, rankArt, plural, W_WORDS } from '../derive.js';
import { profileBanner } from './home.js';

function rankCard(){
  const r = overallRank();
  if (!r) return '<section class="rank-card" id="rank-card"><div class="rank-art">'+art(rankArt(-1), "contain")+'</div><div class="grow"><div class="cap">Уровень силы</div><div class="h2">Нет данных</div><div class="muted small">Отмечай подходы — появится ранг</div></div></section>';
  const pct = Math.round(r.p * 100);
  return '<section class="rank-card" id="rank-card"><div class="rank-art">'+art(rankArt(r.idx), "contain", "Ранг: "+lvName(r.idx))+'</div>'
    + '<div class="grow"><div class="cap">Уровень силы</div><div class="h2">'+esc(lvName(r.idx))+'</div><div class="muted small">'+(r.idx < 4 ? 'до «'+esc(nextLevelName(r.idx))+'» · ' : '')+'по '+plural(r.n, ["упражнению","упражнениям","упражнениям"])+'</div></div>'
    + ring(r.p, '<span class="num">'+pct+'%</span>', "", "Прогресс до следующего уровня: "+pct+"%")+'</section>';
}

export function viewProgress(){
  const rows = S.catalog.map(ex=>({ex, pts:sessionsFor(ex.id)})).filter(r=>r.pts.length);
  let h = topbar({plus:{act:"plus", label:"Тренировка"}, tabs:[tabLink("Главная", "today"), tabLink("Прогресс", "progress", true)]});
  h += rankCard() + profileBanner();
  if (!rows.length) return h + '<div class="card">'+emptyState("Пока нечего показать", "Отмечай выполненные подходы — здесь появятся уровни, графики и прогноз.", '<button class="btn" data-act="start">Начать тренировку</button>')+'</div>';
  /* по умолчанию — последнее упражнение, которое делали */
  const recent = [...rows].sort((a,b)=>b.pts[b.pts.length-1].t - a.pts[a.pts.length-1].t);
  let sel = ui.progEx === "all" ? null : (ui.progEx && exById(ui.progEx) ? exById(ui.progEx) : recent[0].ex);
  h += '<div class="chips" role="group" aria-label="Упражнение" style="margin-top:8px">'+recent.map(r=>'<button class="chip'+(sel && sel.id===r.ex.id?' solid on':'')+'" data-act="progEx" data-id="'+r.ex.id+'" aria-pressed="'+!!(sel && sel.id===r.ex.id)+'"><span>'+esc(r.ex.name)+'</span></button>').join("")
    + '<button class="chip inverse" data-act="progEx" data-id="all" aria-pressed="'+!sel+'">Все упражнения</button></div>';
  if (!sel) return h + overview(rows);
  return h + detail(sel);
}

function overview(rows){
  let h = '<section class="card">';
  rows.sort((a,b)=>a.ex.name.localeCompare(b.ex.name,"ru")).forEach(({ex,pts})=>{
    const last = pts[pts.length-1], st = standardsFor(ex), key = ex.assisted ? "minW" : "e";
    const base = pts.filter(p=>p.t <= last.t - 28*DAY).pop() || pts[0];
    const diff = last[key] - base[key], better = ex.assisted ? diff < 0 : diff > 0;
    const lv = st ? levelOf(last.e, st) : null;
    h += '<button class="item pitem" data-st data-act="progEx" data-id="'+ex.id+'"><div class="grow"><div class="t">'+esc(ex.name)+'</div><div style="margin-top:6px">'+(lv ? lvChip(lv) : '<span class="lvl">'+(ex.assisted?'Помощь':'Личный прогресс')+'</span>')+'</div></div>'
      + '<div><div class="val">'+fmtNum(last[key])+'<span style="font-size:13px;color:var(--muted)"> кг</span></div><div class="dl">'+(pts.length>1 && Math.abs(diff)>=0.05 ? '<span class="'+(better?'up':'down')+'">'+(diff>0?'+':'−')+fmtNum(Math.abs(diff))+'</span> за месяц' : (ex.assisted?'помощь':'1ПМ'))+'</div></div>'+I.chev+'</button>';
  });
  return h + '</section><p class="note">1ПМ считается по формуле Эпли из лучшего выполненного подхода: вес × (1 + повторы / 30).</p>';
}

function monthMetrics(ex, pts){
  const last = pts[pts.length-1], key = ex.assisted ? "minW" : "e";
  const base = pts.filter(p=>p.t <= last.t - 28*DAY).pop() || pts[0];
  const diff = last[key] - base[key], better = ex.assisted ? diff < 0 : diff > 0;
  const val = pts.length > 1 && Math.abs(diff) >= 0.05 ? '<span class="'+(better?'up':'down')+'">'+(diff>0?'+':'−')+fmtNum(Math.abs(diff))+'</span>' : '0';
  return '<div class="metrics">'+metric("Прирост за месяц", val, "кг", ex.assisted ? "помощь" : "к 1ПМ")+metric("Тренировок", pts.length, "", plural(pts.length, W_WORDS).replace(/^\d+ /, "")+" с упражнением")+'</div>';
}

function detail(ex){
  const pts = sessionsFor(ex.id), hi = parseRange(ex.reps)[1];
  let h = '<div class="row" style="margin:16px 0 4px"><div class="grow"><h2 class="h2">'+esc(ex.name)+'</h2><div class="muted small">'+esc([ex.group, ex.equipment].filter(Boolean).join(" · "))+'</div></div><button class="mini" data-act="editEx" data-id="'+ex.id+'" aria-label="Настройки упражнения">'+I.edit+'</button></div>';
  if (!pts.length) return h + '<div class="card">'+emptyState("Нет выполненных подходов", "По этому упражнению ещё нечего показать.")+'</div>';
  const last = pts[pts.length-1];
  h += monthMetrics(ex, pts);

  if (ex.assisted){
    const s = pts.length >= 4 ? theilSen(pts.slice(-8), "minW") : null, slope = s !== null ? s*30.44 : null;
    h += '<section class="card"><div class="cap">Текущая помощь</div><div class="bignum" style="margin-top:6px">'+fmtNum(last.minW)+'<small>кг</small></div><p class="note">Чем меньше помощь, тем ты сильнее. Цель — выполнять движение без помощи (0 кг).</p>';
    if (slope !== null && slope < -0.05) h += '<p style="margin:10px 0 0">При твоём темпе ('+fmtNum(slope)+' кг/мес) — без помощи примерно через <b>'+monthsWord(last.minW/(-slope))+'</b>.</p>';
    else h += '<p class="note">Прогноз появится после 4 тренировок с этим упражнением.</p>';
    h += chart({pts:pts.map(p=>({t:p.t,y:p.minW}))}) + '</section>' + nextSessionCard(ex);
    return h;
  }
  const f = forecastFor(ex, pts), st = f.st, lv = st ? levelOf(f.e0, st) : null;
  if (f.conf > 0){
    h += '<section class="card"><div class="row"><h3 class="h3 grow">График 1ПМ</h3><span class="muted" style="font-size:12px">'+CONF[f.conf]+'</span></div>'
      + chart({pts:pts.map(p=>({t:p.t,y:p.e})), proj:[{t:last.t,y:f.e0},{t:last.t+3*MONTH,y:f.sim(3)}], hlines: f.eta && f.eta.months < 240 ? [{y:f.eta.target,label:LEVELS[f.eta.idx]+" "+fmtNum(Math.round(f.eta.target)),color:lvColor(f.eta.idx)}] : []})
      + '<div class="legend"><span><i></i>1ПМ</span><span><i class="dash"></i>прогноз на 3 мес.</span></div></section>';
  }
  h += '<section class="card"><div class="row" style="align-items:flex-start"><div class="grow"><div class="cap">Расчётный максимум (1ПМ)</div><div class="bignum" style="margin-top:6px">'+fmtNum(f.e0)+'<small>кг</small></div></div>'+(lv?lvChip(lv):'')+'</div>'
     + '<div class="muted small" style="margin-top:8px">Лучший результат последних тренировок'+(curBW()?' · '+fmtNum(f.e0/curBW(),2)+' × вес тела':'')+'</div>';
  if (st){
    h += '<div class="ladder">'+[0,1,2,3,4].map(i=>{ const fill = lv.idx > i ? 1 : lv.idx === i ? lv.frac : 0; return '<div class="seg5"><span style="transform:scaleX('+fill.toFixed(3)+');background:'+lvColor(i)+'"></span></div>'; }).join("")+'</div>'
       + '<div class="ladder-l">'+LEVELS.map((n,i)=>'<div><b>'+fmtNum(Math.round(st[i]))+'</b>'+n+'</div>').join("")+'</div>';
  }
  h += '</section>';

  const dots = [0,1,2,3].map(i=>'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px;background:'+(i<=f.conf?'var(--accent)':'var(--surface-3)')+'"></span>').join("");
  h += '<section class="card"><div class="row" style="margin-bottom:10px"><h2 class="h2 grow">Прогноз</h2><span class="muted" style="font-size:12px">'+dots+CONF[f.conf]+'</span></div>';
  if (f.conf === 0){
    h += '<p class="muted" style="margin:0">Пока одна тренировка с этим упражнением. Прогноз появится после второй — одной тренировки мало, особенно если она была неполной.</p>';
  } else {
    h += '<div class="muted small" style="margin:-4px 0 4px">Рабочий вес на '+hi+' повторов</div><table class="fc">'+[[0,"Сейчас"],[3,"Через 3 месяца"],[6,"Через 6 месяцев"],[12,"Через год"]].map(([d,l])=>{ const e = d ? f.sim(d) : f.e0; return '<tr><td>'+l+'</td><td class="w">'+fmtNum(workW(e,hi))+' кг × '+hi+'</td><td class="e">1ПМ '+fmtNum(e,0)+'</td></tr>'; }).join("")+'</table>';
    if (f.eta) h += '<p style="margin:14px 0 0">До уровня «'+LEVELS[f.eta.idx]+'»: <b>+'+fmtNum(Math.max(0,f.eta.target-f.e0))+' кг</b> к 1ПМ — '+(f.eta.months >= 240 ? 'дальше горизонта прогноза' : 'примерно через <b>'+monthsWord(f.eta.months)+'</b>')+' (рабочий ≈ '+fmtNum(workW(f.eta.target,hi))+' кг × '+hi+').</p>';
    const fq = effFreq(), lf = loggedFreq();
    h += '<p class="muted small" style="margin:8px 0 0">Сейчас темп ≈ '+fmtNum(f.rate0*100)+'% к 1ПМ в месяц: стаж '+(S.profile.start?(ageMonths(Date.now())<1?'меньше месяца':monthsWord(ageMonths(Date.now()))):'не указан')+(S.profile.returning?', есть прошлый опыт':'')+', '+fmtNum(fq)+' трен./нед'+(lf!==null?' (по журналу '+fmtNum(lf)+')':'')+'.'
       + (f.personal !== null ? ' Твой фактический темп за последние недели: '+fmtNum(f.personal*100)+'%/мес — он учтён с весом '+Math.round(f.w*100)+'%.' : ' Личный темп подключится после 4 тренировок с этим упражнением за 3+ недели (сейчас '+f.win+').')+'</p>';
    if (!S.profile.start || !S.profile.freq) h += '<div class="banner" style="margin:12px 0 0"><div class="txt">Укажи в профиле, с какого месяца тренируешься регулярно и сколько раз в неделю — прогноз станет точнее.</div><button class="btn small" data-act="tab" data-tab="profile">Профиль</button></div>';
    h += '<p class="note">Как считается: старт — лучший 1ПМ из трёх последних тренировок. Темп задают стаж (новички растут быстрее, с опытом прирост падает до нескольких процентов в год), частота тренировок и уровень относительно эталонов Strength Level'+(st?' ('+(S.profile.sex==="f"?"женщина":"мужчина")+', '+(curBW()?fmtNum(curBW())+' кг':'вес не указан')+(S.profile.age?', '+S.profile.age+' лет':'')+')':'')+'. После 4 тренировок за 3+ недели подмешивается твой реальный темп (сильнее всего — на ближайшие месяцы), после 8 за 6+ недель прогноз считается надёжным. Разброс между людьми большой, поэтому это ориентир, а не обещание.</p>';
  }
  return h + '</section>' + nextSessionCard(ex);
}

export function nextSessionCard(ex){
  const rec = recommend(ex.id, null), [lo, hi] = parseRange(ex.reps);
  let h = '<section class="card"><h2 class="h2">Следующая тренировка</h2>';
  if (rec) h += '<div class="num" style="font-size:30px">'+fmtNum(rec.weight)+' кг × '+rec.reps+' <span style="font-size:16px;color:var(--muted)">× '+rec.sets+' подх.</span></div><p class="muted" style="margin:8px 0 0">'+esc(rec.why)+'</p>';
  return h + '<p class="note">Двойная прогрессия: работай в диапазоне '+lo+'–'+hi+' повторов. Когда все подходы сделаны на '+hi+', добавь минимальный шаг веса и начни с '+lo+'. Диапазон меняется в настройках упражнения.</p></section>';
}

/* график: геометрия как в v1; факт — сплошная линия, прогноз — пунктир accent */
export function chart(o){
  const W=340,H=190,L=40,R=12,T=18,B=26, color = o.color || "var(--accent)";
  const all = [...o.pts, ...(o.proj||[])];
  let xmin = Math.min(...all.map(p=>p.t)), xmax = Math.max(...all.map(p=>p.t));
  if (xmax - xmin < 7*DAY){ xmin -= 4*DAY; xmax += 4*DAY; }
  const ys = [...all.map(p=>p.y), ...(o.hlines||[]).map(l=>l.y)];
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (ymax - ymin < 2){ ymin -= 1; ymax += 1; }
  const py = (ymax-ymin)*0.12; ymin = Math.max(0, ymin-py); ymax += py;
  const x = t => L + (t-xmin)/(xmax-xmin)*(W-L-R), y = v => T + (1-(v-ymin)/(ymax-ymin))*(H-T-B);
  const dd = t => { const d = new Date(t); return pad(d.getDate())+"."+pad(d.getMonth()+1); };
  let s = '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="График: '+esc(o.pts.map(p=>dd(p.t)+" "+fmtNum(p.y)).slice(-6).join(", "))+'">';
  for (let k=0;k<3;k++){ const v = ymin + (ymax-ymin)*k/2, yy = y(v).toFixed(1); s += '<line class="grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'"/><text class="lbl" x="'+(L-6)+'" y="'+(+yy+4)+'" text-anchor="end">'+fmtNum(Math.round(v))+'</text>'; }
  (o.hlines||[]).forEach(l=>{ const yy = y(l.y).toFixed(1); s += '<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke-dasharray="2 4" stroke-width="1.5" style="stroke:'+l.color+'"/><text x="'+(W-R)+'" y="'+(+yy-6)+'" text-anchor="end" font-size="11" font-weight="800" style="fill:'+l.color+'">'+esc(l.label)+'</text>'; });
  if (o.pts.length > 1){
    const d = o.pts.map((p,i)=>(i?"L":"M")+x(p.t).toFixed(1)+" "+y(p.y).toFixed(1)).join(" ");
    s += '<path d="'+d+' L'+x(o.pts[o.pts.length-1].t).toFixed(1)+' '+(H-B)+' L'+x(o.pts[0].t).toFixed(1)+' '+(H-B)+' Z" style="fill:var(--accent-tint)"/>';
    s += '<path d="'+d+'" fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" style="stroke:'+color+'"/>';
  }
  if (o.proj) s += '<path d="'+o.proj.map((p,i)=>(i?"L":"M")+x(p.t).toFixed(1)+" "+y(p.y).toFixed(1)).join(" ")+'" fill="none" stroke-width="3" stroke-dasharray="6 6" stroke-linecap="round" style="stroke:var(--accent)"/>';
  o.pts.forEach(p=>{ s += '<circle cx="'+x(p.t).toFixed(1)+'" cy="'+y(p.y).toFixed(1)+'" r="4" style="fill:var(--surface);stroke:'+color+';stroke-width:2.5"><title>'+dd(p.t)+': '+fmtNum(p.y)+'</title></circle>'; });
  s += '<text class="lbl" x="'+L+'" y="'+(H-6)+'">'+dd(xmin)+'</text><text class="lbl" x="'+(W-R)+'" y="'+(H-6)+'" text-anchor="end">'+dd(xmax)+'</text>';
  return s + '</svg>';
}
