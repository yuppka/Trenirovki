/* Каталог: лента арт-карточек групп мышц, поиск, недавние упражнения (чипы + карточки
   с рабочим весом и «×» скрытия), полный список и форма упражнения (как в v1). */
import { S, touchMeta } from '../../core/store.js';
import { allGroups } from '../../core/training.js';
import { STD, EQUIP, guessStd, guessAssisted } from '../../core/data.js';
import { $, esc, fmtNum, uid, toNum, rangeText, parseRange } from '../../core/util.js';
import { hooks } from '../../core/hooks.js';
import { ui, prefs, savePrefs } from '../state.js';
import { topbar, tabLink, art, emptyState } from '../components.js';
import { I } from '../icons.js';
import { openSheet, closeSheet, toast, askConfirm } from '../sheet.js';
import { recentExercises, workingWeight, groupArt } from '../derive.js';
import { actions } from '../actions.js';

export function viewCatalog(){
  let h = topbar({plus:{act:"newEx", label:"Новое упражнение"}, tabs:[tabLink("Главная", "today"), tabLink("Каталог", "catalog", true)]});
  h += '<div class="section-head"><h2 class="h2">Группы мышц '+I.chev.replace('class="chev"','class="chev" style="vertical-align:-2px"')+'</h2></div>';
  h += '<div class="group-rail" role="group" aria-label="Группа мышц">'+allGroups().map(g=>'<button class="art-card'+(ui.catGroup===g?' on':'')+'" data-st data-act="catGroup" data-g="'+esc(g)+'" aria-pressed="'+(ui.catGroup===g)+'">'+art(groupArt(g))+'<span class="label">'+esc(g)+'</span></button>').join("")+'</div>';
  h += '<div class="search" style="margin:14px 0 4px">'+I.search+'<input type="search" id="catq" placeholder="Поиск по названию" value="'+esc(ui.catQuery)+'" aria-label="Поиск упражнения" enterkeyhint="search"></div>';

  const rec = recentExercises(4);
  h += '<section class="section"><h2 class="h2" style="margin-bottom:12px">Последние упражнения</h2>';
  if (!rec.length) h += '<div class="card flat">'+emptyState("Недавних нет", "Упражнения появятся здесь после тренировки.")+'</div>';
  else {
    h += '<div class="rec-grid"><div class="chip-col">'+rec.map(ex=>'<button class="chip" data-act="editEx" data-id="'+ex.id+'">'+I.search.replace('<svg','<svg style="width:13px;height:13px"')+'<span>'+esc(ex.name)+'</span></button>').join("")
      + '<button class="chip inverse" data-act="catAll">Все упражнения</button></div><div>'
      + rec.slice(0, 2).map(ex=>{ const ww = workingWeight(ex); return '<div style="position:relative"><button class="wcard" data-act="progEx" data-id="'+ex.id+'"><span class="cap">'+esc(ex.name)+'</span><div class="num">'+(ww === null ? '—' : fmtNum(ww))+(ww === null ? '' : '<small>кг</small>')+'</div></button>'
        + '<button class="pill-x wcard-x" data-act="hideRecent" data-id="'+ex.id+'" aria-label="Скрыть «'+esc(ex.name)+'» из недавних">'+I.x+'</button></div>'; }).join("")+'</div></div>';
  }
  h += '</section>';
  h += '<section class="section" id="cat-all"><div class="section-head"><h2 class="h2">Все упражнения</h2><span class="muted small" id="catcount"></span></div>';
  if (ui.catGroup) h += '<div class="filter-note">Группа: <b style="color:var(--text)">'+esc(ui.catGroup)+'</b><button class="chip" style="min-height:32px;padding:0 10px" data-act="catGroup" data-g="'+esc(ui.catGroup)+'" aria-label="Сбросить фильтр">'+I.x+'</button></div>';
  return h + '<div id="catlist"></div></section>';
}

export function renderCatList(){
  const box = $("#catlist"); if (!box) return;
  const q = ui.catQuery.trim().toLowerCase();
  const list = S.catalog.filter(x=>(!ui.catGroup || x.group===ui.catGroup) && (!q || x.name.toLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name,"ru"));
  const cnt = $("#catcount"); if (cnt) cnt.textContent = list.length ? String(list.length) : "";
  if (!S.catalog.length){ box.innerHTML = '<div class="card">'+emptyState("Каталог пуст", "Добавь первое упражнение.", '<button class="btn" data-act="newEx">+ Упражнение</button>')+'</div>'; return; }
  box.innerHTML = list.length ? list.map(x=>'<button class="item" data-st data-act="editEx" data-id="'+x.id+'"><div class="grow"><div class="t">'+esc(x.name)+'</div><div class="s">'+esc([x.group,x.equipment].filter(Boolean).join(" · "))+'</div><div class="c">'+esc(x.reps)+' повт.'+(x.std&&STD[x.std]?' · эталон: '+esc(STD[x.std].label):x.assisted?' · с противовесом':' · без эталона')+'</div>'+(x.comment?'<div class="c">'+esc(x.comment)+'</div>':'')+'</div>'+I.chev+'</button>').join("")
    : '<div class="card flat">'+emptyState("Ничего не найдено", "Измени запрос или фильтр.")+'</div>';
}

export function exForm(ex, prefill, onSaved){
  const isNew = !ex; ex = ex || Object.assign({name:"",group:ui.catGroup||"",equipment:"",reps:"8–12",weight:"",comment:"",std:"",assisted:false}, prefill||{});
  openSheet(isNew ? "Новое упражнение" : "Упражнение",
    '<label class="f"><span>Название</span><input type="text" id="fx-name" value="'+esc(ex.name)+'"></label>'
   +'<div class="kv"><label class="f"><span>Группа мышц</span><input type="text" id="fx-group" list="dl-groups" value="'+esc(ex.group)+'"></label><label class="f"><span>Оборудование</span><input type="text" id="fx-eq" list="dl-eq" value="'+esc(ex.equipment)+'"></label></div>'
   +'<div class="kv"><label class="f"><span>Диапазон повторов</span><input type="text" id="fx-reps" value="'+esc(ex.reps)+'" placeholder="8–12"></label><label class="f"><span>Стартовый вес, кг</span><input type="number" inputmode="decimal" step="any" id="fx-w" value="'+esc(ex.weight)+'"></label></div>'
   +'<label class="f"><span>Эталон для уровня и прогноза</span><select id="fx-std"><option value="">Нет — только личный прогресс</option>'+Object.entries(STD).sort((a,b)=>a[1].label.localeCompare(b[1].label,"ru")).map(([k,v])=>'<option value="'+k+'"'+(ex.std===k?' selected':'')+'>'+esc(v.label)+'</option>').join("")+'</select></label>'
   +'<label class="check"><input type="checkbox" id="fx-as"'+(ex.assisted?' checked':'')+'><span>Тренажёр с противовесом (гравитрон): меньше вес — лучше результат</span></label>'
   +'<label class="f"><span>Комментарий</span><input type="text" id="fx-c" value="'+esc(ex.comment)+'"></label>'
   +'<datalist id="dl-groups">'+allGroups().map(g=>'<option value="'+esc(g)+'">').join("")+'</datalist><datalist id="dl-eq">'+EQUIP.map(g=>'<option value="'+esc(g)+'">').join("")+'</datalist>'
   +'<div class="stack"><button class="btn block" id="fx-save">'+(onSaved?'Сохранить и добавить':'Сохранить')+'</button>'+(isNew?'':'<button class="btn danger block" id="fx-del">Удалить упражнение</button>')+'</div>',
    root=>{
      if (!ex.name) setTimeout(()=>root.querySelector("#fx-name").focus(), 50);
      const selStd = root.querySelector("#fx-std"), nameIn = root.querySelector("#fx-name"), asIn = root.querySelector("#fx-as");
      let stdTouched = !isNew || !!ex.std; selStd.onchange = ()=>{ stdTouched = true; };
      const autoStd = ()=>{ if (stdTouched) return; selStd.value = guessStd(nameIn.value); asIn.checked = guessAssisted(nameIn.value+" "+root.querySelector("#fx-eq").value); };
      nameIn.addEventListener("input", autoStd); root.querySelector("#fx-eq").addEventListener("input", autoStd); if (isNew && ex.name) autoStd();
      root.querySelector("#fx-save").onclick = ()=>{
        const name = root.querySelector("#fx-name").value.trim();
        if (!name){ toast("Введи название"); root.querySelector("#fx-name").focus(); return; }
        const data = {name, group:root.querySelector("#fx-group").value.trim(), equipment:root.querySelector("#fx-eq").value.trim(), reps:rangeText(parseRange(root.querySelector("#fx-reps").value)), weight:toNum(root.querySelector("#fx-w").value), comment:root.querySelector("#fx-c").value.trim(), std:root.querySelector("#fx-std").value, assisted:root.querySelector("#fx-as").checked, stdChecked:true};
        let saved; if (isNew){ saved = Object.assign({id:uid()}, data); S.catalog.push(saved); } else { Object.assign(ex, data); saved = ex; }
        touchMeta(); closeSheet();
        if (onSaved) onSaved(saved); else { hooks.render(); toast(isNew ? "Упражнение добавлено" : "Изменения сохранены"); }
      };
      const del = root.querySelector("#fx-del");
      if (del) del.onclick = ()=> askConfirm("Удалить «"+ex.name+"» из каталога? Записи в истории останутся.", "Удалить", ()=>{ S.catalog = S.catalog.filter(x=>x.id!==ex.id); if (ui.progEx===ex.id) ui.progEx = null; touchMeta(); hooks.render(); toast("Упражнение удалено"); });
    });
}

Object.assign(actions, {
  catGroup: el=>{ ui.catGroup = ui.catGroup === el.dataset.g ? "" : el.dataset.g; hooks.render(); },
  catAll: ()=>{ ui.catGroup = ""; ui.catQuery = ""; hooks.render(); document.getElementById("cat-all")?.scrollIntoView({block:"start"}); },
  hideRecent: el=>{ prefs.hidden[el.dataset.id] = Date.now(); savePrefs(); hooks.render(); toast("Скрыто из недавних"); },
  newEx: ()=>exForm(null),
  editEx: el=>exForm(S.catalog.find(x=>x.id===el.dataset.id))
});
