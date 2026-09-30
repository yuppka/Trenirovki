/* Утилиты (без изменений из v1). */
/* ===== утилиты ===== */
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
export const clone = o => JSON.parse(JSON.stringify(o));
export const pad = n => String(n).padStart(2,"0");
export const ymd = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
export const parseYmd = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
export const fmtNum = (n,dg=1) => (n === "" || n == null || isNaN(n)) ? "—" : Number(n).toLocaleString("ru-RU",{maximumFractionDigits:dg});
export const cap = t => t.charAt(0).toUpperCase()+t.slice(1);
export const fmtTitle = s => { const d = parseYmd(s), now = new Date(); return d.toLocaleDateString("ru-RU", d.getFullYear()===now.getFullYear() ? {day:"numeric",month:"long"} : {day:"numeric",month:"long",year:"numeric"}); };
export const fmtWeekday = s => cap(parseYmd(s).toLocaleDateString("ru-RU",{weekday:"long"}));
export const toNum = v => { if (v === "" || v == null) return ""; const n = parseFloat(String(v).replace(",",".")); return isNaN(n) ? "" : n; };
export const today = () => ymd(new Date());
export const r05 = x => Math.round(x*2)/2;
export const DAY = 864e5, MONTH = 30.44*DAY;
export function parseRange(v){
  const m = String(v||"").match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (m){ const a = +m[1], b = +m[2]; return a<=b ? [a,b] : [b,a]; }
  const n = parseInt(v,10); if (!isNaN(n) && n>0) return [n, n+3];
  return [8,12];
}
export const rangeText = r => r[0]+"–"+r[1];
export const e1rm = (w,r) => { w = Number(w)||0; r = Number(r)||0; if (!w || !r) return 0; return r === 1 ? w : w*(1+Math.min(r,15)/30); };
export const workW = (e, reps) => r05(e/(1+reps/30));
export const monthsWord = n => { n = Math.max(1, Math.round(n)); const a = n%10, b = n%100; return n+" "+(a===1&&b!==11?"месяц":(a>=2&&a<=4&&(b<12||b>14))?"месяца":"месяцев"); };
