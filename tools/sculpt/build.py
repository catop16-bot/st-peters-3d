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


def cloth(name, corners, waves=3, amp=0.02, res=16, thick=True):
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
    if thick:
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


# ── 布料模擬：讓長袍與斗篷依重力垂落、被身體撐出自然衣褶 ──
def tube(name, z_top, z_bot, r_top, r_bot, cx=0.0, cy=0.0, segs=56, rows=36, bot_dx=0.0, bot_dy=0.0, yr=0.82):
    """開口圓筒（長袍）：頂端環固定在肩頸，向下放寬"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for j in range(rows + 1):
        v = j / rows
        z = z_top + (z_bot - z_top) * v
        r = r_top + (r_bot - r_top) * (v ** 0.8)
        ring = [bm.verts.new((cx + bot_dx * v + r * math.cos(2 * math.pi * i / segs), cy + bot_dy * v + r * (yr + (0.82 - yr) * v) * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)]
        rings.append(ring)
    for j in range(rows):
        for i in range(segs):
            a, b = rings[j][i], rings[j][(i + 1) % segs]
            c, d = rings[j + 1][(i + 1) % segs], rings[j + 1][i]
            bm.faces.new((a, b, c, d))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def simulate(cloth_obj, colliders, pin, frames=45, stiff=12.0, mass=0.25, thick=0.012, sub=1):
    """pin(co) → 是否固定該頂點；colliders 為身體等碰撞體。模擬後套用並加厚度"""
    vg = cloth_obj.vertex_groups.new(name='pin')
    vg.add([v.index for v in cloth_obj.data.vertices if pin(cloth_obj.matrix_world @ v.co)], 1.0, 'REPLACE')
    for c in colliders:
        if not any(m.type == 'COLLISION' for m in c.modifiers):
            cm = c.modifiers.new('col', 'COLLISION')
        c.collision.thickness_outer = 0.006
        c.collision.cloth_friction = 6.0
    cl = cloth_obj.modifiers.new('cloth', 'CLOTH')
    st = cl.settings
    st.quality = 6
    st.mass = mass
    st.tension_stiffness = stiff
    st.compression_stiffness = stiff
    st.shear_stiffness = stiff * 0.6
    st.bending_stiffness = 0.15
    st.air_damping = 2.0
    st.vertex_group_mass = 'pin'
    cl.collision_settings.distance_min = 0.004
    cl.collision_settings.use_self_collision = False
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, frames
    cl.point_cache.frame_start, cl.point_cache.frame_end = 1, frames
    for f in range(1, frames + 1):
        sc.frame_set(f)
    bpy.context.view_layer.objects.active = cloth_obj
    bpy.ops.object.modifier_apply(modifier=cl.name)
    so = cloth_obj.modifiers.new('thick', 'SOLIDIFY'); so.thickness = thick
    ss = cloth_obj.modifiers.new('sub', 'SUBSURF'); ss.levels = sub
    apply_mods(cloth_obj)
    sc.frame_set(1)
    return cloth_obj


def drape_sheet(name, corners, colliders, pin_edge=0.97, frames=40, res=22):
    """四角布面（斗篷），固定上緣後模擬垂落"""
    o = cloth(name, corners, waves=0, amp=0.0, res=res, thick=False)
    a, b = Vector(corners[0]), Vector(corners[1])
    ab = b - a
    def on_top(co):
        t = max(0.0, min(1.0, (co - a).dot(ab) / ab.length_squared))
        return (co - (a + ab * t)).length < 0.012
    return simulate(o, colliders, on_top, frames=frames)


def face(head, beard=False, tilt=0.0):
    """頭部細節：鼻、眉弓、頭髮，可選鬍鬚（head 為頭中心 (x,y,z)，人物面向 −Y）"""
    hx, hy, hz = head
    out = []
    out.append(cone('nose', (hx, hy - 0.066, hz - 0.004 + tilt * 0.02), 0.012, 0.03, (math.radians(-80), 0, 0)))
    out.append(box('brow', (hx, hy - 0.058, hz + 0.018 + tilt * 0.02), (0.07, 0.016, 0.012)))
    hair = skin('hair', [[(hx, hy + 0.012, hz + 0.02, (0.07, 0.07)), (hx, hy + 0.02, hz + 0.06, (0.055, 0.055))]], sub=2, folds=0.008)
    out.append(hair)
    if beard:
        out.append(skin('beard', [[(hx, hy - 0.035, hz - 0.035, (0.045, 0.03)), (hx, hy - 0.04, hz - 0.075, (0.03, 0.022))]], sub=2, folds=0.01))
    return out


BEARD = True  # 由各雕像函式設定

# ── 共用：著袍站立人體（weight 側、stride 為跨步） ──
def body(arms, legs, head=(0, 0.02, 0.915), tilt=0.0, robe=0.2, stride=0.0):
    hx, hy, hz = head
    torso = [(0, 0, 0.5, (0.11, 0.08)), (0, 0.0, 0.6, (0.1, 0.075)), (0, 0.005, 0.7, (0.13, 0.085)), (0, 0.01, 0.785, (0.15, 0.075)),
             (hx * 0.5, hy * 0.5, 0.84, 0.045), (hx, hy, hz, (0.065, 0.075)), (hx, hy - tilt * 0.3, hz + 0.05, 0.05)]
    chains = [torso]
    chains += arms
    chains += legs
    figure = skin('body', chains, sub=3, folds=0.003)
    # 長袍：以布料模擬，頂端固定在胸口，受重力垂落並被雙腿撐出衣褶
    # 頂端環貼合肩線（扁橢圓），避免出現平台狀的肩部
    gown = tube('robe', 0.795, 0.0, 0.158, robe * 1.05, bot_dx=stride, bot_dy=-0.02, yr=0.52)
    simulate(gown, [figure], lambda co: co.z > 0.78, frames=45)
    return [figure, gown] + face(head, beard=BEARD, tilt=tilt)


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
    global BEARD
    clear()
    BEARD = True
    R, L = -1, 1  # 人物右側在 −X
    objs = body(
        arms=[arm(R, (0.12, 0, 0.8), (0.26, -0.03, 0.87), (0.35, -0.05, 0.96)),
              arm(L, (0.12, 0, 0.8), (0.27, -0.05, 0.77), (0.43, -0.09, 0.75))],
        legs=[leg(R, (0.07, -0.02, 0.26), (0.08, -0.05, 0.02)), leg(L, (0.1, -0.08, 0.28), (0.13, -0.12, 0.03))],
        tilt=0.6, robe=0.2, stride=0.03)
    # 斗篷：由左肩經左手垂到腰側，翻飛的大片布面
    objs.append(drape_sheet('cloak', [(0.12, 0.05, 0.8), (0.42, -0.07, 0.75), (0.13, 0.09, 0.42), (0.38, -0.03, 0.4)], objs[:2]))
    objs.append(drape_sheet('drape', [(-0.15, 0.04, 0.79), (-0.03, 0.08, 0.8), (-0.17, 0.06, 0.4), (-0.03, 0.1, 0.4)], objs[:2]))
    objs.append(cyl('lance', (-0.37, -0.06, 0.0), (-0.34, -0.05, 1.12), 0.011))
    objs.append(cone('tip', (-0.34, -0.05, 1.15), 0.02, 0.07))
    export('longinus', objs)


# ── 聖安德烈（Duquesnoy）：倚著 X 形十字架、右手扶架、左臂張開 ──
def andrew():
    global BEARD
    clear()
    BEARD = True
    R, L = -1, 1
    objs = body(
        arms=[arm(R, (0.12, 0, 0.8), (0.2, -0.02, 0.92), (0.24, 0.0, 1.04)),
              arm(L, (0.12, 0, 0.8), (0.27, -0.04, 0.68), (0.38, -0.06, 0.58))],
        legs=[leg(R, (0.07, -0.03, 0.26), (0.09, -0.06, 0.02)), leg(L, (0.08, -0.05, 0.27), (0.11, -0.09, 0.03))],
        tilt=0.5, robe=0.19)
    objs.append(drape_sheet('cloak', [(0.12, 0.05, 0.78), (0.38, -0.06, 0.58), (0.12, 0.09, 0.4), (0.38, -0.02, 0.3)], objs[:2]))
    # X 形十字架：兩根方木在身後交叉
    objs.append(box('beam1', (-0.02, 0.12, 0.62), (0.075, 0.075, 1.45), (0, math.radians(38), 0)))
    objs.append(box('beam2', (0.02, 0.16, 0.6), (0.075, 0.075, 1.35), (0, math.radians(-40), 0)))
    export('andrew', objs)


# ── 聖維羅妮卡（Mochi）：大步前行、雙手展開聖帕 ──
def veronica():
    global BEARD
    clear()
    BEARD = False
    R, L = -1, 1
    objs = body(
        arms=[arm(R, (0.11, 0, 0.8), (0.04, -0.12, 0.72), (-0.06, -0.14, 0.8)),
              arm(L, (0.11, 0, 0.8), (0.24, -0.06, 0.9), (0.3, -0.06, 1.0))],
        legs=[leg(R, (0.1, -0.08, 0.27), (0.14, -0.14, 0.02)), leg(L, (0.05, 0.04, 0.25), (0.04, 0.08, 0.03))],
        head=(-0.04, 0.0, 0.915), robe=0.21, stride=-0.05)
    objs.append(cloth('veil', [(0.07, -0.15, 0.62), (0.31, -0.08, 0.72), (0.06, -0.14, 0.82), (0.32, -0.06, 1.0)], waves=3, amp=0.03))
    objs.append(drape_sheet('cloak', [(0.06, 0.06, 0.8), (0.2, 0.05, 0.77), (0.08, 0.1, 0.35), (0.26, 0.04, 0.35)], objs[:2]))
    export('veronica', objs)


# ── 聖海倫娜（Bolgi）：右手扶巨大十字架、左臂張開，頭戴冠 ──
def helena():
    global BEARD
    clear()
    BEARD = False
    R, L = -1, 1
    objs = body(
        arms=[arm(R, (0.11, 0, 0.8), (0.19, -0.06, 0.7), (0.2, -0.07, 0.8)),
              arm(L, (0.11, 0, 0.8), (0.25, -0.07, 0.74), (0.38, -0.12, 0.72))],
        legs=[leg(R, (0.06, -0.02, 0.26), (0.07, -0.05, 0.02)), leg(L, (0.08, -0.06, 0.27), (0.1, -0.1, 0.03))],
        robe=0.21)
    objs.append(drape_sheet('cloak', [(-0.14, 0.05, 0.79), (0.0, 0.08, 0.8), (-0.18, 0.06, 0.35), (-0.02, 0.1, 0.35)], objs[:2]))
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
    objs = [fig, gown] + face((0, 0.02, 0.87), beard=True)
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
    export('pope_seated', [fig, cope, tiara] + face((0, 0.01, 0.87)))


# ── 教宗跪像：雙手合十（亞歷山大七世、克勉十三世）──
def pope_kneel():
    clear()
    torso = [(0, 0.05, 0.36, (0.13, 0.1)), (0, 0.04, 0.48, (0.12, 0.085)), (0, 0.03, 0.58, (0.14, 0.09)), (0, 0.02, 0.65, (0.16, 0.08)),
             (0, 0.0, 0.7, 0.045), (0, -0.02, 0.76, (0.065, 0.075)), (0, -0.03, 0.81, 0.05)]
    arms = [arm(s, (0.13, 0.02, 0.65), (0.12, -0.12, 0.55), (0.02, -0.18, 0.62)) for s in (-1, 1)]
    legs = [[(s * 0.07, 0.05, 0.34, 0.06), (s * 0.08, -0.08, 0.06, 0.05), (s * 0.08, 0.2, 0.04, 0.045)] for s in (-1, 1)]
    fig = skin('body', [torso] + arms + legs, sub=3, folds=0.003)
    cope = skin('cope', [[(0, 0.05, 0.66, (0.17, 0.1)), (0, 0.06, 0.45, (0.22, 0.14)), (0, 0.08, 0.22, (0.25, 0.2)), (0, 0.12, 0.03, (0.26, 0.24))]], sub=3, folds=0.012)
    export('pope_kneel', [fig, cope] + face((0, -0.02, 0.76)))


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
    # 頸部較粗、頭部約為身長的 1/4（頭頂 → 額 → 口鼻）
    spine = [(-0.55, 0, 0.62, (0.17, 0.16)), (-0.15, 0, 0.6, (0.2, 0.18)), (0.22, 0, 0.62, (0.18, 0.17)), (0.38, 0, 0.76, (0.13, 0.11)),
             (0.48, 0, 0.9, (0.1, 0.08)), (0.56, 0, 1.0, (0.08, 0.07)), (0.66, 0, 0.94, (0.08, 0.065)), (0.76, 0, 0.84, (0.065, 0.055)), (0.8, 0, 0.8, (0.05, 0.045))]
    hind = [[(-0.5, s * 0.1, 0.55, 0.09), (-0.62, s * 0.1, 0.3, 0.045), (-0.56, s * 0.1, 0.02, 0.038)] for s in (-1, 1)]
    fore = [[(0.28, s * 0.1, 0.5, 0.07), (0.46, s * 0.1, 0.44, 0.045), (0.4, s * 0.1, 0.28, 0.038)] for s in (-1, 1)]
    tail = [[(-0.64, 0, 0.62, 0.05), (-0.76, 0, 0.45, 0.04), (-0.8, 0, 0.25, 0.03)]]
    ears = [[(0.56, s * 0.04, 1.04, 0.022), (0.55, s * 0.045, 1.11, 0.008)] for s in (-1, 1)]
    horse = skin('horse', [spine] + hind + fore + tail + ears, sub=3, folds=0.003)
    rider = skin('rider', [[(0.06, 0, 0.8, (0.12, 0.1)), (0.08, 0, 0.98, (0.14, 0.09)), (0.09, 0, 1.1, 0.055), (0.1, 0, 1.2, (0.088, 0.092)), (0.1, 0, 1.28, 0.06)],
                           [(0.08, -0.12, 1.04, 0.04), (0.2, -0.16, 0.98, 0.032), (0.32, -0.1, 0.96, 0.026)],
                           [(0.08, 0.12, 1.04, 0.04), (0.2, 0.16, 0.98, 0.032), (0.32, 0.1, 0.96, 0.026)],  # 雙手向前執韁
                           [(0.06, -0.12, 0.78, 0.06), (0.14, -0.18, 0.6, 0.045), (0.1, -0.18, 0.42, 0.04)],
                           [(0.06, 0.12, 0.78, 0.06), (0.14, 0.18, 0.6, 0.045), (0.1, 0.18, 0.42, 0.04)]], sub=3, folds=0.004)
    cloak = cloth('cloak', [(0.08, -0.12, 1.06), (0.08, 0.12, 1.06), (-0.3, -0.24, 0.8), (-0.3, 0.24, 0.8)], waves=3, amp=0.04)
    objs = [horse, rider, cloak]
    pivot = Vector((-0.56, 0, 0.0))
    rot = Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(-26), 4, 'Y') @ Matrix.Translation(-pivot)
    for ob in objs:
        ob.matrix_world = Matrix.Rotation(math.radians(-90), 4, 'Z') @ rot  # 揚蹄後轉成面向 −Y
    export('equestrian', objs, target_faces=26000)


# ── 通用聖人像（柱廊 140 尊、立面 13 尊、中殿創辦人像共用；姿勢輪流分配，不代表個別雕像的實際持物）──
def export_lods(name, objs, targets=(12000, 3500)):
    """合併後依序輸出細緻版與輕量版（輕量版檔名加 _lo）"""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    for k, tgt in enumerate(targets):
        faces = len(o.data.polygons)
        if faces > tgt:
            dm = o.modifiers.new('dec', 'DECIMATE'); dm.ratio = tgt / faces
            apply_mods(o)
        nm = name if k == 0 else name + '_lo'
        path = os.path.join(OUT, nm + '.glb')
        bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_draco_mesh_compression_enable=True,
                                  export_draco_mesh_compression_level=7, export_materials='NONE', export_normals=True)
        print('exported', nm, len(o.data.polygons), 'faces', os.path.getsize(path) // 1024, 'KB')


def saint(v):
    global BEARD
    clear()
    BEARD = False
    R, L = -1, 1
    legs = [leg(R, (0.07, -0.02, 0.26), (0.08, -0.05, 0.02)), leg(L, (0.08, -0.05, 0.27), (0.1, -0.08, 0.03))]
    extra = []
    if v == 0:  # 舉手祝福、左手持書
        arms = [arm(R, (0.12, 0, 0.8), (0.2, -0.08, 0.9), (0.17, -0.13, 1.0)), arm(L, (0.12, 0, 0.8), (0.17, -0.08, 0.62), (0.1, -0.15, 0.6))]
        extra.append(lambda: box('book', (0.1, -0.18, 0.6), (0.11, 0.035, 0.14), (0.3, 0, 0.4)))
    elif v == 1:  # 左手持長杖十字
        arms = [arm(R, (0.12, 0, 0.8), (0.16, -0.05, 0.6), (0.1, -0.1, 0.5)), arm(L, (0.12, 0, 0.8), (0.2, -0.06, 0.68), (0.18, -0.12, 0.72))]
        extra.append(lambda: cyl('staff', (0.18, -0.13, 0.0), (0.18, -0.13, 1.12), 0.011))
        extra.append(lambda: box('bar', (0.18, -0.13, 1.04), (0.16, 0.018, 0.018)))
    elif v == 2:  # 雙臂張開
        arms = [arm(s_, (0.12, 0, 0.8), (0.26, -0.05, 0.7), (0.36, -0.1, 0.66)) for s_ in (R, L)]
    else:  # 右手撫胸、左手持棕櫚枝
        arms = [arm(R, (0.12, 0, 0.8), (0.1, -0.12, 0.66), (0.0, -0.12, 0.72)), arm(L, (0.12, 0, 0.8), (0.2, -0.06, 0.68), (0.2, -0.1, 0.78))]
        extra.append(lambda: skin('palm', [[(0.2, -0.11, 0.78, (0.012, 0.012)), (0.22, -0.12, 0.92, (0.035, 0.008)), (0.25, -0.12, 1.06, (0.02, 0.006))]], sub=2))
    objs = body(arms=arms, legs=legs, robe=0.2, tilt=0.2)
    side = L if v in (0, 3) else R
    objs.append(drape_sheet('cloak', [(side * 0.15, 0.04, 0.79), (side * 0.02, 0.08, 0.8), (side * 0.19, 0.06, 0.38), (side * 0.03, 0.1, 0.38)], objs[:2]))
    for f in extra:
        objs.append(f())
    export_lods('saint_%d' % v, objs)


for v in range(4):
    saint(v)

for f in (longinus, andrew, veronica, helena, peter, pope_seated, pope_kneel, equestrian):
    f()
lion(True)
lion(False)
