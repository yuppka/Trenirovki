/* ИИ-разбор (без изменений из v1). */
import { curBW, ageMonths, effFreq, reportFor } from './calc.js';
import { S, touchWorkout } from './store.js';
import { parseYmd, fmtNum } from './util.js';
import { lvName } from './data.js';
/* ===== ИИ-разбор: внутри claude.ai через аккаунт зрителя, на своём сайте — через личный API-ключ ===== */
export let aiSample = null;
export const setAiSample = sm => { aiSample = sm; };
export const LS_AIKEY = "wd.aikey";
export const getKey = () => { try{ return localStorage.getItem(LS_AIKEY) || ""; }catch(e){ return ""; } };
export const aiMode = () => aiSample ? "claude" : getKey() ? "key" : "";
export function aiPrompt(w, r){
  const p = S.profile, bw = curBW();
  const data = {
    дата: w.date,
    профиль: {пол: p.sex==="f"?"женский":p.sex==="m"?"мужской":"не указан", возраст: p.age||null, вес_тела: bw, стаж_мес: p.start?Math.round(ageMonths(parseYmd(w.date).getTime())):null, есть_прошлый_опыт: !!p.returning, тренировок_в_неделю: fmtNum(effFreq())},
    подходов: r.done+" из "+r.total, рекордов: r.prs,
    упражнения: r.items.map(i=> i.skipped ? {название:i.name, не_выполнено:true} : {название:i.name, группа:i.group, подходы_вес_x_повторы:i.sets, расчётный_1ПМ: i.assisted?null:Math.round(i.cur*10)/10, помощь_гравитрона_кг: i.assisted?i.cur:null, изменение_к_прошлому: i.delta===null?"первый раз":Math.round(i.delta*10)/10, рекорд:i.pr, плато:i.plateau, уровень: i.lv?lvName(i.lv.idx):null, цель_на_следующую: i.next ? i.next.weight+" кг × "+i.next.reps+(i.next.up?" (повышение веса)":"") : null}),
    подходов_по_группам_сегодня: r.groupsToday, подходов_по_группам_за_7_дней: r.week, замечания_приложения: r.signals
  };
  return "Ты — внимательный тренер по силовым тренировкам. Ниже данные одной завершённой тренировки из дневника (уже посчитанные приложением). "
   + "Напиши короткий разбор на русском, обращаясь на «ты», без воды и общих фраз, опираясь только на эти цифры. Формат — три блока, каждый с новой строки начинается с заголовка:\n"
   + "Что получилось: 1–2 предложения.\nНа что обратить внимание: 1–3 пункта через «— ».\nНа следующую тренировку: 1–3 конкретных действия через «— » (веса и повторы бери из «цель_на_следующую»).\n"
   + "Не давай медицинских советов, не выдумывай упражнений и цифр, которых нет в данных. Максимум 120 слов.\n\nДанные:\n" + JSON.stringify(data, null, 1);
}
export async function runAI(w, out, btn){
  const r = reportFor(w), prompt = aiPrompt(w, r);
  btn.disabled = true; out.hidden = false; out.textContent = "Думаю…";
  try{
    let text = "";
    if (aiSample){
      const res = await aiSample(prompt, {onText:({text:t})=>{ out.textContent = t; }, cache:false});
      text = res.text;
    } else {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {method:"POST", headers:{"content-type":"application/json","x-api-key":getKey(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-haiku-4-5-20251001", max_tokens:700, messages:[{role:"user", content:prompt}]})});
      if (!resp.ok){ const err = resp.status===401 ? "Ключ API не подходит — проверь его в настройках." : resp.status===429 ? "Слишком много запросов, попробуй через минуту." : resp.status===400 ? "Запрос отклонён (возможно, на счёте API нет средств)." : "Ошибка API: "+resp.status; throw {code:"http", message:err}; }
      const data = await resp.json();
      text = (data.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n").trim();
    }
    if (!text) throw {code:"empty", message:"Пустой ответ, попробуй ещё раз."};
    w.ai = {text, at:Date.now()}; touchWorkout(w); out.textContent = text; btn.textContent = "Обновить разбор";
  }catch(e){
    const msg = e && e.code === "not_granted" ? "Доступ к Claude не разрешён." : e && e.code === "rate_limited" ? "Лимит запросов, попробуй позже." : (e && e.message) || "Не получилось, проверь интернет.";
    out.textContent = (e && e.text) ? e.text + "\n\n(" + msg + ")" : msg;
  }finally{ btn.disabled = false; }
}
