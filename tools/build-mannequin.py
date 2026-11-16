# Сборка манекена для приложения «Тренировки» из Z-Anatomy (CC BY-SA 4.0).
# Вход: MuscularSystem100.fbx, Regions of human body100.fbx. Выход: GLB с 20 мышцами-объектами (id из src/core/muscles.js) и нейтральным _body.
import bpy, sys, re, json
from mathutils import Vector
a = sys.argv[sys.argv.index("--")+1:]
muscles_fbx, regions_fbx, out_glb, out_json = a[0], a[1], a[2], a[3]

MAP = [
 ("chest_upper", r"^clavicular head of pectoralis major"),
 ("chest_mid",   r"^sternocostal head of pectoralis major"),
 ("chest_lower", r"abdominal part of pectoralis major"),
 ("delt_front",  r"^clavicular part of deltoid"),
 ("delt_side",   r"^acromial part of deltoid"),
 ("delt_rear",   r"^scapular spinal part of deltoid"),
 ("biceps",      r"head of biceps brachii$|^brachialis muscle$"),
 ("triceps",     r"head of triceps brachii$|^anconeus"),
 ("forearms",    r"^brachioradialis|^extensor carpi|^extensor digitorum$|^extensor digiti minimi$|head of extensor carpi ulnaris$|^flexor carpi radialis$|head of flexor carpi ulnaris$|^palmaris longus|head of flexor digitorum superficialis$|^flexor digitorum profundus$|^flexor pollicis longus$|head of pronator teres$|^supinator$|^abductor pollicis longus$|^extensor pollicis (brevis|longus)$|^extensor indicis$|^pronator quadratus$"),
 ("lats",        r"^latissimus dorsi|^teres major"),
 ("rhomboids",   r"^rhomboid (major|minor)"),
 ("traps",       r"part of trapezius muscle$"),
 ("erectors",    r"^iliocostalis (lumborum|thoracis)|^longissimus thoracis|^spinalis thoracis|^multifidus lumborum"),
 ("abs",         r"^rectus abdominis|^external abdominal oblique|^pyramidalis"),
 ("quads",       r"^rectus femoris|^vastus (lateralis|medialis|intermedius)"),
 ("hamstrings",  r"head of biceps femoris$|^semitendinosus|^semimembranosus muscle"),
 ("glutes",      r"^gluteus maximus"),
 ("adductors",   r"^adductor (longus|brevis|magnus)$|adductor minimus|^gracilis|^pectineus"),
 ("abductors",   r"^gluteus (medius|minimus)|^tensor fasciae latae"),
 ("calves",      r"head of gastrocnemius$|^soleus"),
]
SKIP = re.compile(r"bursa|fascia(?! latae)|septum|sheath|retinaculum|aponeurosis|ligament|cross section|tarsus|arch|ring|trochlea|diaphragm|linea alba|intercostal|arytenoid|pharyng|crico|thyro|gloss|hyoid|palpebrae|iliotibial|transversus|transversalis|internal abdominal|psoas|iliacus|quadratus lumborum|coccyg|anal|pubo|levator ani|obturator|gemellus|piriformis|quadratus femoris|subscapularis|costarum|rotatores|intertransversarii|interspinales|pterygoid|rectus muscle$|oblique muscle$|capitis|colli|scalenus|digastric|platysma|tendon of|subclavius|pectoralis minor")
TARGET = {"abs":4200, "lats":3600, "traps":3200, "quads":3600, "forearms":4200, "hamstrings":2800, "calves":2800, "adductors":2600, "abductors":2000,
          "glutes":1600, "biceps":2000, "triceps":2200, "erectors":2200, "rhomboids":800, "chest_upper":700, "chest_mid":1800, "chest_lower":700,
          "delt_front":900, "delt_side":900, "delt_rear":900, "_body":11000, "_skin":7000}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=muscles_fbx)
musc = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.import_scene.fbx(filepath=regions_fbx)
skin = [o for o in bpy.data.objects if o.type == 'MESH' and o not in musc]

def bbox(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return [min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]
def zone(o):
    mn, mx = bbox(o); cz = (mn[2]+mx[2])/2; ax = min(abs(mn[0]), abs(mx[0]))
    if cz >= 1.50: return "head"
    if mx[2] <= 0.875 and ax >= 0.19: return "hand"
    if mx[2] <= 0.135: return "foot"
    return ""

groups, report = {}, {}
for o in musc:
    if not o.data.polygons: continue
    base = re.sub(r"\.(l|r)(\.\d+)?$", "", o.name).strip().lower()
    gid = next((g for g, rx in MAP if re.search(rx, base)), None)
    if not gid:
        if SKIP.search(base) or zone(o): continue
        gid = "_body"
    groups.setdefault(gid, []).append(o); report.setdefault(gid, set()).add(base)
for o in skin:
    n = o.name.lower()
    if not o.data.polygons or n.endswith(".j") or re.search(r"hair|eyelash|cross section", n): continue
    if zone(o): groups.setdefault("_skin", []).append(o)

keep = []
for gid, objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ob.name = gid; ob.data.name = gid
    for m in list(ob.data.materials): pass
    ob.data.materials.clear()
    # треугольники до упрощения
    before = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=0.0002); bpy.ops.mesh.quads_convert_to_tris(); bpy.ops.object.mode_set(mode='OBJECT')
    ratio = min(1.0, TARGET.get(gid, 2000) / max(1, len(ob.data.polygons)))
    if ratio < 1.0:
        md = ob.modifiers.new("dec", 'DECIMATE'); md.ratio = ratio; bpy.ops.object.modifier_apply(modifier=md.name)
    for attr in list(ob.data.attributes):
        if attr.domain == 'CORNER' and attr.name not in ('.corner_vert', '.corner_edge'):
            try: ob.data.attributes.remove(attr)
            except Exception: pass
    while ob.data.uv_layers: ob.data.uv_layers.remove(ob.data.uv_layers[0])
    for p in ob.data.polygons: p.use_smooth = True
    keep.append(ob)
    mn, mx = bbox(ob)
    report[gid] = {"src": sorted(report.get(gid, [])) if gid != "_skin" else len(objs), "tris_before": before, "tris": len(ob.data.polygons), "verts": len(ob.data.vertices), "min": [round(x, 3) for x in mn], "max": [round(x, 3) for x in mx]}

for o in list(bpy.data.objects):
    if o not in keep: bpy.data.objects.remove(o, do_unlink=True)
# нейтральные части — один объект
bpy.ops.object.select_all(action='DESELECT')
nb = [o for o in keep if o.name in ("_body", "_skin")]
if len(nb) == 2:
    for o in nb: o.select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects["_body"]; bpy.ops.object.join()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=True, export_materials='NONE', export_normals=False, export_texcoords=False, export_apply=True, export_yup=True, export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
json.dump(report, open(out_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("BUILT", {k: v["tris"] for k, v in report.items()}, "TOTAL", sum(v["tris"] for v in report.values()))
