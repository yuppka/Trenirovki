/* Справочник мышц — единственное место, где описана структура каталога и анатомическая схема.
   Новая мышца или упражнение не требуют правки вёрстки: группы, экраны каталога и подсветка строятся отсюда.
   view: front | back | both — какой вид схемы показывать; regions — id областей в SVG (src/ui/anatomy.js);
   where — где мышца находится (короткая анатомически точная фраза);
   hue — оттенок мышцы на схеме: у каждой мышцы свой, соседние отличаются минимум на ~40°. */

export const MUSCLE_GROUPS = [
  {id:"arms", name:"Руки", art:"muscle-arms.jpg"},
  {id:"back", name:"Спина", art:"muscle-back.jpg"},
  {id:"chest", name:"Грудь", art:"muscle-chest.jpg"},
  {id:"legs", name:"Ноги", art:"muscle-legs.jpg"},
  {id:"shoulders", name:"Плечи", art:"muscle-shoulders.jpg"},
  {id:"core", name:"Пресс", art:"muscle-core.jpg"}
];

export const MUSCLES = {
  biceps:      {name:"Бицепс", group:"Руки", hue:130, view:"front", regions:["biceps"], where:"Передняя поверхность плеча, между плечевым суставом и локтем"},
  triceps:     {name:"Трицепс", group:"Руки", hue:215, view:"back", regions:["triceps"], where:"Задняя поверхность плеча, от плечевого сустава до локтя"},
  forearms:    {name:"Предплечья", group:"Руки", hue:175, view:"both", regions:["forearms"], where:"От локтя до запястья, по передней и задней поверхности"},
  lats:        {name:"Широчайшие", group:"Спина", hue:270, view:"back", regions:["lats"], where:"Боковые и нижние отделы спины, от подмышек до поясницы"},
  rhomboids:   {name:"Ромбовидные", group:"Спина", hue:320, view:"back", regions:["rhomboids"], where:"Между позвоночником и лопатками, под трапециевидной мышцей"},
  traps:       {name:"Трапеции", group:"Спина", hue:85, view:"back", regions:["traps"], where:"Задняя поверхность шеи и верхняя половина спины, от затылка до нижних грудных позвонков"},
  erectors:    {name:"Разгибатели спины", group:"Спина", hue:160, view:"back", regions:["erectors"], where:"Вдоль позвоночника с обеих сторон, сильнее всего — в пояснице"},
  chest_upper: {name:"Верх груди", group:"Грудь", hue:200, view:"front", regions:["chest_upper"], where:"Ключичная часть большой грудной мышцы, сразу под ключицей"},
  chest_mid:   {name:"Середина груди", group:"Грудь", hue:300, view:"front", regions:["chest_mid"], where:"Грудино-рёберная часть большой грудной мышцы, центр груди"},
  chest_lower: {name:"Низ груди", group:"Грудь", hue:250, view:"front", regions:["chest_lower"], where:"Нижние пучки большой грудной мышцы, нижний край груди"},
  quads:       {name:"Квадрицепс", group:"Ноги", hue:110, view:"front", regions:["quads"], where:"Передняя поверхность бедра, от таза до колена"},
  hamstrings:  {name:"Бицепс бедра", group:"Ноги", hue:60, view:"back", regions:["hamstrings"], where:"Задняя поверхность бедра, от седалищной кости до колена"},
  glutes:      {name:"Ягодицы", group:"Ноги", hue:290, view:"back", regions:["glutes"], where:"Ягодичная область, задняя поверхность таза"},
  adductors:   {name:"Приводящие", group:"Ноги", hue:185, view:"front", regions:["adductors"], where:"Внутренняя поверхность бедра"},
  abductors:   {name:"Отводящие", group:"Ноги", hue:15, view:"both", regions:["abductors"], where:"Наружная поверхность таза и верхней части бедра"},
  calves:      {name:"Икры", group:"Ноги", hue:230, view:"back", regions:["calves"], where:"Задняя поверхность голени, от колена до пятки"},
  delt_front:  {name:"Передняя дельта", group:"Плечи", hue:355, view:"front", regions:["delt_front"], where:"Передняя часть плечевого сустава"},
  delt_side:   {name:"Средняя дельта", group:"Плечи", hue:35, view:"front", regions:["delt_side"], where:"Наружная (боковая) часть плечевого сустава"},
  delt_rear:   {name:"Задняя дельта", group:"Плечи", hue:335, view:"back", regions:["delt_rear"], where:"Задняя часть плечевого сустава"},
  abs:         {name:"Пресс", group:"Пресс", hue:55, view:"front", regions:["abs","obliques"], where:"Передняя и боковые стенки живота"}
};
export const musclesOf = groupName => Object.entries(MUSCLES).filter(([, m])=>m.group === groupName).map(([id])=>id);
export const groupOfMuscle = id => (MUSCLES[id] && MUSCLES[id].group) || "";

/* основная мышца по эталону упражнения */
const BY_STD = {
  bench:"chest_mid", chest_press:"chest_mid", db_bench:"chest_mid", smith_bench:"chest_mid", machine_fly:"chest_mid", cable_fly:"chest_mid",
  incline_bench:"chest_upper",
  lat_pulldown:"lats", reverse_grip_pulldown:"lats", straight_arm_pulldown:"lats",
  seated_cable_row:"rhomboids", machine_row:"rhomboids", bent_row:"rhomboids", pendlay_row:"rhomboids", tbar_row:"rhomboids", db_row:"rhomboids", one_arm_cable_row:"rhomboids",
  deadlift:"erectors",
  machine_reverse_fly:"delt_rear", db_reverse_fly:"delt_rear",
  ohp:"delt_front", db_shoulder_press:"delt_front", seated_db_press:"delt_front", arnold_press:"delt_front", push_press:"delt_front",
  db_lateral:"delt_side", machine_lateral:"delt_side", cable_lateral:"delt_side", upright_row:"delt_side",
  cable_curl:"biceps", machine_curl:"biceps", dumbbell_curl:"biceps", hammer_curl:"biceps", barbell_curl:"biceps", ez_curl:"biceps", cable_hammer_curl:"biceps",
  reverse_curl_db:"forearms", zottman:"forearms",
  tricep_pushdown:"triceps", tricep_rope:"triceps", lying_tricep_ext:"triceps", tricep_ext:"triceps", reverse_pushdown:"triceps", seated_dip_machine:"triceps",
  squat:"quads", sled_leg_press:"quads", horiz_leg_press:"quads", leg_extension:"quads",
  lying_leg_curl:"hamstrings", seated_leg_curl:"hamstrings", rdl:"hamstrings", db_deadlift:"hamstrings",
  hip_thrust:"glutes", cable_pull_through:"glutes",
  machine_crunch:"abs"
};
/* по названию (для упражнений без эталона и добавленных вручную); порядок важен */
const BY_NAME = [
  [/шраг/,"traps"],
  [/гир[ия]|махи? гир/,"glutes"],
  [/сведени.*ног|приведени.*ног|приводящ/,"adductors"],
  [/разведени.*ног|отведени.*ног|отводящ/,"abductors"],
  [/носк|икр/,"calves"],
  [/гиперэкстенз|разгибани.*спин/,"erectors"],
  [/брусь|отжимани.*брус|голов.*вниз|наклон.*вниз|decline/,"chest_lower"],
  [/наклонн/,"chest_upper"],
  [/подтягиван|верхн.*блок|вертикальн.*блок|тяга сверху/,"lats"],
  [/спин.*сведени|сведени.*спин|тяга/,"rhomboids"],
  [/сведени.*гантел|груд|жим.*лёж|жим.*леж|бабочк.*груд|кроссовер/,"chest_mid"],
  [/задн.*дельт|в наклоне.*развед|развед.*наклон|обратн.*бабочк|бабочк/,"delt_rear"],
  [/в сторон|мах/,"delt_side"],
  [/плеч|армейск|жим.*стоя|жим.*сид|арнольд/,"delt_front"],
  [/предплеч|запяст|кист|зоттман|обратн.*сгибан/,"forearms"],
  [/трицепс|французск|разгибани.*(блок|трос|из-за)/,"triceps"],
  [/бицепс|сгибани.*(гантел|штанг|ez|блок|трос)|молотк|скотт/,"biceps"],
  [/выпад|присед|жим ног|разгибани.*ног/,"quads"],
  [/сгибани.*ног|румынск/,"hamstrings"],
  [/ягодич|мост|между ног/,"glutes"],
  [/пресс|скручиван|планк|подъём.*ног|подъем.*ног/,"abs"]
];
const BY_GROUP = {"Бицепс":"biceps", "Трицепс":"triceps", "Руки":"biceps", "Предплечья":"forearms", "Грудь":"chest_mid", "Спина":"lats", "Плечи":"delt_front", "Ноги":"quads", "Пресс":"abs"};

/* мышца упражнения: явно заданная → по эталону (с поправкой на старую группу) → по названию → по старой группе */
export function assignMuscle(ex){
  if (ex.muscle && MUSCLES[ex.muscle]) return ex.muscle;
  const n = String(ex.name || "").toLowerCase().replace(/ё/g, "е"), g = ex.group || "";
  if (ex.std === "cable_reverse_fly") return g === "Спина" ? "rhomboids" : "delt_rear";
  if (ex.assisted && /брусь/.test(n)) return "chest_lower";
  if (ex.assisted) return "lats";
  if (ex.std && BY_STD[ex.std]) return BY_STD[ex.std];
  for (const [re, m] of BY_NAME) if (re.test(n)) return m;
  return BY_GROUP[g] || "";
}

/* вспомогательные мышцы (для подсветки в карточке упражнения) — только общепринятые */
const SECONDARY_STD = {
  bench:["triceps","delt_front"], chest_press:["triceps","delt_front"], db_bench:["triceps","delt_front"], smith_bench:["triceps","delt_front"],
  incline_bench:["delt_front","triceps"], machine_fly:["delt_front"], cable_fly:["delt_front"],
  lat_pulldown:["biceps","rhomboids"], reverse_grip_pulldown:["biceps"], straight_arm_pulldown:["triceps"],
  seated_cable_row:["lats","biceps","delt_rear"], machine_row:["lats","delt_rear"], bent_row:["lats","biceps","erectors"], pendlay_row:["lats","erectors"],
  tbar_row:["lats","biceps"], db_row:["lats","biceps"], one_arm_cable_row:["lats","biceps"],
  deadlift:["glutes","hamstrings","traps"], rdl:["glutes","erectors"], db_deadlift:["glutes","erectors"],
  squat:["glutes","adductors"], sled_leg_press:["glutes"], horiz_leg_press:["glutes"], hip_thrust:["hamstrings"], cable_pull_through:["hamstrings"],
  ohp:["triceps","delt_side"], db_shoulder_press:["triceps","delt_side"], seated_db_press:["triceps","delt_side"], arnold_press:["delt_side","triceps"], push_press:["triceps","quads"],
  upright_row:["traps"], machine_reverse_fly:["rhomboids"], db_reverse_fly:["rhomboids"], cable_reverse_fly:["rhomboids"],
  hammer_curl:["forearms"], cable_hammer_curl:["forearms"], reverse_curl_db:["biceps"], zottman:["biceps"],
  seated_dip_machine:["chest_lower"]
};
export function secondaryFor(ex){
  if (!ex) return [];
  const m = assignMuscle(ex);
  if (ex.std && SECONDARY_STD[ex.std]) return SECONDARY_STD[ex.std].filter(x=>x !== m);
  const n = String(ex.name || "").toLowerCase();
  if (m === "chest_lower") return ["triceps","delt_front"];
  if (m === "lats" && /подтягив|гравитрон/.test(n)) return ["biceps","rhomboids"];
  if (m === "glutes" && /гир/.test(n)) return ["hamstrings","erectors"];
  if (m === "quads" && /выпад/.test(n)) return ["glutes"];
  if (m === "traps") return ["forearms"];
  if (m === "erectors") return ["glutes","hamstrings"];
  return [];
}
