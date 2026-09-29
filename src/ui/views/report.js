/* Итоги тренировки (содержание и расчёты — как в v1). */
import { S } from '../../core/store.js';
import { reportFor, MAIN_GROUPS, WEEK_SETS } from '../../core/calc.js';
import { aiMode } from '../../core/ai.js';
import { esc, fmtNum, fmtTitle, fmtWeekday } from '../../core/util.js';
import { ui } from '../state.js';
import { topbar, lvChip, metric } from '../components.js';
import { star } from '../icons.js';

export function viewReport(){
  const w = S.workouts.find(x=>x.id===ui.reportId), r = reportFor(w);
  const arrow = i => i.delta === null ? '<span class="muted">впервые</span>' : Math.abs(i.delta) < 0.05 ? '<span class="muted">= как в прошлый раз</span>' : '<span class="'+((i.assisted ? i.delta<0 : i.delta>0)?'up':'down')+'">'+(i.delta>0?'+':'−')+fmtNum(Math.abs(i.delta))+' кг'+(i.assisted?' помощи':' к 1ПМ')+'</span>';
  let h = topbar({back:"reportBack", tabs:[{label:"Тренировка", act:"reportBack"}, {label:"Итоги", act:"noop", current:true}]});
  h += '<div class="cap">'+esc(fmtWeekday(w.date))+'</div><h1 class="h1" style="margin:4px 0 8px">Итоги · '+esc(fmtTitle(w.date))+'</h1>';
  h += '<div class="metrics">'+metric("Подходов", r.done+'<small>/'+r.total+'</small>')+metric("Повторений", r.reps)+'<div class="metric" data-st><div class="cap">Рекордов</div><div class="num"'+(r.prs?' style="color:var(--accent)"':'')+'>'+r.prs+'</div></div></div>';
  h += '<section class="card"><h2 class="h2">По упражнениям</h2>' + r.items.map(i=>{
    if (i.skipped) return '<div class="lrow" data-st><div class="grow"><div style="font-weight:800">'+esc(i.name)+'</div><div class="muted small">не выполнено</div></div></div>';
    return '<div class="lrow" data-st style="align-items:flex-start"><div class="grow"><div style="font-weight:800">'+esc(i.name)+(i.pr?' <span class="lvl rec">'+star()+'рекорд</span>':'')+'</div>'
      + '<div class="muted small">'+esc(i.sets)+'</div><div class="small" style="margin-top:2px">'+arrow(i)+(i.plateau?' · <span class="down">плато</span>':'')+'</div>'
      + (i.next ? '<div class="small" style="margin-top:4px">Дальше: <b style="font-variant-numeric:tabular-nums">'+fmtNum(i.next.weight)+' кг × '+i.next.reps+'</b>'+(i.next.up?' <span class="up">↑ вес</span>':'')+'</div>' : '')+'</div>'
      + '<div style="text-align:right"><div class="num" style="font-size:22px">'+fmtNum(i.cur)+'</div><div class="muted" style="font-size:12px">'+(i.assisted?'помощь':'1ПМ')+'</div>'+(i.lv?'<div style="margin-top:6px">'+lvChip(i.lv)+'</div>':'')+'</div></div>';
  }).join("") + '</section>';
  const groups = [...new Set([...MAIN_GROUPS, ...Object.keys(r.week)])].filter(g=>g!=="Другое");
  const maxW = Math.max(WEEK_SETS[1], ...groups.map(g=>r.week[g]||0));
  h += '<section class="card"><h2 class="h2">Нагрузка на мышцы за 7 дней</h2>' + groups.map(g=>{ const n = r.week[g]||0, t = r.groupsToday[g]||0, pct = n/maxW;
      const col = n >= WEEK_SETS[0] ? 'var(--good)' : n ? 'var(--accent)' : 'var(--surface-3)';
      return '<div style="margin:10px 0"><div class="row small"><div class="grow">'+esc(g)+(t?' <span class="muted">(+'+t+' сегодня)</span>':'')+'</div><div class="num" style="font-size:16px">'+n+'</div></div><div style="height:8px;border-radius:4px;background:var(--surface-3);position:relative;overflow:hidden;margin-top:6px"><span style="position:absolute;inset:0;transform-origin:left center;transform:scaleX('+pct.toFixed(3)+');background:'+col+'"></span><span style="position:absolute;top:0;bottom:0;left:'+(WEEK_SETS[0]/maxW*100)+'%;width:2px;background:var(--muted)"></span></div></div>'; }).join("")
    + '<p class="note">Считаются выполненные подходы. Метка — около 10 подходов в неделю: частый ориентир для роста мышц, выше — до ~20.</p></section>';
  if (r.signals.length) h += '<section class="card"><h2 class="h2">Обрати внимание</h2>'+r.signals.map(x=>'<div class="lrow" style="align-items:flex-start">'+star()+'<div class="grow small">'+esc(x)+'</div></div>').join("")+'</section>';
  const mode = aiMode();
  h += '<section class="card"><div class="row" style="margin-bottom:10px"><h2 class="h2 grow">Разбор от ИИ</h2><span class="muted" style="font-size:12px">'+(mode==="claude"?"через Claude":mode==="key"?"через API-ключ":"")+'</span></div>';
  if (mode){
    h += '<div id="ai-out" aria-live="polite" style="white-space:pre-wrap;font-size:15px;line-height:1.55;margin-bottom:12px"'+(w.ai?'':' hidden')+'>'+(w.ai?esc(w.ai.text):'')+'</div><button class="btn sec block" id="ai-btn" data-act="aiRun" data-id="'+w.id+'">'+(w.ai?'Обновить разбор':'Разобрать тренировку')+'</button>'
      + '<p class="note">'+(mode==="claude"?"Запрос тратит лимиты твоего аккаунта Claude; при первом запросе появится окно разрешения.":"Запрос оплачивается с твоего API-ключа Anthropic (обычно меньше цента за разбор).")+' ИИ видит только цифры этой тренировки и профиля.</p>';
  } else h += '<p class="muted" style="margin:0 0 12px">ИИ работает через личный API-ключ Anthropic. Все цифры выше считаются и без него.</p><button class="btn sec block" data-act="openData">Подключить ключ</button>';
  h += '</section><div class="stack" style="margin:16px 0"><button class="btn block" data-act="reportDone">Готово</button><button class="btn ghost block" data-act="reportBack">К тренировке</button></div>';
  return h;
}
