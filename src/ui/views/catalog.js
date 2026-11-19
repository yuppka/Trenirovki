/* Каталог: основная группа → мышца → упражнения. Сверху поиск и фильтр по оборудованию, сетка групп;
   внутри группы — мышцы со схемой; внутри мышцы — схема «где находится» и упражнения.
   Структура целиком берётся из справочника src/core/muscles.js. Форма упражнения — как в v1, но группа
   задаётся выбором мышцы и показывается анатомическая схема (основная и вспомогательные мышцы). */
import { S, touchMeta } from '../../core/store.js';
import { STD, EQUIP, guessStd, guessAssisted } from '../../core/data.js';
import { MUSCLE_GROUPS, MUSCLES, musclesOf, groupOfMuscle, assignMuscle, secondaryFor } from '../../core/muscles.js';
import { $, esc, fmtNum, uid, toNum, rangeText, parseRange } from '../../core/util.js';
import { hooks } from '../../core/hooks.js';
import { ui, prefs, savePrefs } from '../state.js';
import { topbar, tabLink, art, emptyState, metric } from '../components.js';
import { lastResult, todayWorkout } from '../../core/training.js';
import { recommend } from '../../core/calc.js';
import { fmtTitle } from '../../core/util.js';
import { I } from '../icons.js';
import { openSheet, closeSheet, toast, askConfirm } from '../sheet.js';
import { recentExercises, workingWeight } from '../derive.js';
import { actions, act } from '../actions.js';
import { anatomyBlock, bodyMap } from '../anatomy.js';

const groupByName = n => MUSCLE_GROUPS.find(g=>g.name === n);
const passEquip = x => !ui.catEquip || (x.equipment || "") === ui.catEquip;
const exOfMuscle = m => S.catalog.filter(x=>x.muscle === m && passEquip(x)).sort((a,b)=>a.name.localeCompare(b.name,"ru"));
const unassigned = () => S.catalog.filter(x=>!x.muscle || !MUSCLES[x.muscle]);
const plural = (n, f) => { const a = n % 10, b = n % 100; return n+" "+(a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? f[1] : f[2]); };
const EXW = ["упражнение","упражнения","упражнений"];

function exItem(x){
  const m = MUSCLES[x.muscle];
  return '<button class="item" data-st data-act="exCard" data-id="'+x.id+'"><div class="grow"><div class="t">'+esc(x.name)+'</div>'
    + '<div class="s">'+esc([m ? m.group+" › "+m.name : x.group || "Без мышцы", x.equipment].filter(Boolean).join(" · "))+'</div>'
    + '<div class="c">'+esc(x.reps)+' повт.'+(x.weight !== "" && x.weight != null ? ' · '+fmtNum(x.weight)+' кг' : '')+(x.std&&STD[x.std]?' · эталон: '+esc(STD[x.std].label):x.assisted?' · с противовесом':'')+'</div>'
    + (x.comment?'<div class="c">'+esc(x.comment)+'</div>':'')+'</div>'+I.chev+'</button>';
}

function searchBar(){
  const eqs = [...new Set([...EQUIP, ...S.catalog.map(x=>x.equipment).filter(Boolean)])];
  return '<div class="search" style="margin:4px 0 8px">'+I.search+'<input type="search" id="catq" placeholder="Поиск упражнения" value="'+esc(ui.catQuery)+'" aria-label="Поиск упражнения" enterkeyhint="search"></div>'
    + '<div class="chips" role="group" aria-label="Оборудование"><button class="chip'+(!ui.catEquip?' solid on':'')+'" data-act="catEquip" data-v="" aria-pressed="'+!ui.catEquip+'">Любое</button>'
    + eqs.map(e=>'<button class="chip'+(ui.catEquip===e?' solid on':'')+'" data-act="catEquip" data-v="'+esc(e)+'" aria-pressed="'+(ui.catEquip===e)+'"><span>'+esc(e)+'</span></button>').join("")+'</div>';
}

export function viewCatalog(){
  const g = ui.catGroup && groupByName(ui.catGroup), m = ui.catMuscle && MUSCLES[ui.catMuscle] ? ui.catMuscle : "";
  const back = m || g ? "catBack" : null;
  let h = topbar({back, title:m ? MUSCLES[m].name : g ? g.name : "Каталог", sub:m ? MUSCLES[m].group : "", right:m || g ? '' : '<button class="btn sec small" data-act="newEx">+ Упражнение</button>'});
  if (m) return h + muscleScreen(m);
  if (g) return h + groupScreen(g);
  h += searchBar();
  if (ui.catQuery.trim() || ui.catEquip) return h + '<section class="section"><div class="section-head"><h2 class="h2">Найдено</h2><span class="muted small" id="catcount"></span></div><div id="catlist"></div></section>';

  /* карта тела: нажатие на мышцу открывает её упражнения */
  h += '<section class="section"><h2 class="h2">Карта мышц</h2><div class="card">'+bodyMap({hint:"Нажми на мышцу — откроются её упражнения"})+'</div></section>';

  /* сетка основных групп */
  h += '<section class="section"><h2 class="h2" style="margin-bottom:12px">Группы мышц</h2><div class="group-grid">'
    + MUSCLE_GROUPS.map(gr=>{ const n = S.catalog.filter(x=>x.muscle && groupOfMuscle(x.muscle) === gr.name).length;
      return '<button class="art-card" data-st data-act="catGroup" data-g="'+esc(gr.name)+'">'+art(gr.art, "", "", {cut:true})+'<span class="label">'+esc(gr.name)+'<small>'+plural(musclesOf(gr.name).length, ["мышца","мышцы","мышц"])+' · '+n+' упр.</small></span></button>'; }).join("")+'</div></section>';

  /* недавние — как раньше */
  const rec = recentExercises(4);
  h += '<section class="section"><h2 class="h2" style="margin-bottom:12px">Последние упражнения</h2>';
  if (!rec.length) h += '<div class="card flat">'+emptyState("Недавних нет", "Упражнения появятся здесь после тренировки.")+'</div>';
  else {
    h += '<div class="rec-grid"><div class="chip-col">'+rec.map(ex=>'<button class="chip" data-act="editEx" data-id="'+ex.id+'">'+I.search.replace('<svg','<svg style="width:13px;height:13px"')+'<span>'+esc(ex.name)+'</span></button>').join("")
      + '</div><div>'
      + rec.slice(0, 2).map(ex=>{ const ww = workingWeight(ex); return '<div style="position:relative"><button class="wcard" data-act="progEx" data-id="'+ex.id+'"><span class="cap">'+esc(ex.name)+'</span><div class="num">'+(ww === null ? '—' : fmtNum(ww))+(ww === null ? '' : '<small>кг</small>')+'</div></button>'
        + '<button class="pill-x wcard-x" data-act="hideRecent" data-id="'+ex.id+'" aria-label="Скрыть «'+esc(ex.name)+'» из недавних">'+I.x+'</button></div>'; }).join("")+'</div></div>';
  }
  h += '</section>';
  const un = unassigned();
  if (un.length) h += '<section class="section"><div class="section-head"><h2 class="h2">Без мышцы</h2><span class="muted small">'+un.length+'</span></div><p class="muted small" style="margin:0 0 10px">Открой упражнение и выбери мышцу — оно появится в нужной группе.</p>'+un.map(exItem).join("")+'</section>';
  return h;
}

function groupScreen(g){
  const ms = musclesOf(g.name);
  let h = anatomyBlock(ms, [], {compact:true, pick:"anatPick"});
  h += '<section class="section"><h2 class="h2" style="margin-bottom:12px">Мышцы</h2>'+ms.map(id=>{
    const mu = MUSCLES[id], n = exOfMuscle(id).length;
    return '<button class="item" data-st data-act="catMuscle" data-m="'+id+'"><div class="grow"><div class="t">'+esc(mu.name)+'</div><div class="s">'+esc(mu.where)+'</div><div class="c">'+plural(n, EXW)+'</div></div>'+I.chev+'</button>';
  }).join("")+'</section>';
  return h;
}

function muscleScreen(id){
  const mu = MUSCLES[id], list = exOfMuscle(id);
  let h = '<div class="card">'+anatomyBlock([id])+'</div>';
  h += '<section class="section"><div class="section-head"><h2 class="h2">Упражнения</h2><button class="btn sec small" data-act="newEx" data-m="'+id+'">+ Добавить</button></div>';
  if (ui.catEquip) h += '<div class="filter-note">Оборудование: <b style="color:var(--text)">'+esc(ui.catEquip)+'</b><button class="chip" style="min-height:32px;padding:0 10px" data-act="catEquip" data-v="" aria-label="Сбросить фильтр">'+I.x+'</button></div>';
  h += list.length ? list.map(exItem).join("") : '<div class="card flat">'+emptyState("Упражнений нет", ui.catEquip ? "Сбрось фильтр по оборудованию или добавь упражнение." : "Добавь первое упражнение для этой мышцы.")+'</div>';
  return h + '</section>';
}

/* результаты поиска и фильтра */
export function renderCatList(){
  const box = $("#catlist"); if (!box) return;
  const q = ui.catQuery.trim().toLowerCase().replace(/ё/g, "е");
  const norm = s => s.toLowerCase().replace(/ё/g, "е");
  const list = S.catalog.filter(x=>passEquip(x) && (!q || norm(x.name).includes(q) || norm((MUSCLES[x.muscle] || {}).name || "").includes(q) || norm(x.group || "").includes(q))).sort((a,b)=>a.name.localeCompare(b.name,"ru"));
  const cnt = $("#catcount"); if (cnt) cnt.textContent = list.length ? String(list.length) : "";
  if (!S.catalog.length){ box.innerHTML = '<div class="card">'+emptyState("Каталог пуст", "Добавь первое упражнение.", '<button class="btn" data-act="newEx">+ Упражнение</button>')+'</div>'; return; }
  box.innerHTML = list.length ? list.map(exItem).join("") : '<div class="card flat">'+emptyState("Ничего не найдено", "Измени запрос или фильтр.")+'</div>';
}

/* карточка упражнения: где мышца, последний результат и цель, действия. Правка и удаление — отдельной кнопкой «Изменить» */
function exCard(ex){
  if (!ex) return;
  const m = ex.muscle && MUSCLES[ex.muscle] ? ex.muscle : assignMuscle(ex), l = lastResult(ex.id, null), rec = recommend(ex.id, null), ww = workingWeight(ex);
  const cur = todayWorkout(), inW = !!cur && cur.exercises.some(e=>e.exId === ex.id), pre = ex.assisted ? "помощь " : "";
  const sets = l ? l.sets.filter(s=>s.weight !== "" && s.reps !== "").map(s=>fmtNum(s.weight)+" × "+s.reps).join(", ") : "";
  openSheet(ex.name,
    '<p class="muted small" style="margin:-6px 0 4px">'+esc([MUSCLES[m] ? MUSCLES[m].group+" › "+MUSCLES[m].name : ex.group || "Без мышцы", ex.equipment].filter(Boolean).join(" · "))+'</p>'
   + (MUSCLES[m] ? anatomyBlock([m], secondaryFor(ex), {compact:true}) : '')
   + '<div class="metrics">'+metric(ex.assisted ? "Помощь" : "Рабочий вес", ww === null ? "—" : fmtNum(ww), ww === null ? "" : "кг")+metric("Повторы", esc(ex.reps))+'</div>'
   + (l ? '<div class="lrow"><div class="grow"><div class="cap">Последний раз · '+esc(fmtTitle(l.date))+'</div><div style="font-variant-numeric:tabular-nums">'+esc(sets || "без отмеченных подходов")+'</div></div></div>' : '<p class="muted small" style="margin:8px 0">Ещё не выполнялось.</p>')
   + (rec ? '<div class="lrow"><div class="grow"><div class="cap">Цель на следующую</div><div><b>'+pre+fmtNum(rec.weight)+' кг × '+rec.reps+'</b> <span class="muted small">× '+rec.sets+' подх.</span></div></div></div>' : '')
   + (ex.comment ? '<p class="note">'+esc(ex.comment)+'</p>' : '')
   + '<div class="stack" style="margin-top:14px"><button class="btn block" data-x="add">'+(inW ? 'Открыть в тренировке' : cur ? 'Добавить в тренировку' : 'Начать тренировку с него')+'</button>'
   + '<div class="row">'+(l ? '<button class="btn sec grow" data-x="prog">Прогресс</button>' : '')+'<button class="btn sec grow" data-x="edit">Изменить</button></div></div>',
    root=>{ root.querySelector(".sheet").addEventListener("click", e=>{
      const b = e.target.closest("[data-x]"); if (!b) return;
      closeSheet();
      if (b.dataset.x === "add") act("addExToday", {id:ex.id});
      else if (b.dataset.x === "prog") act("progEx", {id:ex.id});
      else exForm(ex);
    }); });
}

/* выбор мышцы, сгруппированный по основным группам */
const muscleSelect = cur => '<select id="fx-mu"><option value="">Не выбрана</option>'+MUSCLE_GROUPS.map(g=>'<optgroup label="'+esc(g.name)+'">'+musclesOf(g.name).map(id=>'<option value="'+id+'"'+(cur===id?' selected':'')+'>'+esc(MUSCLES[id].name)+'</option>').join("")+'</optgroup>').join("")+'</select>';

export function exForm(ex, prefill, onSaved){
  const isNew = !ex;
  ex = ex || Object.assign({name:"",group:"",muscle:ui.catMuscle||"",equipment:"",reps:"8–12",weight:"",comment:"",std:"",assisted:false}, prefill||{});
  const muscle0 = ex.muscle || (isNew ? "" : assignMuscle(ex));
  openSheet(isNew ? "Новое упражнение" : "Упражнение",
    '<div id="fx-anat">'+(muscle0 ? anatomyBlock([muscle0], secondaryFor(ex), {compact:true}) : '')+'</div>'
   +'<label class="f"><span>Название</span><input type="text" id="fx-name" value="'+esc(ex.name)+'"></label>'
   +'<div class="kv"><label class="f"><span>Мышца</span>'+muscleSelect(muscle0)+'</label><label class="f"><span>Оборудование</span><input type="text" id="fx-eq" list="dl-eq" value="'+esc(ex.equipment)+'"></label></div>'
   +'<div class="kv"><label class="f"><span>Диапазон повторов</span><input type="text" id="fx-reps" value="'+esc(ex.reps)+'" placeholder="8–12"></label><label class="f"><span>Стартовый вес, кг</span><input type="number" inputmode="decimal" step="any" id="fx-w" value="'+esc(ex.weight)+'"></label></div>'
   +'<label class="f"><span>Эталон для уровня и прогноза</span><select id="fx-std"><option value="">Нет — только личный прогресс</option>'+Object.entries(STD).sort((a,b)=>a[1].label.localeCompare(b[1].label,"ru")).map(([k,v])=>'<option value="'+k+'"'+(ex.std===k?' selected':'')+'>'+esc(v.label)+'</option>').join("")+'</select></label>'
   +'<label class="check"><input type="checkbox" id="fx-as"'+(ex.assisted?' checked':'')+'><span>Тренажёр с противовесом (гравитрон): меньше вес — лучше результат</span></label>'
   +'<label class="check"><input type="checkbox" id="fx-uni"'+(ex.unilateral?' checked':'')+'><span>По одной руке или ноге: левая и правая сторона считаются отдельно (цель, прогресс, разница)</span></label>'
   +'<label class="f"><span>Комментарий</span><input type="text" id="fx-c" value="'+esc(ex.comment)+'"></label>'
   +'<datalist id="dl-eq">'+EQUIP.map(g=>'<option value="'+esc(g)+'">').join("")+'</datalist>'
   +'<div class="stack"><button class="btn block" id="fx-save">'+(onSaved?'Сохранить и добавить':'Сохранить')+'</button>'+(isNew?'':'<button class="btn danger block" id="fx-del">Удалить упражнение</button>')+'</div>',
    root=>{
      if (!ex.name) setTimeout(()=>root.querySelector("#fx-name").focus(), 50);
      const selStd = root.querySelector("#fx-std"), nameIn = root.querySelector("#fx-name"), asIn = root.querySelector("#fx-as"), selMu = root.querySelector("#fx-mu");
      let stdTouched = !isNew || !!ex.std, muTouched = !isNew || !!muscle0;
      selStd.onchange = ()=>{ stdTouched = true; drawAnat(); };
      const drawAnat = ()=>{ const m = selMu.value; root.querySelector("#fx-anat").innerHTML = m ? anatomyBlock([m], secondaryFor({name:nameIn.value, std:selStd.value, muscle:m}), {compact:true}) : ''; };
      selMu.onchange = ()=>{ muTouched = true; drawAnat(); };
      const auto = ()=>{
        if (!stdTouched){ selStd.value = guessStd(nameIn.value); asIn.checked = guessAssisted(nameIn.value+" "+root.querySelector("#fx-eq").value); }
        if (!muTouched){ selMu.value = assignMuscle({name:nameIn.value, std:selStd.value, assisted:asIn.checked}) || ""; drawAnat(); }
      };
      nameIn.addEventListener("input", auto); root.querySelector("#fx-eq").addEventListener("input", auto); if (isNew && ex.name) auto();
      root.querySelector("#fx-save").onclick = ()=>{
        const name = nameIn.value.trim();
        if (!name){ toast("Введи название"); nameIn.focus(); return; }
        const mu = selMu.value;
        const data = {name, muscle:mu, group:mu ? groupOfMuscle(mu) : (ex.group || ""), equipment:root.querySelector("#fx-eq").value.trim(), reps:rangeText(parseRange(root.querySelector("#fx-reps").value)), weight:toNum(root.querySelector("#fx-w").value), comment:root.querySelector("#fx-c").value.trim(), std:selStd.value, assisted:asIn.checked, unilateral:root.querySelector("#fx-uni").checked, stdChecked:true};
        let saved; if (isNew){ saved = Object.assign({id:uid()}, data); S.catalog.push(saved); } else { Object.assign(ex, data); saved = ex; }
        touchMeta(); closeSheet();
        if (onSaved) onSaved(saved); else { hooks.render(); toast(isNew ? "Упражнение добавлено" : "Изменения сохранены"); }
      };
      const del = root.querySelector("#fx-del");
      if (del) del.onclick = ()=> askConfirm("Удалить «"+ex.name+"» из каталога? Записи в истории останутся.", "Удалить", ()=>{ S.catalog = S.catalog.filter(x=>x.id!==ex.id); if (ui.progEx===ex.id) ui.progEx = null; touchMeta(); hooks.render(); toast("Упражнение удалено"); });
    });
}

Object.assign(actions, {
  catGroup: el=>{ ui.catGroup = el.dataset.g; ui.catMuscle = ""; ui.anatView = null; hooks.render(); window.scrollTo(0, 0); },
  catMuscle: el=>{ ui.catMuscle = el.dataset.m; ui.anatView = null; hooks.render(); window.scrollTo(0, 0); },
  catBack: ()=>{ if (ui.catMuscle) ui.catMuscle = ""; else ui.catGroup = ""; ui.anatView = null; hooks.render(); window.scrollTo(0, 0); },
  catEquip: el=>{ ui.catEquip = el.dataset.v; hooks.render(); },
  hideRecent: el=>{ prefs.hidden[el.dataset.id] = Date.now(); savePrefs(); hooks.render(); toast("Скрыто из недавних"); },
  newEx: el=>exForm(null, el && el.dataset && el.dataset.m ? {muscle:el.dataset.m} : null),
  editEx: el=>exForm(S.catalog.find(x=>x.id===el.dataset.id)),
  exCard: el=>exCard(S.catalog.find(x=>x.id===el.dataset.id))
});
