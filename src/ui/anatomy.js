/* Анатомическая схема: вид спереди и сзади, подсветка основной и вспомогательных мышц.
   Всё берётся из справочника src/core/muscles.js (id мышцы → области, вид, «где находится»),
   полигоны — из anatomy-data.js. Цвета — CSS-переменные темы (--anat-*), смена подсветки — только opacity. */
import { ANATOMY } from './anatomy-data.js';
import { MUSCLES } from '../core/muscles.js';
import { esc } from '../core/util.js';
import { ui } from './state.js';
import { actions } from './actions.js';

/* части, которые вырезаются из общих полигонов: грудь — по высоте, дельты — по ширине (внутренняя/наружная часть) */
const CUTS = {
  front:{
    chest_upper:{src:"chest", rects:[[0,0,100,46.6]]},
    chest_mid:{src:"chest", rects:[[0,46.6,100,6]]},
    chest_lower:{src:"chest", rects:[[0,52.6,100,12]]},
    delt_front:{src:"delt", rects:[[24.2,0,51.6,200]]},
    delt_side:{src:"delt", rects:[[0,0,24.2,200],[75.8,0,24.2,200]]}
  },
  back:{
    delt_rear:{src:"delt", rects:[[23.5,0,53,200]]},
    delt_side:{src:"delt", rects:[[0,0,23.5,200],[76.5,0,23.5,200]]}
  }
};
const ORDER = {
  front:["_head","_knees","traps","delt_front","delt_side","chest_upper","chest_mid","chest_lower","biceps","triceps","forearms","obliques","abs","abductors","adductors","quads","calves"],
  back:["_head","_knees","traps","rhomboids","delt_rear","delt_side","lats","erectors","triceps","forearms","abductors","glutes","adductors","hamstrings","calves"]
};
const VIEW_NAME = {front:"спереди", back:"сзади"};
/* область схемы → оттенок её мышцы (у каждой мышцы свой цвет, см. hue в справочнике) */
const REGION_HUE = {};
Object.values(MUSCLES).forEach(m=>m.regions.forEach(r=>{ REGION_HUE[r] = m.hue; }));
const hueOf = id => ' style="--h:'+MUSCLES[id].hue+'"';
let uidSeq = 0;

function regionsOf(ids){ const s = new Set(); ids.forEach(id=>(MUSCLES[id] ? MUSCLES[id].regions : []).forEach(r=>s.add(r))); return s; }

function svgView(view, on, sec, label){
  const uid = "an" + (++uidSeq), cut = CUTS[view];
  let defs = '<defs>';
  Object.entries(cut).forEach(([r, c])=>{ defs += '<clipPath id="'+uid+r+'">'+c.rects.map(([x,y,w,h])=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'"/>').join("")+'</clipPath>'; });
  defs += '</defs>';
  let body = "";
  ORDER[view].forEach(r=>{
    const c = cut[r], pts = c ? ANATOMY[view][c.src] : ANATOMY[view][r];
    if (!pts) return;
    const neutral = r[0] === "_", state = on.has(r) ? " on" : sec.has(r) ? " sec" : "";
    const attr = c ? ' clip-path="url(#'+uid+r+')"' : '';
    /* ромбовидные лежат под трапецией: без подсветки видны только контуром поверх неё */
    const h = REGION_HUE[r];
    body += '<g class="rg'+(neutral ? ' neutral' : '')+(r === "rhomboids" ? ' deep' : '')+state+'" data-r="'+r+'"'+(h != null ? ' style="--h:'+h+'"' : '')+attr+'>'
      + pts.map(p=>'<polygon class="b" points="'+p+'"/>').join("")
      + (neutral ? '' : pts.map(p=>'<polygon class="h" points="'+p+'"/>').join(""))+'</g>';
  });
  return '<figure class="anat-fig" data-view="'+view+'"><svg viewBox="0 0 100 200" role="img" aria-label="'+esc(label+", вид "+VIEW_NAME[view])+'" focusable="false">'+defs+body+'</svg><figcaption>'+(view === "front" ? "Спереди" : "Сзади")+'</figcaption></figure>';
}

/* вид по умолчанию: front/back из справочника; если мышца видна с обеих сторон или основные мышцы на разных видах — оба */
export function defaultView(ids){
  const vs = new Set(ids.map(id=>MUSCLES[id] && MUSCLES[id].view).filter(Boolean));
  if (!vs.size) return "front";
  if (vs.has("both") || vs.size > 1) return "both";
  return [...vs][0];
}

/* блок схемы: цвет — мышца, яркость — участие: primary — основные (ярко), secondary — помогающие (слабее), остальные — бледным тоном своего цвета */
export function anatomyBlock(primary, secondary = [], o = {}){
  primary = primary.filter(id=>MUSCLES[id]); secondary = secondary.filter(id=>MUSCLES[id] && !primary.includes(id));
  if (!primary.length) return "";
  const on = regionsOf(primary), sec = regionsOf(secondary);
  const name = primary.map(id=>MUSCLES[id].name).join(", ");
  const key = primary.join("+"), view = (ui.anatView && ui.anatView.key === key) ? ui.anatView.v : defaultView(primary);
  const where = primary.length === 1 ? MUSCLES[primary[0]].where : "";
  const seg = [["front","Спереди"],["back","Сзади"],["both","Оба"]].map(([v, l])=>'<button type="button" data-act="anatView" data-v="'+v+'" aria-pressed="'+(view === v)+'">'+l+'</button>').join("");
  return '<section class="anat'+(o.compact ? ' compact' : '')+'" data-key="'+esc(key)+'" aria-label="'+esc("Где находится: "+name)+'">'
    + '<div class="seg anat-seg" role="group" aria-label="Вид схемы">'+seg+'</div>'
    + '<div class="anat-views v-'+view+'">'+svgView("front", on, sec, name)+svgView("back", on, sec, name)+'</div>'
    + (primary.length === 1 ? '<p class="anat-where"><span class="dot mh"'+hueOf(primary[0])+'></span><b>'+esc(name)+'</b>'+(where ? ' — '+esc(where) : '')+'</p>' : legend(primary))
    + (secondary.length ? '<p class="anat-where sec">Помогают: '+secondary.map(id=>'<span class="nowrap"><span class="dot mh sec"'+hueOf(id)+'></span>'+esc(MUSCLES[id].name.toLowerCase())+'</span>').join(", ")+'</p>' : '')
    + '</section>';
}

/* легенда: цвет каждой подсвеченной мышцы */
function legend(ids){
  return '<div class="anat-legend" aria-label="Цвета мышц">'+ids.map(id=>'<span class="mh"'+hueOf(id)+'><i></i>'+esc(MUSCLES[id].name)+'</span>').join("")+'</div>';
}

/* переключатель вида — без перерисовки экрана */
actions.anatView = el=>{
  const box = el.closest(".anat"); if (!box) return;
  const v = el.dataset.v, views = box.querySelector(".anat-views");
  views.className = "anat-views v-" + v;
  box.querySelectorAll(".anat-seg button").forEach(b=>b.setAttribute("aria-pressed", b === el));
  ui.anatView = {key:box.dataset.key, v};
};
