"""The warm layer and the side quests.

Cozy: a cable-knit throw draped over the chair (a real cloth simulation), a knitted pouf, fairy
lights around the window, a small lamp on the sideboard, a child's drawing taped to the wall.

Side quests: running shoes under the window with a race number above them, a finisher's medal on
the window handle, the training log on the sill; and, on the wall behind the visitor, a cork
board of everything else, a framed poster, a kettlebell and a padel racket.
"""

from __future__ import annotations

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import materials as M
from .furniture import CHAIR, SHELF, SHELF_Z, SIDEBOARD, group_parent, parent_all, tapered_leg
from .room import GLASS_Y, WIN_X0, WIN_X1, WIN_Z0, WIN_Z1, X0, X1, Y1
from .util import add_bevel, box, cylinder, mesh_object, revolve, smooth, sphere, tag, tube_along

RND = random.Random(2027)
KNIT_TILE = 0.56  # metres one repeat of the knit photograph covers


# ---------------------------------------------------------------- helpers

def sheet(name, w, h, nx, ny, coll, mat, tile=None):
    """A flat grid in XY centred on the origin, with ArtUV: tiled every `tile` metres, or 0..1."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('ArtUV')
    verts = [[bm.verts.new((-w / 2 + w * i / nx, -h / 2 + h * j / ny, 0.0)) for i in range(nx + 1)] for j in range(ny + 1)]
    for j in range(ny):
        for i in range(nx):
            f = bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
            for lp in f.loops:
                x, y = lp.vert.co.x + w / 2, lp.vert.co.y + h / 2
                lp[uv].uv = (x / tile, y / tile) if tile else (x / w, y / h)
    return mesh_object(name, bm, coll, mat)


def picture(name, w, h, coll, mat, nx=1, ny=1, curl=0.0):
    """A sheet standing in the XZ plane, facing -y, u to +x and v up (ArtUV 0..1). `curl` lifts
    the lower corners off the wall."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('ArtUV')
    verts = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            u, v = i / nx, j / ny
            lift = curl * (1 - v) ** 2 * (0.35 + 0.65 * abs(2 * u - 1))
            row.append(bm.verts.new((-w / 2 + w * u, -lift, -h / 2 + h * v)))
        verts.append(row)
    for j in range(ny):
        for i in range(nx):
            f = bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
            for lp in f.loops:
                lp[uv].uv = ((lp.vert.co.x + w / 2) / w, (lp.vert.co.z + h / 2) / h)
    ob = mesh_object(name, bm, coll, mat)
    if nx > 1:
        smooth(ob)
    return ob


def on_wall(ob, origin, facing: str, roll: float = 0.0):
    """Place something built facing -y on a wall: facing '+x' (left wall), '-x' (right wall) or
    '-y' (window wall). `roll` turns it in its own plane."""
    rz = {'+x': math.radians(90), '-x': math.radians(-90), '-y': 0.0}[facing]
    ob.matrix_basis = Matrix.Translation(Vector(origin)) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(roll, 4, 'Y') @ ob.matrix_basis
    return ob


def _interp(keys, s):
    for (s0, v0), (s1, v1) in zip(keys, keys[1:]):
        if s <= s1:
            t = (s - s0) / (s1 - s0)
            t = t * t * (3 - 2 * t)
            return v0 + (v1 - v0) * t
    return keys[-1][1]


# ---------------------------------------------------------------- the throw on the chair

def chair_back():
    """The top of the chair's back (world, metres) and the direction pointing out of the chair
    there, towards the door."""
    a = CHAIR['rot']
    top = (0.0, 0.405)
    wx = CHAIR['x'] + top[0] * math.cos(a) - top[1] * math.sin(a)
    wy = CHAIR['y'] + top[0] * math.sin(a) + top[1] * math.cos(a)
    return Vector((wx, wy, 0.81)), Vector((-math.sin(a), math.cos(a)))


def build_throw(coll, colliders, tex) -> dict:
    """A chunky cable-knit throw over the back of the chair. It starts as a flat sheet lying
    across the top of the back and falls: Blender's cloth solver drapes one half down the outside
    and the other into the seat. A few stitches stay where the sheet crosses the rim, the way a
    throw stays where it was put."""
    mat = M.image_tiled('knit_throw', tex, 0.96) if tex else M.wool('#E9E2D2', 'throw_wool', 120.0)
    W, L = 0.54, 1.1
    nx, ny = 27, 55
    ob = sheet('throw', W, L, nx, ny, coll, mat, KNIT_TILE)
    for v in ob.data.vertices:
        v.co.z += RND.uniform(-0.0015, 0.0015)
    pin = ob.vertex_groups.new(name='pin')
    held = [v.index for v in ob.data.vertices if abs(v.co.y - 0.03) < 0.012 and abs(v.co.x) < 0.085]
    pin.add(held, 1.0, 'REPLACE')
    top, ow = chair_back()
    twist = math.radians(9)
    yaw = math.atan2(-ow.x, ow.y) + twist
    side = Vector((ow.y, -ow.x))                 # along the rim, towards the door side of the room
    centre = top + Vector((side.x, side.y, 0)) * 0.05 - Vector((ow.x, ow.y, 0)) * 0.03
    ob.location = (centre.x, centre.y, top.z + 0.018)
    ob.rotation_euler = (0.0, 0.0, yaw)

    sc = bpy.context.scene
    floor = sheet('_cloth_floor', 5, 5, 1, 1, coll, None)
    floor.location = (0, 1, 0.0)
    cols = list(colliders) + [floor]
    for o in cols:
        o.modifiers.new('Collision', 'COLLISION')
        o.collision.thickness_outer = 0.008
        o.collision.cloth_friction = 60.0
        o.collision.damping = 0.7
    cl = ob.modifiers.new('Cloth', 'CLOTH')
    s = cl.settings
    s.quality = 10
    s.mass = 0.35
    s.air_damping = 2.5
    s.tension_stiffness = s.compression_stiffness = 14.0
    s.shear_stiffness = 5.0
    s.bending_stiffness = 1.6          # thick wool: broad folds, no fine wrinkles
    s.tension_damping = s.compression_damping = s.shear_damping = 9.0
    s.bending_damping = 1.2
    s.vertex_group_mass = 'pin'
    s.pin_stiffness = 1.0
    c = cl.collision_settings
    c.use_collision = True
    c.distance_min = 0.012
    c.collision_quality = 4
    c.use_self_collision = True
    c.self_distance_min = 0.012
    c.self_friction = 14.0
    frames = 120
    sc.frame_start, sc.frame_end = 1, frames
    cl.point_cache.frame_start, cl.point_cache.frame_end = 1, frames
    for f in range(1, frames + 1):
        sc.frame_set(f)
    deps = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)
    for o in cols:
        for mod in list(o.modifiers):
            if mod.type == 'COLLISION':
                o.modifiers.remove(mod)
    bpy.data.objects.remove(floor, do_unlink=True)
    sc.frame_set(1)
    mw = ob.matrix_world
    zs = [(mw @ v.co).z for v in ob.data.vertices]
    print(f'[cozy] throw draped: z {min(zs):.2f}..{max(zs):.2f} m, {len(held)} stitches held')
    sol = ob.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.011
    sol.offset = 0.0
    smooth(ob)
    tag(ob, bake='furniture')
    return {'object': ob, 'hang': (top.x + ow.x * 0.09, top.y + ow.y * 0.09, 0.56), 'yaw': yaw - twist}


# ---------------------------------------------------------------- pouf, rug

def build_pouf(coll, tex, loc=(-1.14, 1.52)) -> dict:
    """A knitted pouf: a flattened ball, the cables running up to a point at the top."""
    r, hz = 0.25, 0.165
    mat = M.image_tiled('knit_pouf', tex, 0.96, tint='#D6C8B4') if tex else M.wool('#CFC2AE', 'pouf_wool', 120.0)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('ArtUV')
    segs, rings = 48, 18
    grid = []
    for j in range(rings + 1):
        phi = math.pi * j / rings
        rad = r * math.sin(phi) ** 0.72
        z = hz - hz * math.cos(phi) * (1.0 if phi > math.pi / 2 else 0.96)
        grid.append([bm.verts.new((rad * math.cos(2 * math.pi * i / segs), rad * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)])
    for j in range(rings):
        for i in range(segs):
            i2 = (i + 1) % segs
            f = bm.faces.new((grid[j][i], grid[j][i2], grid[j + 1][i2], grid[j + 1][i]))
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uv].uv = (ii / segs * 3.0, jj / rings * 1.25)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_object('pouf', bm, coll, mat)
    ob.location = (loc[0], loc[1], 0.0)
    smooth(ob)
    tag(ob, bake='furniture')
    return {'object': ob, 'top': (loc[0], loc[1], 2 * hz)}


def glow(name, color, strength, base):
    """An emitter that is still a pale object when it is switched off (frosted glass, opal)."""
    m = M.emission(color, strength, name)
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            M.set_in(n, 'Base Color', M.hex_rgb(base))
    return m


# ---------------------------------------------------------------- fairy lights

def fairy_path():
    y = Y1 + 0.018
    z_top = WIN_Z1 - 0.014
    x0, x1 = WIN_X0 + 0.014, WIN_X1 - 0.014
    pts = []
    n = 26
    zb = 0.99
    for i in range(n + 1):               # up the left side of the reveal
        t = i / n
        pts.append((x0 + 0.004 + 0.006 * math.sin(t * 9.0), y + 0.014 + 0.012 * math.sin(t * 5.3 + 1.0), zb + (z_top - zb) * t))
    swags, per = 4, 18
    for k in range(swags):               # across the top in four swags
        xa = x0 + (x1 - x0) * k / swags
        xb = x0 + (x1 - x0) * (k + 1) / swags
        for i in range(1, per + 1):
            t = i / per
            pts.append((xa + (xb - xa) * t, y + 0.012 * math.sin(t * math.pi), z_top - 0.3 * t * (1 - t)))
    zb2 = 1.48
    for i in range(1, n + 1):            # down the right side
        t = i / n
        pts.append((x1 - 0.004 - 0.006 * math.sin(t * 8.0), y + 0.014 + 0.012 * math.sin(t * 4.7), z_top - (z_top - zb2) * t))
    return pts


def shelf_path():
    """A second string lying along the front of the upper shelf, in front of the books, with its
    tail hanging off the window end."""
    x = X0 + SHELF['depth'] - 0.022
    z = SHELF_Z[1] + 0.005
    pts = []
    n = 40
    for i in range(n + 1):
        t = i / n
        y = SHELF['y0'] + 0.31 + (SHELF['y1'] - SHELF['y0'] - 0.32) * t   # clear of the lying books
        pts.append((x + 0.009 * math.sin(t * 23.0) - 0.004, y, z + 0.002 * math.sin(t * 31.0)))
    y_end = SHELF['y1'] - 0.006
    for i in range(1, 9):                # over the end and down
        t = i / 8
        pts.append((x + 0.014 * t, y_end + 0.012 * math.sin(t * math.pi / 2), z - 0.012 - 0.2 * t * t))
    return pts


def build_fairy_lights(coll, coll_dyn) -> dict:
    """Warm micro-bulbs on a wire: up one side of the window, across the top and down the other,
    and a second string along the upper shelf. The wires are baked; the bulbs are one mesh that
    glows in the evening."""
    strings = [fairy_path(), shelf_path()]
    wires = []
    bm = bmesh.new()
    spots = []
    step = 0.085
    for si, pts in enumerate(strings):
        wire = tube_along(f'fairy_wire_{si}', pts, 0.0011, coll, M.matte('#2B2A26', 'fairy_wire', 0.6), segs=6)
        wires.append(tag(wire, bake='props'))
        acc = 0.04
        for a, b in zip(pts, pts[1:]):
            va, vb = Vector(a), Vector(b)
            seg = (vb - va).length
            while acc <= seg:
                spots.append((si, va.lerp(vb, acc / seg)))
                acc += step
            acc -= seg
    wire = wires[0]
    first = [p for si, p in spots if si == 0]
    second = [p for si, p in spots if si == 1]
    # on the window string the bulbs hang below the wire; on the shelf they lie beside it
    for p in first:
        mtx = Matrix.Translation(p + Vector((0, -0.004, -0.006))) @ Matrix.Diagonal((1.0, 1.0, 1.45, 1.0))
        bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.0062, matrix=mtx)
    for p in second:
        mtx = Matrix.Translation(p + Vector((0.006, 0, 0.003))) @ Matrix.Diagonal((1.45, 1.0, 1.0, 1.0))
        bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.0062, matrix=mtx)
    spots = first + second
    bulbs = mesh_object('fairy_bulbs', bm, coll_dyn, glow('bulb_fairy', '#FFC98A', 3.0, '#EFE6D6'))
    smooth(bulbs)
    tag(bulbs, dyn='emitter', glow='#FFC98A', base='#EFE6D6', strength=3.2)
    # a handful of small lights stand in for the bulbs when the room is baked
    n = 10
    lights = [tuple(first[round(i * (len(first) - 1) / (n - 1))] + Vector((0, -0.03, -0.01))) for i in range(n)]
    lights += [tuple(second[round(i * (len(second) - 1) / 4)] + Vector((0.03, 0, 0.012))) for i in range(5)]
    print(f'[cozy] fairy lights: {len(spots)} bulbs')
    return {'wire': wire, 'bulbs': bulbs, 'lights': lights, 'count': len(spots)}


# ---------------------------------------------------------------- the little lamp on the sideboard

def build_mushroom_lamp(coll, coll_dyn, loc) -> dict:
    x, y, z = loc
    brass = M.metal('#B8955A', 'brass', 0.28)
    parts = [
        cylinder('ml_base', 0.05, 0.012, (x, y, z + 0.006), coll, brass, segs=40, bevel=0.003),
        cylinder('ml_stem', 0.009, 0.122, (x, y, z + 0.012 + 0.061), coll, brass, segs=20),
    ]
    prof = [(0.0, 0.005), (0.076, 0.005), (0.083, 0.0), (0.087, 0.012), (0.082, 0.04), (0.064, 0.064), (0.034, 0.08), (0.0, 0.084)]
    shade = revolve('ml_shade', prof, coll_dyn, glow('shade_glow', '#FFD3A0', 2.0, '#F1EADC'), loc=(x, y, z + 0.128), segs=48)
    tag(shade, dyn='emitter', glow='#FFD3A0', base='#F1EADC', strength=2.0, hit='lights', label='Little lamp')
    for p in parts:
        tag(p, bake='props')
    return {'parts': parts, 'light_pos': (x, y, z + 0.16), 'top': (x, y, z + 0.215)}


# ---------------------------------------------------------------- paper on the walls

def taped(name, coll, image, origin, facing, size, roll_deg=2.5, tapes=('#A9B8A4', '#C8432B'), curl=0.006, rough=0.92) -> list:
    """A sheet of paper taped to a wall by its top corners."""
    w, h = size
    pic = picture(name, w, h, coll, M.image_diffuse(name, image, rough), nx=8, ny=6, curl=curl)
    pic.location = (0, -0.0016, 0)
    parts = [pic]
    for i, (sx, col) in enumerate(zip((-1, 1), tapes)):
        t = box(f'{name}_tape_{i}', (0.05, 0.0006, 0.017), (sx * (w / 2 - 0.012), -0.0026, h / 2 - 0.004), coll, M.matte(col, f'washi_{col}', 0.8))
        t.rotation_euler.y = math.radians(-32 * sx)
        parts.append(t)
    for p in parts:
        on_wall(p, origin, facing, math.radians(roll_deg))
        tag(p, bake='props')
    return parts


def framed(name, coll, image, origin, facing, pic=(0.56, 0.315), border=0.045, bar=0.02, group='props') -> list:
    """A framed print hanging flat on a wall: oak frame, passe-partout, the picture."""
    oak = M.oak('oak_frame', 'light', 'Z')
    pw, ph = pic
    w, h = pw + 2 * (border + bar), ph + 2 * (border + bar)
    d = 0.022
    parts = [
        box(f'{name}_top', (w, d, bar), (0, -d / 2, h / 2 - bar / 2), coll, oak, bevel=0.002),
        box(f'{name}_bot', (w, d, bar), (0, -d / 2, -h / 2 + bar / 2), coll, oak, bevel=0.002),
        box(f'{name}_l', (bar, d, h), (-w / 2 + bar / 2, -d / 2, 0), coll, oak, bevel=0.002),
        box(f'{name}_r', (bar, d, h), (w / 2 - bar / 2, -d / 2, 0), coll, oak, bevel=0.002),
        box(f'{name}_mat', (w - 2 * bar, 0.003, h - 2 * bar), (0, -0.006, 0), coll, M.paper('#F5F2EC', 'passe_partout')),
    ]
    art = picture(f'{name}_art', pw, ph, coll, M.image_diffuse(f'{name}_art', image, 0.85))
    art.location = (0, -0.0082, 0)
    parts.append(art)
    for p in parts:
        on_wall(p, origin, facing)
        tag(p, bake=group)
    return parts


# ---------------------------------------------------------------- running shoes

def _loft(name, sections, coll, mats, face_mat, cap_mat):
    """Skin a list of closed cross-sections (lists of points, heel to toe) into a capped solid."""
    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in sec] for sec in sections]
    nr = len(rings[0])
    for i in range(len(rings) - 1):
        for k in range(nr):
            k2 = (k + 1) % nr
            f = bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
            f.material_index = face_mat(i, sum((v.co for v in f.verts), Vector()) / 4)
    for ring, first in ((rings[0], True), (rings[-1], False)):
        c = bm.verts.new(sum((v.co for v in ring), Vector()) / nr)
        for k in range(nr):
            k2 = (k + 1) % nr
            f = bm.faces.new((c, ring[k2], ring[k]) if first else (c, ring[k], ring[k2]))
            f.material_index = cap_mat
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_object(name, bm, coll, mats[0])
    for m in mats[1:]:
        ob.data.materials.append(m)
    sub = ob.modifiers.new('Sub', 'SUBSURF')
    sub.levels = 1
    sub.render_levels = 1
    smooth(ob)
    return ob


def running_shoe(name, coll, upper='#E0552F', accent='#1D2D3D', mirror=False) -> list:
    """A road-racing shoe: a thick foam midsole with a rocker and a rubber outsole, a knit upper
    with a darker heel counter, a padded collar and laces. Heel at the origin, toe along +x."""
    L = 0.29
    width = [(0, 0.05), (0.1, 0.068), (0.3, 0.074), (0.5, 0.084), (0.68, 0.098), (0.85, 0.09), (0.95, 0.066), (1.0, 0.034)]
    top = [(0, 0.082), (0.06, 0.102), (0.2, 0.11), (0.36, 0.102), (0.48, 0.09), (0.62, 0.074), (0.8, 0.058), (0.93, 0.048), (1.0, 0.04)]
    bottom = [(0, 0.014), (0.08, 0.002), (0.6, 0.0), (0.85, 0.005), (1.0, 0.022)]
    mid = [(0, 0.046), (0.3, 0.041), (0.6, 0.032), (0.9, 0.026), (1.0, 0.033)]
    sgn = -1.0 if mirror else 1.0
    ns = 26

    def section(s, w, z0, z1, n, e):
        zc, hh = (z0 + z1) / 2, (z1 - z0)
        bulge = sgn * 0.006 * math.sin(math.pi * s)     # the inside of the foot is straighter
        pts = []
        for k in range(n):
            a = 2 * math.pi * k / n
            cy, cz = math.sin(a), -math.cos(a)
            pts.append(Vector((s * L, (w / 2) * math.copysign(abs(cy) ** (2 / e), cy) + bulge, zc + (hh / 2) * math.copysign(abs(cz) ** (2 / e), cz))))
        return pts

    st = [i / ns for i in range(ns + 1)]
    foam = M.matte('#F3F1EA', 'shoe_foam', 0.75)
    rubber = M.matte('#2A2C30', 'shoe_rubber', 0.8)
    knit = M.matte(upper, f'shoe_upper_{upper}', 0.85)
    dark = M.matte(accent, f'shoe_accent_{accent}', 0.8)
    # the sole: wider than the foot, boxy in section
    sole_secs = [section(s, _interp(width, s) + 0.009, _interp(bottom, s), _interp(mid, s), 14, 5.0) for s in st]
    sole = _loft(f'{name}_sole', sole_secs, coll, [foam, rubber], lambda i, c: 1 if c.z < _interp(bottom, st[i]) + 0.0065 else 0, 0)
    # the upper sits a little into the sole
    up_secs = [section(s, _interp(width, s) - 0.003, _interp(mid, s) - 0.007, _interp(top, s), 16, 2.6) for s in st]
    body = _loft(name, up_secs, coll, [knit, dark], lambda i, c: 1 if st[i] < 0.19 else 0, 0)
    parts = [sole, body]
    # the opening: a dark hollow and a padded collar around it
    ox, oz = 0.24 * L, _interp(top, 0.24) - 0.001
    parts.append(sphere(f'{name}_hollow', 1.0, (ox, sgn * 0.002, oz), coll, M.matte('#17181B', 'shoe_inside', 0.95), segs=24, rings=12, scale=(0.046, 0.021, 0.004)))
    collar = [(ox + 0.05 * math.cos(a), sgn * 0.002 + 0.0245 * math.sin(a), oz + 0.001 + 0.006 * math.cos(a)) for a in [2 * math.pi * k / 24 for k in range(25)]]
    parts.append(tube_along(f'{name}_collar', collar, 0.0046, coll, dark, segs=9))
    # five laces over the tongue
    lace = M.matte('#F6F4EE', 'shoe_lace', 0.8)
    for j in range(5):
        s = 0.45 + j * 0.05
        zt = _interp(top, s) + 0.0015
        hw = 0.017 + 0.002 * j
        parts.append(tube_along(f'{name}_lace_{j}', [(s * L, -hw, zt - 0.004), (s * L + 0.004, 0, zt + 0.001), (s * L, hw, zt - 0.004)], 0.0017, coll, lace, segs=6))
    # a pull tab at the heel
    parts.append(tube_along(f'{name}_tab', [(0.006, -0.006, 0.1), (-0.008, 0.0, 0.114), (0.006, 0.006, 0.1)], 0.0022, coll, dark, segs=6))
    return parts


SHOE_SPOTS = (((0.648, 2.045), math.radians(7), False), ((0.63, 1.915), math.radians(-6), True))


def build_running_gear(coll, arts, shoe_coll=None) -> dict:
    """Shoes parked under the window to the right of the desk, the race number taped above.
    The shoes (after the ASICS Megablast, Ekiden colourway: lib/shoes.py) bake on their own."""
    from .shoes import megablast
    shoe_coll = shoe_coll or coll
    parts = []
    for i, (pos, rot, mirror) in enumerate(SHOE_SPOTS):
        grp = group_parent(f'shoe_grp_{i}', (pos[0], pos[1], 0.0), rot, shoe_coll)
        ps = megablast(f'shoe_{i}', shoe_coll, mirror=mirror)
        parent_all(ps, grp)
        parts += ps
    for p in parts:
        tag(p, bake='shoes' if shoe_coll is not coll else 'props')
    out = {'parts': parts, 'shoes': (0.79, 1.98, 0.1)}
    if 'bib' in arts:
        taped('race_bib', coll, arts['bib'], (0.8, Y1 - 0.0005, 0.52), '-y', (0.24, 0.18), roll_deg=-3, tapes=('#D9C9AE', '#D9C9AE'), curl=0.004)
        out['bib'] = (0.8, Y1 - 0.01, 0.52)
    return out


# ---------------------------------------------------------------- medal

def build_medal(coll, coll_dyn, arts) -> dict:
    """A finisher's medal hanging by its ribbon from the right-hand window handle."""
    hx = WIN_X1 - (WIN_X1 - WIN_X0) / 3 + 0.06
    hy = GLASS_Y - 0.05
    hz = WIN_Z0 + 0.55
    top = Vector((hx, hy - 0.017, hz + 0.048))
    centre = Vector((hx + 0.006, hy - 0.024, hz - 0.2))
    mat = M.image_diffuse('ribbon', arts['ribbon'], 0.8) if 'ribbon' in arts else M.matte('#C8432B', 'ribbon_red', 0.8)
    parts = []
    for i, (dx, dy) in enumerate(((-0.011, 0.0), (0.011, 0.004))):
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new('ArtUV')
        n = 6
        a = top + Vector((dx, dy, 0))
        b = centre + Vector((dx * 0.18, dy, 0.036))
        rows = []
        for j in range(n + 1):
            t = j / n
            p = a.lerp(b, t) + Vector((0, -0.004 * math.sin(math.pi * t), 0))
            rows.append((bm.verts.new(p + Vector((-0.013, 0, 0))), bm.verts.new(p + Vector((0.013, 0, 0)))))
        for j in range(n):
            f = bm.faces.new((rows[j][0], rows[j][1], rows[j + 1][1], rows[j + 1][0]))
            for lp, co in zip(f.loops, ((0, j / n), (1, j / n), (1, (j + 1) / n), (0, (j + 1) / n))):
                lp[uv].uv = co
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        strip = mesh_object(f'medal_ribbon_{i}', bm, coll, mat)
        sol = strip.modifiers.new('Solid', 'SOLIDIFY')
        sol.thickness = 0.0012
        smooth(strip)
        parts.append(strip)
    # the loop over the handle
    parts.append(box('medal_loop', (0.036, 0.04, 0.003), (hx, hy - 0.004, hz + 0.0565), coll, M.matte('#C8432B', 'ribbon_red', 0.8)))
    for p in parts:
        tag(p, bake='props')
    prof = [(0.0, -0.0022), (0.034, -0.0022), (0.0368, -0.0012), (0.0368, 0.0012), (0.034, 0.0022), (0.0305, 0.0027), (0.0275, 0.0015), (0.012, 0.0015), (0.01, 0.0024), (0.0, 0.0024)]
    medal = revolve('medal', prof, coll_dyn, M.metal('#D2AC58', 'medal_gold', 0.26), segs=64, cap_bottom=False)
    medal.rotation_euler = (math.radians(90), 0, math.radians(-10))
    medal.location = centre
    tag(medal, dyn='medal', hit='medal', label='Finisher medal')
    return {'parts': parts, 'medal': medal, 'anchor': tuple(centre)}


# ---------------------------------------------------------------- the training log

RUNLOG = dict(w=0.15, h=0.21, cover_t=0.0022, pages_t=0.0096, page_w=0.142, page_h=0.202, page_x=0.004)


def build_runlog(coll_dyn, pos, rot_z):
    """The training log: an A5 hardback with an elastic band, lying on the window sill. Built like
    the notebook on the desk (a group the browser lifts and opens), under the empty `runlog`."""
    n = RUNLOG
    cloth = M.matte('#E0552F', 'runlog_cloth', 0.8)
    parent = bpy.data.objects.new('runlog', None)
    parent.location = pos
    parent.rotation_euler.z = rot_z
    coll_dyn.objects.link(parent)
    tag(parent, dyn='runlog', hit='runlog', label='Training log')
    tc, tp = n['cover_t'], n['pages_t']
    back = box('runlog_back', (n['w'], n['h'], tc), (0, 0, tc / 2), coll_dyn, cloth, bevel=0.0008, segments=2)
    spine = box('runlog_spine', (0.003, n['h'], 2 * tc + tp), (-n['w'] / 2 + 0.0015, 0, (2 * tc + tp) / 2), coll_dyn, cloth, bevel=0.001, segments=2)
    block = box('runlog_block', (n['page_w'], n['page_h'], tp), (-n['w'] / 2 + n['page_x'] + n['page_w'] / 2, 0, tc + tp / 2), coll_dyn, M.paper('#F2ECDF', 'paper_cream'), bevel=0.0008, segments=2)
    cover = box('runlog_cover', (n['w'], n['h'], tc), (0, 0, 0), coll_dyn, cloth, bevel=0.0008, segments=2)
    cover.data.transform(Matrix.Translation((n['w'] / 2, 0, 0)))
    cover.location = (-n['w'] / 2, 0, tc + tp + tc / 2)
    band = box('runlog_band', (0.004, n['h'] + 0.004, 2 * tc + tp + 0.0015), (n['w'] / 2 - 0.025, 0, (2 * tc + tp) / 2), coll_dyn, M.matte('#1D2D3D', 'elastic_navy', 0.6))
    for p in (back, spine, block, cover, band):
        p.parent = parent
        tag(p, dyn='runlog_part', part=p.name.split('_')[-1])
    return parent


# ---------------------------------------------------------------- the side-quest wall

# cards on the board: key, centre measured from the board's left edge (as seen), height above the
# floor, size, tilt
BOARD = dict(y=0.85, z=1.5, w=1.2, h=0.8)
CARDS = [
    ('banner', 0.60, 1.835, (0.36, 0.08), 0.0),
    ('dwarf', 0.165, 1.625, (0.19, 0.154), -4.0),
    ('maths', 0.415, 1.6, (0.15, 0.15), 3.0),
    ('score', 0.635, 1.555, (0.12, 0.18), -2.0),
    ('padel', 0.885, 1.63, (0.19, 0.154), 4.0),
    ('oven', 1.085, 1.47, (0.085, 0.085), 5.0),
    ('travel', 0.215, 1.335, (0.2, 0.085), 2.0),
    ('games', 0.49, 1.305, (0.14, 0.14), -5.0),
    ('snow', 0.735, 1.3, (0.13, 0.13), 4.0),
    ('policy', 0.975, 1.265, (0.085, 0.085), -6.0),
]
PIN_COLORS = ['#C8432B', '#1D2D3D', '#E8B93C', '#416180', '#A9B8A4']


def build_quest_wall(coll, coll_dyn, arts) -> dict:
    """Behind the visitor, on the wall opposite the shelves: a cork board with the side quests
    pinned to it under a picture light, a framed poster, a kettlebell and a padel racket."""
    x = X1
    b = BOARD
    oak = M.oak('oak_board', 'light', 'Y')
    parts = [box('qb_cork', (0.01, b['w'], b['h']), (x - 0.009, b['y'], b['z']), coll, M.cork())]
    fr = 0.028
    parts += [
        box('qb_top', (0.02, b['w'] + 2 * fr, fr), (x - 0.01, b['y'], b['z'] + b['h'] / 2 + fr / 2), coll, oak, bevel=0.003),
        box('qb_bot', (0.02, b['w'] + 2 * fr, fr), (x - 0.01, b['y'], b['z'] - b['h'] / 2 - fr / 2), coll, oak, bevel=0.003),
        box('qb_l', (0.02, fr, b['h']), (x - 0.01, b['y'] + b['w'] / 2 + fr / 2, b['z']), coll, oak, bevel=0.003),
        box('qb_r', (0.02, fr, b['h']), (x - 0.01, b['y'] - b['w'] / 2 - fr / 2, b['z']), coll, oak, bevel=0.003),
    ]
    cards = {}
    for i, (key, u, z, (w, h), tilt) in enumerate(CARDS):
        if key not in arts:
            continue
        y = b['y'] + b['w'] / 2 - u       # seen from the room, left is +y on this wall
        lift = 0.0155 + 0.0006 * (i % 3)
        card = picture(f'q_{key}', w, h, coll, M.image_diffuse(f'q_{key}', arts[key], 0.9), nx=4, ny=3, curl=0.003 if w > 0.1 else 0.0015)
        on_wall(card, (x - lift, y, z), '-x', math.radians(tilt))
        parts.append(card)
        if key != 'banner':
            pin_z = z + h / 2 - 0.012
            parts.append(sphere(f'q_pin_{key}', 0.0058, (x - lift - 0.007, y, pin_z), coll, M.matte(PIN_COLORS[i % len(PIN_COLORS)], f'pin_{i % len(PIN_COLORS)}', 0.35), segs=14, rings=8))
        else:
            for sy in (-1, 1):
                parts.append(sphere(f'q_pin_{key}_{sy}', 0.0058, (x - lift - 0.007, y + sy * (w / 2 - 0.014), z + h / 2 - 0.012), coll, M.matte(PIN_COLORS[0], 'pin_0', 0.35), segs=14, rings=8))
        cards[key] = {'pos': (x - 0.02, y, z), 'size': (w, h)}
    # the picture light above the board
    brass = M.metal('#B8955A', 'brass', 0.28)
    lz = b['z'] + b['h'] / 2 + 0.16
    parts.append(cylinder('ql_rose', 0.03, 0.012, (x - 0.006, b['y'], lz - 0.03), coll, brass, segs=24))
    parts[-1].rotation_euler.y = math.radians(90)
    parts.append(tube_along('ql_arm', [(x - 0.01, b['y'], lz - 0.03), (x - 0.06, b['y'], lz - 0.02), (x - 0.115, b['y'], lz + 0.012)], 0.005, coll, brass))
    parts.append(tube_along('ql_bar', [(x - 0.115, b['y'] - 0.24, lz + 0.012), (x - 0.115, b['y'] + 0.24, lz + 0.012)], 0.013, coll, brass, segs=18))
    strip = box('ql_strip', (0.011, 0.44, 0.003), (x - 0.111, b['y'], lz - 0.0015), coll_dyn, glow('strip_glow', '#FFE2BC', 2.5, '#E9E2D4'))
    strip.rotation_euler.y = math.radians(-30)
    tag(strip, dyn='emitter', glow='#FFE2BC', base='#E9E2D4', strength=2.6, hit='lights', label='Picture light')
    light = (x - 0.125, b['y'], lz - 0.012)
    aim = (x - 0.012, b['y'], b['z'] - 0.05)
    # the poster
    poster = (x - 0.001, -0.42, 1.52)
    if 'dragon' in arts:
        parts += framed('poster', coll, arts['dragon'], poster, '-x', group='quests')
    # a kettlebell on the floor
    kx, ky = x - 0.2, 0.02
    iron = M.matte('#1E1F22', 'cast_iron', 0.75)
    parts.append(sphere('kb_ball', 0.1, (kx, ky, 0.096), coll, iron, segs=40, rings=24, scale=(1, 1, 0.95)))
    parts.append(tube_along('kb_handle', [(kx, ky + 0.064 * math.cos(a), 0.166 + 0.086 * math.sin(a)) for a in [math.pi * k / 16 for k in range(17)]], 0.0155, coll, iron, segs=14))
    parts.append(cylinder('kb_mark', 0.034, 0.002, (kx - 0.099, ky, 0.1), coll, M.matte('#E8B93C', 'kb_mark', 0.6), segs=28))
    parts[-1].rotation_euler.y = math.radians(90)
    # a padel racket leaning on the wall, two balls
    rk = padel_racket(coll, arts.get('racket'))
    ry = 1.66
    lean = math.radians(13)
    grp = group_parent('racket_grp', (x - 0.026 - 0.47 * math.sin(lean) - 0.006, ry, 0.0), math.radians(7), coll)
    tilt = bpy.data.objects.new('racket_tilt', None)
    tilt.rotation_euler.y = lean
    tilt.parent = grp
    coll.objects.link(tilt)
    parent_all(rk, tilt)
    parts += rk
    felt = M.matte('#D3E04E', 'ball_felt', 0.95)
    for i, (bx, by) in enumerate(((x - 0.3, ry - 0.2), (x - 0.21, ry - 0.31))):
        parts.append(sphere(f'padel_ball_{i}', 0.0325, (bx, by, 0.0325), coll, felt, segs=24, rings=14))
    parts += bench(coll, arts.get('boucle'), (x - 0.2, b['y'] - 0.02))
    for p in parts:
        if 'bake' not in p:
            tag(p, bake='quests')
    return {
        'parts': parts, 'cards': cards, 'board': (x - 0.02, b['y'], b['z']), 'poster': poster, 'bench': (x - 0.2, b['y'] - 0.02, 0.5),
        'light_pos': light, 'aim': aim, 'kettlebell': (kx, ky, 0.2), 'padel': (x - 0.1, ry, 0.34),
    }


def padel_racket(coll, face_img) -> list:
    """A padel racket standing on its butt cap: solid teardrop head, short throat, taped grip.
    The face looks towards -x; +z runs up the handle."""
    outline = [(-0.016, 0.0), (0.016, 0.0), (0.016, 0.115), (0.036, 0.158)]
    for k in range(0, 33):
        th = math.radians(-52 + (232 + 52) * k / 32)
        outline.append((0.13 * math.cos(th), 0.32 + 0.15 * math.sin(th)))
    outline += [(-0.036, 0.158), (-0.016, 0.115)]
    T = 0.036
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('ArtUV')
    front = [bm.verts.new((-T / 2, y, z)) for y, z in outline]
    back = [bm.verts.new((T / 2, y, z)) for y, z in outline]
    n = len(outline)
    f_front = bm.faces.new(list(reversed(front)))
    f_back = bm.faces.new(back)
    sides = [bm.faces.new((front[i], front[(i + 1) % n], back[(i + 1) % n], back[i])) for i in range(n)]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in [f_front, f_back] + sides:
        for lp in f.loops:
            y, z = lp.vert.co.y, lp.vert.co.z
            lp[uv].uv = (min(max((-y + 0.13) / 0.26, 0.01), 0.99), min(max((z - 0.17) / 0.30, 0.01), 0.99))
    for f in sides:   # the rim reads as the frame colour, not as the face
        for lp in f.loops:
            lp[uv].uv = (0.5, 0.012)
    mat = M.image_diffuse('racket_face', face_img, 0.6) if face_img else M.matte('#1E2024', 'racket_carbon', 0.5)
    body = mesh_object('racket', bm, coll, mat)
    add_bevel(body, 0.006, 3)
    grip = cylinder('racket_grip', 0.0185, 0.122, (0, 0, 0.061), coll, M.matte('#F1EEE7', 'grip_tape', 0.85), segs=24, bevel=0.003)
    grip.scale = (1.0, 0.92, 1.0)
    cap = cylinder('racket_cap', 0.0205, 0.012, (0, 0, 0.006), coll, M.matte('#1E2024', 'racket_carbon', 0.5), segs=24, bevel=0.003)
    return [body, grip, cap]


def box_uv(ob, tile: float) -> None:
    """ArtUV for a box-like mesh: every face is mapped flat along its own normal, `tile` metres
    per repeat (for photographed fabric)."""
    me = ob.data
    uv = me.uv_layers.get('ArtUV') or me.uv_layers.new(name='ArtUV')
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        u_ax, v_ax = [(1, 2), (0, 2), (0, 1)][ax]
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co[u_ax] / tile, co[v_ax] / tile)


def bench(coll, boucle, centre, length=1.12, depth=0.34, height=0.4) -> list:
    """A low oak bench under the cork board with a boucle seat pad, two game boxes on it."""
    cx, cy = centre
    oak = M.oak('oak_bench', 'light', 'Y')
    parts = [box('bench_top', (depth, length, 0.03), (cx, cy, height - 0.015), coll, oak, bevel=0.006)]
    for sy in (-1, 1):
        for sx in (-1, 1):
            parts.append(tapered_leg(f'bench_leg_{sx}_{sy}', (cx + sx * (depth / 2 - 0.05), cy + sy * (length / 2 - 0.09), height - 0.03), 0.013, 0.02, height - 0.03, coll, oak, tilt=(sx * 0.012, sy * 0.03)))
    pad_mat = M.image_tiled('boucle_pad', boucle, 0.97) if boucle else M.wool('#D9CFBE', 'pad_wool', 200.0)
    pad = box('bench_pad', (depth - 0.02, length * 0.56, 0.055), (cx, cy + length * 0.19, height + 0.0275), coll, pad_mat, bevel=0.02, segments=4)
    box_uv(pad, 0.42)
    smooth(pad)
    parts.append(pad)
    # card night lives here: two game boxes
    stack = height
    for i, (col, w, d, t, rot) in enumerate((('#1D2D3D', 0.27, 0.19, 0.045, 7.0), ('#C8432B', 0.2, 0.14, 0.035, -9.0))):
        z = stack + t / 2
        stack += t
        gb = box(f'bench_game_{i}', (d, w, t), (cx + 0.01, cy - length * 0.29, z), coll, M.paper(col, f'game_box_{col}'), bevel=0.003, rot_z=math.radians(rot))
        parts.append(gb)
        parts.append(box(f'bench_game_label_{i}', (d * 0.6, w * 0.5, 0.0008), (cx + 0.01, cy - length * 0.29, z + t / 2 + 0.0004), coll, M.paper('#F4F0E6', 'game_label'), rot_z=math.radians(rot)))
    return parts
