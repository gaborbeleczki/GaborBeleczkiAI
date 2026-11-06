"""Props: the display, peripherals, folios, record player, plants, books, ceramics, art.

Objects tagged dyn=... stay separate in the export and are lit live in WebGL
(they move, glow or reflect). Everything tagged bake='props' is merged and baked.
"""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import materials as M
from .furniture import DESK, SHELF, SHELF_Z, SIDEBOARD
from .room import X0, Y1, WIN_Z0
from .util import RNG, add_bevel, add_box, box, cylinder, mesh_object, revolve, smooth, sphere, tag, tube_along

FOLIO_COLORS = ['#E9E4DA', '#A9B8A4', '#8FA9C4', '#1D2D3D', '#C9A27C', '#D9C9AE', '#C8432B', '#416180']
FOLIO_IDS = ['hello', 'approach', 'role', 'work', 'career', 'toolkit', 'faq', 'contact']
BOOK_COLORS = ['#D9CFBF', '#A9B8A4', '#8FA9C4', '#1D2D3D', '#C9A27C', '#E9E4DA', '#B5483A', '#6E7F8F', '#F2EFE9', '#3F4246', '#CFC4AE']

DISPLAY_ROT = math.radians(15)
DISPLAY_POS = (DESK['x'] - 0.12, DESK['y'] + 0.1)
SCREEN_W, SCREEN_H = 0.608, 0.38


def place(ob, origin, rot_z):
    """Rotate an object (built around the local origin) about Z and move it to `origin`."""
    m = Matrix.Translation(Vector(origin)) @ Matrix.Rotation(rot_z, 4, 'Z')
    # matrix_basis reflects location/rotation immediately (matrix_world waits for a depsgraph update)
    ob.matrix_basis = m @ ob.matrix_basis
    return ob


# ------------------------------------------------------------------ desk setup

def build_display(coll_dyn, coll_props) -> dict:
    top = DESK['top']
    origin = (DISPLAY_POS[0], DISPLAY_POS[1], top)
    alu = M.metal('#CDCFD3', 'aluminium', 0.3)
    black = M.matte('#0B0C0E', 'bezel_black', 0.12)
    parts = []
    base = box('display_base', (0.2, 0.17, 0.008), (0, 0.03, 0.004), coll_dyn, alu, bevel=0.003)
    stand = box('display_stand', (0.13, 0.012, 0.3), (0, 0.075, 0.16), coll_dyn, alu, bevel=0.002)
    stand.rotation_euler.x = math.radians(-9)
    body = box('display_body', (0.64, 0.014, 0.404), (0, 0.0, 0.33), coll_dyn, alu, bevel=0.004)
    bezel = box('display_bezel', (0.632, 0.002, 0.396), (0, -0.0072, 0.33), coll_dyn, black, bevel=0.001)
    parts = [base, stand, body, bezel]
    for p in parts:
        place(p, origin, DISPLAY_ROT)
        tag(p, dyn='display')
    # Screen: a UV-mapped quad that the runtime paints with a canvas.
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    hw, hh = SCREEN_W / 2, SCREEN_H / 2
    zc = 0.33
    vs = [bm.verts.new(p) for p in ((-hw, -0.0085, zc - hh), (hw, -0.0085, zc - hh), (hw, -0.0085, zc + hh), (-hw, -0.0085, zc + hh))]
    f = bm.faces.new(vs)
    for lp, co in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = co
    screen = mesh_object('screen', bm, coll_dyn, M.emission('#F4F1EA', 2.2, 'screen_glow'))
    place(screen, origin, DISPLAY_ROT)
    tag(screen, dyn='screen', hit='screen', label='Display')
    # keyboard + trackpad (static, baked)
    kb_mat = M.matte('#DADBDE', 'kb_alu', 0.5)
    key_mat = M.matte('#F4F4F5', 'keycaps', 0.6)
    kb = box('keyboard', (0.28, 0.115, 0.007), (-0.02, -0.29, 0.0035), coll_props, kb_mat, bevel=0.003)
    keys = []
    for r in range(5):
        for c in range(14):
            kx = -0.02 - 0.13 + c * 0.0186 + (0.004 if r % 2 else 0)
            ky = -0.29 - 0.043 + r * 0.0195
            if c == 13 and r % 2:
                continue
            keys.append(box(f'key_{r}_{c}', (0.0155, 0.0155, 0.003), (kx, ky, 0.0085), coll_props, key_mat, bevel=0.0018, segments=2))
    pad = box('trackpad', (0.13, 0.105, 0.006), (0.215, -0.29, 0.003), coll_props, kb_mat, bevel=0.003)
    statics = [kb, pad] + keys
    for p in statics:
        place(p, origin, math.radians(4))
        tag(p, bake='props')
    return {'screen': screen, 'parts': parts}


def build_desk_things(coll) -> list:
    top = DESK['top']
    parts = []
    # mug with handle
    mug_pos = (DESK['x'] + 0.46, DESK['y'] - 0.18, top)
    mug = revolve('mug', [(0.0, 0.0), (0.038, 0.0), (0.041, 0.006), (0.043, 0.09), (0.04, 0.092), (0.037, 0.012), (0.0, 0.012)], coll, M.ceramic('#E7E0D3', 'ceramic_oat', 0.4), loc=mug_pos, segs=40, cap_bottom=False)
    handle = tube_along('mug_handle', [(mug_pos[0] + 0.04, mug_pos[1], top + 0.07), (mug_pos[0] + 0.066, mug_pos[1], top + 0.066), (mug_pos[0] + 0.07, mug_pos[1], top + 0.045), (mug_pos[0] + 0.062, mug_pos[1], top + 0.028), (mug_pos[0] + 0.04, mug_pos[1], top + 0.025)], 0.006, coll, M.ceramic('#E7E0D3', 'ceramic_oat', 0.4))
    coffee = cylinder('coffee', 0.037, 0.002, (mug_pos[0], mug_pos[1], top + 0.078), coll, M.matte('#3B2A20', 'coffee', 0.2), segs=32)
    parts += [mug, handle, coffee]
    # notebook + pen
    nb_pos = (DESK['x'] + 0.48, DESK['y'] + 0.12, top)
    nb = box('notebook', (0.15, 0.21, 0.016), (nb_pos[0], nb_pos[1], top + 0.008), coll, M.wool('#2D4257', 'linen_navy', 400.0), bevel=0.003)
    nb.rotation_euler.z = math.radians(-12)
    pages = box('notebook_pages', (0.144, 0.205, 0.012), (nb_pos[0] + 0.004, nb_pos[1], top + 0.008), coll, M.paper('#F2ECDF', 'paper_cream'), bevel=0.001)
    pages.rotation_euler.z = math.radians(-12)
    band = box('notebook_band', (0.004, 0.214, 0.0175), (nb_pos[0] + 0.05, nb_pos[1] - 0.011, top + 0.008), coll, M.matte('#C8432B', 'elastic_red', 0.6))
    band.rotation_euler.z = math.radians(-12)
    pen = tube_along('pen', [(nb_pos[0] - 0.11, nb_pos[1] - 0.06, top + 0.005), (nb_pos[0] - 0.09, nb_pos[1] + 0.08, top + 0.005)], 0.0045, coll, M.matte('#1D1D1F', 'pen_black', 0.35))
    parts += [nb, pages, band, pen]
    # small stack of two books under the lamp side
    parts += book_stack('desk_books', (DESK['x'] - 0.55, DESK['y'] - 0.12, top), coll, n=2, rot=math.radians(8))
    for p in parts:
        tag(p, bake='props')
    return parts


def book(name, w, d, t, loc, rot_z, color, coll, standing=True):
    """A hardcover: coloured case with a cream page block. Standing books have the spine facing +x."""
    cover = M.paper(color, f'cover_{color}')
    pages = M.paper('#EFE8DA', 'pages')
    if standing:
        c = box(name, (d, t, w), (loc[0], loc[1], loc[2] + w / 2), coll, cover, bevel=0.0015, segments=2)
        p = box(name + '_p', (d - 0.006, t - 0.004, w - 0.008), (loc[0] - 0.004, loc[1], loc[2] + w / 2), coll, pages)
    else:
        c = box(name, (d, w, t), (loc[0], loc[1], loc[2] + t / 2), coll, cover, bevel=0.0015, segments=2)
        p = box(name + '_p', (d - 0.006, w - 0.008, t - 0.004), (loc[0] - 0.004, loc[1], loc[2] + t / 2), coll, pages)
    for o in (c, p):
        o.rotation_euler.z = rot_z
    return [c, p]


def book_stack(name, loc, coll, n=3, rot=0.0):
    out = []
    z = loc[2]
    for i in range(n):
        t = RNG.uniform(0.022, 0.04)
        w = RNG.uniform(0.2, 0.25)
        d = RNG.uniform(0.15, 0.18)
        color = RNG.choice(BOOK_COLORS)
        bs = book(f'{name}_{i}', w, d, t, (loc[0] + RNG.uniform(-0.01, 0.01), loc[1] + RNG.uniform(-0.01, 0.01), z), rot + RNG.uniform(-0.15, 0.15), color, coll, standing=False)
        out += bs
        z += t
    return out


# ------------------------------------------------------------------ shelves: folios + books

def folio_mesh(name, coll, color):
    """Magazine file: full-height spine facing +x, top cut down towards the wall."""
    w, d, h, low = 0.078, 0.245, 0.315, 0.16
    bm = bmesh.new()
    prof = [(-d / 2, 0.0), (d / 2, 0.0), (d / 2, h), (d / 2 - 0.07, h), (-d / 2, low)]
    front = [bm.verts.new((x, -w / 2, z)) for x, z in prof]
    back = [bm.verts.new((x, w / 2, z)) for x, z in prof]
    bm.faces.new(list(reversed(front)))
    bm.faces.new(back)
    n = len(prof)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], front[j], back[j], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mat = M.matte(color, f'folio_{color}', 0.78)
    ob = mesh_object(name, bm, coll, mat)
    add_bevel(ob, 0.003, 2, 30)
    return ob


def build_shelf_things(coll_dyn, coll_props) -> dict:
    sh = SHELF
    z_low, z_high = SHELF_Z
    folios = []
    x_center = X0 + 0.02 + 0.245 / 2
    y = sh['y0'] + 0.1
    for i, (fid, col) in enumerate(zip(FOLIO_IDS, FOLIO_COLORS)):
        f = folio_mesh(f'folio_{i:02d}', coll_dyn, col)
        f.location = (x_center, y + i * 0.088, z_low)
        f.rotation_euler.z = math.radians(RNG.uniform(-1.2, 1.2))
        tag(f, dyn='folio', folio=fid, index=i, hit=f'folio:{fid}', label=fid)
        folios.append(f)
    statics = []
    # books after the folios on the lower shelf
    yb = y + 8 * 0.088 + 0.04
    for i in range(6):
        t = RNG.uniform(0.022, 0.042)
        w = RNG.uniform(0.21, 0.27)
        statics += book(f'shelf_book_{i}', w, 0.17, t, (X0 + 0.02 + 0.085, yb + t / 2, z_low), RNG.uniform(-0.02, 0.02), RNG.choice(BOOK_COLORS), coll_props)
        yb += t + 0.002
    # a leaning book and a small speckled vase at the end
    statics.append(revolve('shelf_vase', [(0.0, 0.0), (0.035, 0.0), (0.05, 0.05), (0.042, 0.11), (0.022, 0.15), (0.024, 0.16), (0.0, 0.16)], coll_props, M.ceramic('#D9D2C3', 'ceramic_sand', 0.5), loc=(X0 + 0.13, sh['y1'] - 0.1, z_low), segs=40))
    # upper shelf: books lying and standing, a small framed photo, a candle holder
    statics += book_stack('upper_stack', (X0 + 0.13, sh['y0'] + 0.2, z_high), coll_props, n=3, rot=math.radians(90))
    yb = sh['y0'] + 0.42
    for i in range(9):
        t = RNG.uniform(0.02, 0.04)
        w = RNG.uniform(0.19, 0.26)
        statics += book(f'upper_book_{i}', w, 0.16, t, (X0 + 0.02 + 0.08, yb + t / 2, z_high), RNG.uniform(-0.02, 0.02), RNG.choice(BOOK_COLORS), coll_props)
        yb += t + 0.002
    statics.append(revolve('upper_pot', [(0.0, 0.0), (0.045, 0.0), (0.055, 0.1), (0.058, 0.105), (0.0, 0.105)], coll_props, M.ceramic('#A9B8A4', 'ceramic_sage', 0.45), loc=(X0 + 0.13, sh['y1'] - 0.16, z_high), segs=40))
    statics += pilea('upper_plant', (X0 + 0.13, sh['y1'] - 0.16, z_high + 0.1), coll_props, size=0.85)
    for p in statics:
        tag(p, bake='props')
    return {'folios': folios}


# ------------------------------------------------------------------ record player

def build_record_player(coll_dyn, coll_props) -> dict:
    s = SIDEBOARD
    cx = s['x0'] + s['depth'] / 2 + 0.01
    cy = 0.88
    z = s['z1']
    oak = M.oak('oak_plinth', 'warm', 'Y')
    plinth = box('tt_plinth', (0.34, 0.44, 0.07), (cx, cy, z + 0.035), coll_props, oak, bevel=0.008)
    feet = [cylinder(f'tt_foot_{i}', 0.02, 0.008, (cx + dx, cy + dy, z - 0.002), coll_props, M.matte('#1E1E20', 'rubber', 0.8), segs=20) for i, (dx, dy) in enumerate(((0.13, 0.18), (-0.13, 0.18), (0.13, -0.18), (-0.13, -0.18)))]
    for f in feet:
        f.location.z = z + 0.002
    for p in [plinth] + feet:
        tag(p, bake='props')
    pz = z + 0.07
    pcx, pcy = cx - 0.02, cy - 0.05
    platter = cylinder('tt_platter', 0.15, 0.02, (pcx, pcy, pz + 0.01), coll_dyn, M.metal('#C4C6CA', 'alu_brushed', 0.38), segs=64)
    tag(platter, dyn='platter', hit='record', label='Record player')
    record = cylinder('tt_record', 0.148, 0.0025, (pcx, pcy, pz + 0.0215), coll_dyn, M.matte('#111113', 'vinyl', 0.25), segs=96)
    tag(record, dyn='record', hit='record')
    # Tonearm, origin at the pivot so it can swing onto the record.
    pivot = Vector((cx + 0.11, cy + 0.15, pz))
    arm_parts = []
    base = cylinder('tt_arm_base', 0.022, 0.03, (0, 0, 0.015), coll_dyn, M.metal('#B9BBC0', 'alu_dark', 0.3), segs=32)
    tube = tube_along('tt_arm_tube', [(0, 0, 0.032), (-0.03, -0.12, 0.034), (-0.045, -0.205, 0.03)], 0.0035, coll_dyn, M.metal('#D0D2D6', 'alu_bright', 0.25))
    head = box('tt_headshell', (0.018, 0.04, 0.006), (-0.047, -0.222, 0.027), coll_dyn, M.matte('#1D1D1F', 'headshell', 0.4))
    cw = cylinder('tt_counterweight', 0.012, 0.03, (0.008, 0.05, 0.032), coll_dyn, M.metal('#9EA1A6', 'alu_dark2', 0.35), segs=24)
    cw.rotation_euler.x = math.radians(90)
    from .util import apply_modifiers, join
    arm = join([base, tube, head, cw], 'tonearm', coll_dyn)
    arm.location = pivot  # parts were modelled around the origin, i.e. in pivot space
    tag(arm, dyn='tonearm', hit='record')
    return {'platter': platter, 'record': record, 'tonearm': arm, 'pivot': tuple(pivot)}


# ------------------------------------------------------------------ plants

def leaf_mesh(bm, length, width, base: Vector, direction: Vector, up: Vector, cup=0.25, droop=0.25):
    """Add a single leaf (folded ellipse) to a bmesh."""
    segs = 7
    verts_l, verts_r, mid = [], [], []
    d = direction.normalized()
    side = d.cross(up).normalized()
    nrm = side.cross(d).normalized()
    for i in range(segs + 1):
        t = i / segs
        wdt = width * math.sin(math.pi * min(1.0, t * 1.05)) * (1 - 0.15 * t)
        p = base + d * (length * t) - nrm * (droop * length * t * t)
        mid.append(bm.verts.new(p + nrm * (cup * wdt * 0.3)))
        verts_l.append(bm.verts.new(p + side * wdt / 2))
        verts_r.append(bm.verts.new(p - side * wdt / 2))
    for i in range(segs):
        bm.faces.new((verts_l[i], verts_l[i + 1], mid[i + 1], mid[i]))
        bm.faces.new((mid[i], mid[i + 1], verts_r[i + 1], verts_r[i]))


def pilea(name, loc, coll, size=1.0) -> list:
    """Coin-leaf plant: round leaves on thin petioles fanning out from a short stem."""
    bm = bmesh.new()
    origin = Vector(loc)
    leaves = 16
    for i in range(leaves):
        a = i * 2.4
        tilt = RNG.uniform(0.35, 0.9)
        L = RNG.uniform(0.08, 0.13) * size
        dirv = Vector((math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt), math.cos(tilt)))
        tip = origin + dirv * L
        leaf_mesh(bm, 0.05 * size, 0.05 * size, tip, Vector((dirv.x, dirv.y, 0.2)).normalized(), Vector((0, 0, 1)), cup=0.5, droop=0.05)
    ob = mesh_object(name, bm, coll, M.leaf('#4F6B45', 'leaf_pilea'))
    sol = ob.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.0015
    smooth(ob)
    stems = []
    for i in range(leaves):
        a = i * 2.4
        tilt = RNG.uniform(0.35, 0.9)
        L = RNG.uniform(0.07, 0.12) * size
        dirv = Vector((math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt), math.cos(tilt)))
        stems.append(tube_along(f'{name}_stem_{i}', [tuple(origin), tuple(origin + dirv * L)], 0.0015, coll, M.leaf('#6E8A55', 'stem_green')))
    return [ob] + stems


def big_plant(coll, loc=(-2.2, 1.86)) -> list:
    """A tall ficus-like plant in a pale ceramic pot for the corner by the window."""
    parts = []
    pot = revolve('big_pot', [(0.0, 0.0), (0.16, 0.0), (0.2, 0.06), (0.215, 0.34), (0.21, 0.36), (0.19, 0.36), (0.19, 0.33), (0.0, 0.33)], coll, M.ceramic('#E4DED3', 'ceramic_pale', 0.55), loc=(loc[0], loc[1], 0), segs=56, cap_bottom=True)
    soil = cylinder('big_soil', 0.19, 0.01, (loc[0], loc[1], 0.33), coll, M.matte('#3A2E26', 'soil', 0.95), segs=40)
    parts += [pot, soil]
    bark = M.oak('bark', 'warm', 'Z')
    bm = bmesh.new()
    stems = [
        [(0, 0, 0.33), (0.02, 0.01, 0.9), (0.05, -0.02, 1.45), (0.06, 0.0, 1.85)],
        [(0, 0, 0.33), (-0.04, 0.03, 0.8), (-0.12, 0.06, 1.25), (-0.18, 0.04, 1.55)],
        [(0, 0, 0.33), (0.03, -0.03, 0.7), (0.14, -0.06, 1.05), (0.22, -0.1, 1.3)],
    ]
    for si, st in enumerate(stems):
        pts = [(loc[0] + p[0], loc[1] + p[1], p[2]) for p in st]
        parts.append(tube_along(f'big_stem_{si}', pts, 0.012 - si * 0.002, coll, bark))
        # leaves along the upper part of each stem
        n = 14 - si * 2
        for k in range(n):
            t = 0.35 + 0.65 * k / n
            seg = min(int(t * (len(pts) - 1)), len(pts) - 2)
            u = t * (len(pts) - 1) - seg
            p0, p1 = Vector(pts[seg]), Vector(pts[seg + 1])
            base = p0.lerp(p1, u)
            a = k * 2.39996 + si
            out = Vector((math.cos(a), math.sin(a), RNG.uniform(0.1, 0.7))).normalized()
            L = RNG.uniform(0.2, 0.3)
            leaf_mesh(bm, L, L * 0.62, base, out, Vector((0, 0, 1)), cup=0.35, droop=0.35)
    leaves = mesh_object('big_leaves', bm, coll, M.leaf('#4B6A43', 'leaf_ficus'))
    sol = leaves.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.002
    smooth(leaves)
    parts.append(leaves)
    for p in parts:
        tag(p, bake='props')
    return parts


def sill_things(coll) -> list:
    parts = []
    z = WIN_Z0
    yy = Y1 + 0.1
    pot = revolve('sill_pot', [(0.0, 0.0), (0.05, 0.0), (0.06, 0.09), (0.062, 0.095), (0.0, 0.095)], coll, M.ceramic('#C9785B', 'terracotta', 0.7, speckle=False), loc=(0.92, yy, z), segs=40)
    parts.append(pot)
    parts += pilea('sill_pilea', (0.92, yy, z + 0.095), coll, size=1.05)
    # a tall bud vase with a dried stem, and a small candle holder
    vase = revolve('sill_vase', [(0.0, 0.0), (0.03, 0.0), (0.045, 0.06), (0.03, 0.16), (0.012, 0.22), (0.014, 0.23), (0.0, 0.23)], coll, M.ceramic('#1D2D3D', 'ceramic_navy', 0.3, speckle=False), loc=(-0.85, yy, z), segs=40)
    parts.append(vase)
    for i in range(3):
        a = i * 2.1
        tip = (-0.85 + math.cos(a) * 0.08, yy + math.sin(a) * 0.05, z + 0.5 + i * 0.05)
        parts.append(tube_along(f'dried_{i}', [(-0.85, yy, z + 0.2), tip], 0.0015, coll, M.matte('#B59A72', 'dried_grass', 0.9)))
        parts.append(sphere(f'dried_head_{i}', 0.012, tip, coll, M.wool('#D8C6A2', 'grass_fluff', 600.0), segs=10, rings=6, scale=(1, 1, 2.2)))
    holder = revolve('sill_candle_holder', [(0.0, 0.0), (0.035, 0.0), (0.036, 0.04), (0.03, 0.04), (0.03, 0.008), (0.0, 0.008)], coll, glass_tint(), loc=(-0.55, yy, z), segs=32)
    parts.append(holder)
    for p in parts:
        tag(p, bake='props')
    return parts


def glass_tint():
    return M.ceramic('#B9C4C8', 'smoked_glass', 0.15, speckle=False)


# ------------------------------------------------------------------ sideboard top + floor bits

def sideboard_things(coll, art_paths: dict) -> list:
    s = SIDEBOARD
    z = s['z1']
    cx = s['x0'] + s['depth'] / 2
    parts = []
    # two ceramics and dried grass at the back end of the sideboard
    tall = revolve('sb_vase_tall', [(0.0, 0.0), (0.05, 0.0), (0.08, 0.08), (0.07, 0.22), (0.035, 0.32), (0.038, 0.34), (0.0, 0.34)], coll, M.ceramic('#EDE7DC', 'ceramic_chalk', 0.6), loc=(cx - 0.03, s['y0'] + 0.22, z), segs=48)
    small = revolve('sb_vase_small', [(0.0, 0.0), (0.06, 0.0), (0.075, 0.05), (0.06, 0.12), (0.045, 0.13), (0.0, 0.13)], coll, M.ceramic('#A9B8A4', 'ceramic_sage', 0.45), loc=(cx + 0.02, s['y0'] + 0.38, z), segs=48)
    parts += [tall, small]
    for i in range(5):
        a = i * 1.3
        tip = (cx - 0.03 + math.cos(a) * 0.14, s['y0'] + 0.22 + math.sin(a) * 0.12, z + 0.72 + RNG.uniform(-0.06, 0.08))
        parts.append(tube_along(f'sb_grass_{i}', [(cx - 0.03, s['y0'] + 0.22, z + 0.3), tip], 0.0016, coll, M.matte('#B59A72', 'dried_grass', 0.9)))
        parts.append(sphere(f'sb_grass_head_{i}', 0.016, tip, coll, M.wool('#D8C6A2', 'grass_fluff', 600.0), segs=10, rings=6, scale=(1, 1, 2.4)))
    # a short stack of books under the record player side
    parts += book_stack('sb_books', (cx, s['y0'] + 0.62, z), coll, n=3, rot=math.radians(4))
    # record sleeves leaning against the end of the sideboard
    for i, key in enumerate(('sleeve_a', 'sleeve_b', 'sleeve_c')):
        mat = M.image_diffuse(f'sleeve_{i}', art_paths[key], 0.7) if key in art_paths else M.paper(BOOK_COLORS[i], f'sleeve_{i}')
        sl = box(f'sleeve_{i}', (0.315, 0.004, 0.315), (cx - 0.02 + i * 0.012, s['y1'] + 0.06 + i * 0.012, 0.16), coll, mat, bevel=0.001)
        sl.rotation_euler.x = math.radians(-12 + i * 2)
        set_uv_front(sl)
        parts.append(sl)
    for p in parts:
        tag(p, bake='props')
    return parts


def set_uv_front(ob):
    """Map a thin box's large faces to the full 0-1 UV square (for printed covers)."""
    me = ob.data
    uv = me.uv_layers.get('ArtUV') or me.uv_layers.new(name='ArtUV')
    xs = [v.co.x for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))


def side_table_things(coll, table=(1.0, 0.98)) -> dict:
    parts = []
    z = 0.533
    parts += book_stack('st_books', (table[0] - 0.05, table[1] + 0.04, z), coll, n=3, rot=math.radians(25))
    plate = cylinder('st_plate', 0.06, 0.008, (table[0] + 0.1, table[1] - 0.08, z + 0.004), coll, M.ceramic('#E7E0D3', 'ceramic_oat', 0.4), segs=40)
    candle = cylinder('st_candle', 0.034, 0.11, (table[0] + 0.1, table[1] - 0.08, z + 0.008 + 0.055), coll, M.matte('#F4EEDF', 'wax', 0.6), segs=40)
    wick = tube_along('st_wick', [(table[0] + 0.1, table[1] - 0.08, z + 0.118), (table[0] + 0.1, table[1] - 0.08, z + 0.128)], 0.0012, coll, M.matte('#1A1A1A', 'wick', 0.9))
    parts += [plate, candle, wick]
    for p in parts:
        tag(p, bake='props')
    flame_pos = (table[0] + 0.1, table[1] - 0.08, z + 0.142)
    return {'parts': parts, 'flame': flame_pos}


def framed_print(coll, image_path, center=(-1.93, 1.66), size=(0.56, 0.74)) -> list:
    """Oak frame with a passe-partout on the window wall, left of the window."""
    w, h = size
    y = Y1 - 0.014
    oak = M.oak('oak_frame', 'light', 'Z')
    parts = []
    t = 0.022
    parts.append(box('frame_top', (w, 0.026, t), (center[0], y, center[1] + h / 2 - t / 2), coll, oak, bevel=0.002))
    parts.append(box('frame_bot', (w, 0.026, t), (center[0], y, center[1] - h / 2 + t / 2), coll, oak, bevel=0.002))
    parts.append(box('frame_l', (t, 0.026, h), (center[0] - w / 2 + t / 2, y, center[1]), coll, oak, bevel=0.002))
    parts.append(box('frame_r', (t, 0.026, h), (center[0] + w / 2 - t / 2, y, center[1]), coll, oak, bevel=0.002))
    parts.append(box('passepartout', (w - 2 * t, 0.004, h - 2 * t), (center[0], y + 0.006, center[1]), coll, M.paper('#F5F2EC', 'passe_partout')))
    # print surface with UVs
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('ArtUV')
    pw, ph = w - 2 * t - 0.11, h - 2 * t - 0.13
    # wound so the face points into the room (-y): the bake samples light along the normal
    vs = [bm.verts.new(p) for p in ((-pw / 2, 0, -ph / 2), (pw / 2, 0, -ph / 2), (pw / 2, 0, ph / 2), (-pw / 2, 0, ph / 2))]
    f = bm.faces.new(vs)
    for lp, co in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = co
    art = mesh_object('print_art', bm, coll, M.image_diffuse('print_art', image_path, 0.9))
    art.location = (center[0], y + 0.0035, center[1] + 0.01)
    parts.append(art)
    for p in parts:
        tag(p, bake='props')
    return parts


# ------------------------------------------------------------------ hit areas

def hit_box(name, size, loc, coll, hit, label, rot_z=0.0):
    ob = box(name, size, loc, coll, None, rot_z=rot_z)
    ob.hide_render = True
    ob.display_type = 'WIRE'
    tag(ob, hit=hit, label=label, invisible=True)
    return ob
