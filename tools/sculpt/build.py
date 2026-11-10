"""
以 Blender（背景模式）產生簡化雕像模型：姿勢骨架 + Skin modifier + Subdivision。
姿勢依各作品的正面參考照片手動設定（只取姿勢與持物，不是掃描）。

執行：
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/sculpt/build.py -- public/models/sculpt

座標：Blender Z 向上，人物面向 −Y（匯出 glTF 後面向 +Z），人物的右手在 −X。
單位：雕像高度 = 1（載入時依實際高度縮放）。
"""
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'public/models/sculpt'
os.makedirs(OUT, exist_ok=True)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def apply_mods(obj):
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def skin(name, chains, sub=2, folds=0.0):
    """chains：[[(x,y,z,r), ...], ...]，每條為連續骨段；回傳套用後的網格物件"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    radii = []
    made = []
    for ci, ch in enumerate(chains):
        prev = None
        for k, (x, y, z, r) in enumerate(ch):
            v = bm.verts.new((x, y, z))
            radii.append(r)
            if prev is not None:
                bm.edges.new((prev, v))
            elif ci > 0:
                # 後續骨段的起點接到已建立的最近頂點（四肢接上軀幹），形成單一連通的骨架
                near = min(made, key=lambda u: (u.co - v.co).length)
                bm.edges.new((near, v))
            prev = v
            made.append(v)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    sk = obj.modifiers.new('skin', 'SKIN')
    sk.use_smooth_shade = True
    sk.branch_smoothing = 0.6
    for i, r in enumerate(radii):
        sv = me.skin_vertices[0].data[i]
        sv.radius = r if isinstance(r, tuple) else (r, r)
        if i == 0:
            sv.use_root = True
    ss = obj.modifiers.new('sub', 'SUBSURF')
    ss.levels = sub
    if folds > 0:
        tex = bpy.data.textures.new(name + '_folds', 'STUCCI')
        tex.noise_scale = 0.05
        tex.turbulence = 3.0
        d = obj.modifiers.new('folds', 'DISPLACE')
        d.texture = tex
        d.strength = folds
        d.texture_coords = 'OBJECT'
    apply_mods(obj)
    return obj


def cyl(name, a, b, r, verts=12):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.name = name
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.normalized().to_track_quat('Z', 'Y')
    return o


def box(name, loc, size, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    return o


def cone(name, loc, r, h, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    return o


def cloth(name, corners, waves=3, amp=0.02, res=16):
    """四角定義的布面（聖帕等），沿長邊加波浪；corners: p00, p10, p01, p11"""
    p00, p10, p01, p11 = [Vector(c) for c in corners]
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    grid = []
    for j in range(res + 1):
        row = []
        for i in range(res + 1):
            u, v = i / res, j / res
            p = p00.lerp(p10, u).lerp(p01.lerp(p11, u), v)
            n = (p10 - p00).cross(p01 - p00).normalized()
            p = p + n * amp * math.sin(u * math.pi * waves) * (0.4 + 0.6 * v)
            row.append(bm.verts.new(p))
        grid.append(row)
    for j in range(res):
        for i in range(res):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    s = o.modifiers.new('thick', 'SOLIDIFY')
    s.thickness = 0.012
    apply_mods(o)
    return o


def export(name, objs, target_faces=24000):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    faces = len(o.data.polygons)
    if faces > target_faces:
        dm = o.modifiers.new('dec', 'DECIMATE')
        dm.ratio = target_faces / faces
        apply_mods(o)
    bpy.ops.object.shade_smooth()
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=7, export_materials='NONE', export_normals=True)
    print('exported', name, len(o.data.polygons), 'faces', os.path.getsize(path) // 1024, 'KB')


# ── 共用：著袍站立人體（weight 側、stride 為跨步） ──
def body(arms, legs, head=(0, 0.02, 0.915), tilt=0.0, robe=0.2, stride=0.0):
    hx, hy, hz = head
    torso = [(0, 0, 0.5, (0.11, 0.08)), (0, 0.0, 0.6, (0.1, 0.075)), (0, 0.005, 0.7, (0.13, 0.085)), (0, 0.01, 0.785, (0.15, 0.075)),
             (hx * 0.5, hy * 0.5, 0.84, 0.045), (hx, hy, hz, (0.065, 0.075)), (hx, hy - tilt * 0.3, hz + 0.05, 0.05)]
    chains = [torso]
    chains += arms
    chains += legs
    figure = skin('body', chains, sub=3, folds=0.003)
    # 長袍：腰到下擺逐漸放寬，下擺向跨步方向偏移
    robe_ch = [[(0, 0.0, 0.58, 0.12), (stride * 0.3, -0.01, 0.42, robe * 0.75), (stride * 0.6, -0.02, 0.22, robe * 0.92),
                (stride, -0.03, 0.04, robe)]]
    gown = skin('robe', robe_ch, sub=3, folds=0.012)
    return [figure, gown]


def arm(side, shoulder, elbow, hand, r=(0.042, 0.034, 0.028)):
    s = side
    return [(s * shoulder[0], shoulder[1], shoulder[2], r[0]), (s * elbow[0], elbow[1], elbow[2], r[1]),
            (s * hand[0], hand[1], hand[2], r[2])]


def leg(side, knee, foot):
    return [(side * 0.06, 0.0, 0.47, 0.05), (side * knee[0], knee[1], knee[2], 0.042), (side * foot[0], foot[1], foot[2], 0.036)]


def mantle(points, width=0.07):
    return skin('mantle', [[(x, y, z, r) for (x, y, z, r) in points]], sub=2, folds=0.01)


# ── 聖朗基努斯（貝尼尼）：張開雙臂、右手持長矛、仰望 ──
def longinus():
    clear()
    R, L = -1, 1  # 人物右側在 −X
    objs = body(
        arms=[arm(R, (0.12, 0, 0.8), (0.26, -0.03, 0.87), (0.35, -0.05, 0.96)),
              arm(L, (0.12, 0, 0.8), (0.27, -0.05, 0.77), (0.43, -0.09, 0.75))],
        legs=[leg(R, (0.07, -0.02, 0.26), (0.08, -0.05, 0.02)), leg(L, (0.1, -0.08, 0.28), (0.13, -0.12, 0.03))],
        tilt=0.6, robe=0.2, stride=0.03)
    # 斗篷：由左肩經左手垂到腰側，翻飛的大片布面
    objs.append(cloth('cloak', [(0.12, 0.05, 0.8), (0.42, -0.07, 0.75), (0.13, 0.07, 0.42), (0.36, -0.03, 0.32)], waves=4, amp=0.045))
    objs.append(cloth('drape', [(-0.13, 0.05, 0.79), (-0.05, 0.08, 0.8), (-0.21, 0.05, 0.3), (-0.08, 0.09, 0.25)], waves=3, amp=0.03))
    objs.append(cyl('lance', (-0.37, -0.06, 0.0), (-0.34, -0.05, 1.12), 0.011))
    objs.append(cone('tip', (-0.34, -0.05, 1.15), 0.02, 0.07))
    export('longinus', objs)


# ── 聖安德烈（Duquesnoy）：倚著 X 形十字架、右手扶架、左臂張開 ──
def andrew():
    clear()
    R, L = -1, 1
    objs = body(
        arms=[arm(R, (0.12, 0, 0.8), (0.2, -0.02, 0.92), (0.24, 0.0, 1.04)),
              arm(L, (0.12, 0, 0.8), (0.27, -0.04, 0.68), (0.38, -0.06, 0.58))],
        legs=[leg(R, (0.07, -0.03, 0.26), (0.09, -0.06, 0.02)), leg(L, (0.08, -0.05, 0.27), (0.11, -0.09, 0.03))],
        tilt=0.5, robe=0.19)
    objs.append(cloth('cloak', [(0.12, 0.05, 0.78), (0.38, -0.06, 0.58), (0.12, 0.07, 0.35), (0.34, -0.04, 0.28)], waves=4, amp=0.04))
    # X 形十字架：兩根方木在身後交叉
    objs.append(box('beam1', (-0.02, 0.12, 0.62), (0.075, 0.075, 1.45), (0, math.radians(38), 0)))
    objs.append(box('beam2', (0.02, 0.16, 0.6), (0.075, 0.075, 1.35), (0, math.radians(-40), 0)))
    export('andrew', objs)


# ── 聖維羅妮卡（Mochi）：大步前行、雙手展開聖帕 ──
def veronica():
    clear()
    R, L = -1, 1
    objs = body(
        arms=[arm(R, (0.11, 0, 0.8), (0.04, -0.12, 0.72), (-0.06, -0.14, 0.8)),
              arm(L, (0.11, 0, 0.8), (0.24, -0.06, 0.9), (0.3, -0.06, 1.0))],
        legs=[leg(R, (0.1, -0.08, 0.27), (0.14, -0.14, 0.02)), leg(L, (0.05, 0.04, 0.25), (0.04, 0.08, 0.03))],
        head=(-0.04, 0.0, 0.915), robe=0.21, stride=-0.05)
    objs.append(cloth('veil', [(0.07, -0.15, 0.62), (0.31, -0.08, 0.72), (0.06, -0.14, 0.82), (0.32, -0.06, 1.0)], waves=3, amp=0.03))
    objs.append(cloth('cloak', [(0.08, 0.06, 0.8), (0.2, 0.05, 0.76), (0.12, 0.08, 0.1), (0.27, 0.0, 0.14)], waves=4, amp=0.035))
    export('veronica', objs)


# ── 聖海倫娜（Bolgi）：右手扶巨大十字架、左臂張開，頭戴冠 ──
def helena():
    clear()
    R, L = -1, 1
    objs = body(
        arms=[arm(R, (0.11, 0, 0.8), (0.19, -0.06, 0.7), (0.2, -0.07, 0.8)),
              arm(L, (0.11, 0, 0.8), (0.25, -0.07, 0.74), (0.38, -0.12, 0.72))],
        legs=[leg(R, (0.06, -0.02, 0.26), (0.07, -0.05, 0.02)), leg(L, (0.08, -0.06, 0.27), (0.1, -0.1, 0.03))],
        robe=0.21)
    objs.append(cloth('cloak', [(-0.12, 0.05, 0.79), (0.0, 0.08, 0.8), (-0.2, 0.03, 0.08), (-0.04, 0.06, 0.06)], waves=4, amp=0.035))
    # 十字架：直木在人物右側，橫木在頭上方
    objs.append(box('upright', (-0.22, 0.06, 0.72), (0.06, 0.06, 1.44)))
    objs.append(box('cross', (-0.22, 0.06, 1.18), (0.62, 0.055, 0.055)))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.05, minor_radius=0.01, location=(0, 0.02, 0.975))
    objs.append(bpy.context.active_object)
    export('helena', objs)


# ── 聖彼得青銅像：坐姿，右手祝福，左手持鑰匙 ──
def peter():
    clear()
    R, L = -1, 1
    torso = [(0, 0.04, 0.45, (0.12, 0.1)), (0, 0.04, 0.58, (0.11, 0.08)), (0, 0.035, 0.68, (0.13, 0.085)), (0, 0.03, 0.75, (0.15, 0.075)),
             (0, 0.025, 0.8, 0.045), (0, 0.02, 0.87, (0.065, 0.075)), (0, 0.02, 0.92, 0.05)]
    arms = [arm(R, (0.12, 0.04, 0.75), (0.16, -0.06, 0.62), (0.07, -0.15, 0.73)),
            arm(L, (0.12, 0.04, 0.75), (0.15, -0.05, 0.58), (0.07, -0.17, 0.52))]
    legs = [[(R * 0.07, 0.02, 0.44, 0.06), (R * 0.08, -0.2, 0.44, 0.05), (R * 0.08, -0.24, 0.12, 0.045), (R * 0.08, -0.32, 0.03, 0.04)],
            [(L * 0.07, 0.02, 0.44, 0.06), (L * 0.08, -0.2, 0.44, 0.05), (L * 0.08, -0.22, 0.12, 0.045), (L * 0.08, -0.27, 0.03, 0.04)]]
    fig = skin('body', [torso] + arms + legs, sub=2, folds=0.004)
    # 長袍蓋住腿部：膝上到腳的布幕
    gown = skin('robe', [[(0, 0.0, 0.47, (0.16, 0.1)), (0, -0.16, 0.44, (0.17, 0.08)), (0, -0.22, 0.24, (0.17, 0.08)), (0, -0.25, 0.05, (0.16, 0.08))]], sub=3, folds=0.01)
    objs = [fig, gown]
    # 寶座
    objs.append(box('seat', (0, 0.06, 0.2), (0.5, 0.42, 0.4)))
    objs.append(box('back', (0, 0.27, 0.62), (0.5, 0.06, 0.85)))
    for s in (-1, 1):
        objs.append(box('arm', (s * 0.24, 0.02, 0.5), (0.05, 0.36, 0.06)))
        objs.append(cyl('post', (s * 0.24, 0.27, 0.0), (s * 0.24, 0.27, 1.08), 0.03))
    # 鑰匙（兩把）與頭頂光環
    for dx in (0.0, 0.03):
        objs.append(box('key', (0.08 + dx, -0.19, 0.55), (0.012, 0.012, 0.18), (math.radians(20), 0, 0)))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.075, minor_radius=0.008, location=(0, 0.04, 0.99), rotation=(math.radians(80), 0, 0))
    objs.append(bpy.context.active_object)
    export('peter', objs, target_faces=26000)


# ── 教宗坐像：右手高舉祝福（烏爾巴諾八世、保祿三世、克勉十世、依諾增爵八世等紀念碑共用）──
def pope_seated():
    clear()
    R, L = -1, 1
    torso = [(0, 0.03, 0.45, (0.13, 0.1)), (0, 0.03, 0.58, (0.12, 0.085)), (0, 0.025, 0.68, (0.14, 0.09)), (0, 0.02, 0.75, (0.16, 0.08)),
             (0, 0.015, 0.8, 0.045), (0, 0.01, 0.87, (0.065, 0.075)), (0, 0.01, 0.92, 0.05)]
    arms = [arm(R, (0.13, 0.03, 0.75), (0.22, -0.05, 0.84), (0.2, -0.1, 0.98)),
            arm(L, (0.13, 0.03, 0.75), (0.17, -0.06, 0.6), (0.12, -0.17, 0.52))]
    legs = [[(s * 0.07, 0.02, 0.44, 0.06), (s * 0.08, -0.2, 0.44, 0.05), (s * 0.08, -0.23, 0.1, 0.045)] for s in (R, L)]
    fig = skin('body', [torso] + arms + legs, sub=3, folds=0.003)
    # 教宗披肩（pluviale）：自肩膀垂到腳邊的大斗篷
    cope = skin('cope', [[(0, 0.05, 0.76, (0.15, 0.09)), (0, 0.04, 0.6, (0.17, 0.11)), (0, -0.06, 0.44, (0.19, 0.13)), (0, -0.19, 0.22, (0.18, 0.08)), (0, -0.23, 0.03, (0.18, 0.07))]], sub=3, folds=0.012)
    # 三重冕
    tiara = skin('tiara', [[(0, 0.01, 0.92, 0.062), (0, 0.01, 0.98, 0.055), (0, 0.01, 1.03, 0.04), (0, 0.01, 1.06, 0.015)]], sub=2)
    export('pope_seated', [fig, cope, tiara])


# ── 教宗跪像：雙手合十（亞歷山大七世、克勉十三世）──
def pope_kneel():
    clear()
    torso = [(0, 0.05, 0.36, (0.13, 0.1)), (0, 0.04, 0.48, (0.12, 0.085)), (0, 0.03, 0.58, (0.14, 0.09)), (0, 0.02, 0.65, (0.16, 0.08)),
             (0, 0.0, 0.7, 0.045), (0, -0.02, 0.76, (0.065, 0.075)), (0, -0.03, 0.81, 0.05)]
    arms = [arm(s, (0.13, 0.02, 0.65), (0.12, -0.12, 0.55), (0.02, -0.18, 0.62)) for s in (-1, 1)]
    legs = [[(s * 0.07, 0.05, 0.34, 0.06), (s * 0.08, -0.08, 0.06, 0.05), (s * 0.08, 0.2, 0.04, 0.045)] for s in (-1, 1)]
    fig = skin('body', [torso] + arms + legs, sub=3, folds=0.003)
    cope = skin('cope', [[(0, 0.05, 0.66, (0.17, 0.1)), (0, 0.06, 0.45, (0.22, 0.14)), (0, 0.08, 0.22, (0.25, 0.2)), (0, 0.12, 0.03, (0.26, 0.24))]], sub=3, folds=0.012)
    export('pope_kneel', [fig, cope])


# ── 獅子（克勉十三世紀念碑的兩頭獅：一頭抬頭醒著、一頭伏首而眠）──
def lion(awake):
    clear()
    head = [(0.42, 0, 0.38 if awake else 0.18, (0.13, 0.14)), (0.55, 0, 0.36 if awake else 0.14, (0.08, 0.08))]
    body_ = [(-0.4, 0, 0.18, (0.14, 0.15)), (-0.1, 0, 0.2, (0.17, 0.18)), (0.2, 0, 0.22, (0.19, 0.2)), (0.32, 0, 0.27 if awake else 0.18, (0.2, 0.2))] + head
    paws = [[(0.2, s * 0.1, 0.12, 0.06), (0.5, s * 0.1, 0.05, 0.05)] for s in (-1, 1)]
    tail = [[(-0.4, 0, 0.18, 0.05), (-0.6, 0.1, 0.06, 0.03), (-0.75, 0.2, 0.05, 0.02)]]
    o = skin('lion', [body_] + paws + tail, sub=3, folds=0.006)
    # 鬃毛
    mane = skin('mane', [[(0.36, 0, 0.3 if awake else 0.18, (0.2, 0.2)), (0.44, 0, 0.33 if awake else 0.16, (0.17, 0.17))]], sub=2, folds=0.03)
    # 匯出時讓獅子面向 −Y（與人像一致）
    for ob in (o, mane):
        ob.rotation_euler = (0, 0, math.radians(-90))
    export('lion_awake' if awake else 'lion_asleep', [o, mane], target_faces=12000)


# ── 揚蹄戰馬與騎者（君士坦丁、查理曼）──
def equestrian():
    clear()
    # 先建立站姿比例正確的馬（x 向前、單位約為身長 1.3），再以後蹄為支點整體抬起成揚蹄
    spine = [(-0.55, 0, 0.62, (0.17, 0.16)), (-0.15, 0, 0.6, (0.2, 0.18)), (0.22, 0, 0.62, (0.18, 0.17)), (0.38, 0, 0.74, (0.12, 0.1)),
             (0.5, 0, 0.9, (0.085, 0.07)), (0.58, 0, 1.0, (0.06, 0.065)), (0.72, 0, 0.88, (0.05, 0.045))]
    hind = [[(-0.5, s * 0.1, 0.55, 0.09), (-0.62, s * 0.1, 0.3, 0.045), (-0.56, s * 0.1, 0.02, 0.038)] for s in (-1, 1)]
    fore = [[(0.28, s * 0.1, 0.5, 0.07), (0.46, s * 0.1, 0.44, 0.045), (0.4, s * 0.1, 0.28, 0.038)] for s in (-1, 1)]
    tail = [[(-0.64, 0, 0.62, 0.05), (-0.76, 0, 0.45, 0.04), (-0.8, 0, 0.25, 0.03)]]
    ears = [[(0.6, s * 0.03, 1.02, 0.02), (0.6, s * 0.035, 1.08, 0.008)] for s in (-1, 1)]
    horse = skin('horse', [spine] + hind + fore + tail + ears, sub=3, folds=0.003)
    rider = skin('rider', [[(0.06, 0, 0.8, (0.12, 0.1)), (0.08, 0, 0.98, (0.13, 0.08)), (0.09, 0, 1.08, 0.045), (0.1, 0, 1.16, (0.06, 0.065))],
                           [(0.08, -0.12, 1.04, 0.04), (0.2, -0.16, 0.98, 0.032), (0.32, -0.1, 0.96, 0.026)],
                           [(0.08, 0.12, 1.04, 0.04), (0.16, 0.22, 1.12, 0.032), (0.24, 0.28, 1.24, 0.026)],
                           [(0.06, -0.12, 0.78, 0.06), (0.14, -0.18, 0.6, 0.045), (0.1, -0.18, 0.42, 0.04)],
                           [(0.06, 0.12, 0.78, 0.06), (0.14, 0.18, 0.6, 0.045), (0.1, 0.18, 0.42, 0.04)]], sub=3, folds=0.004)
    cloak = cloth('cloak', [(0.08, -0.12, 1.06), (0.08, 0.12, 1.06), (-0.3, -0.24, 0.8), (-0.3, 0.24, 0.8)], waves=3, amp=0.04)
    objs = [horse, rider, cloak]
    pivot = Vector((-0.56, 0, 0.0))
    rot = Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(-26), 4, 'Y') @ Matrix.Translation(-pivot)
    for ob in objs:
        ob.matrix_world = Matrix.Rotation(math.radians(-90), 4, 'Z') @ rot  # 揚蹄後轉成面向 −Y
    export('equestrian', objs, target_faces=26000)


for f in (longinus, andrew, veronica, helena, peter, pope_seated, pope_kneel, equestrian):
    f()
lion(True)
lion(False)
