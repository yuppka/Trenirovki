/* Общий реестр действий (data-act → функция). Экраны регистрируют свои действия,
   app.js разбирает клики. Из шторки действия вызываются напрямую: act("name", {data}). */
export const actions = {};
export const act = (name, data = {}) => { const f = actions[name]; if (f) f({dataset:data}); };
