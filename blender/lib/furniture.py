"""Furniture: oak desk, an upholstered shell chair, a fluted credenza, floating shelves,
a rug, the pendant and the desk lamp. Original, generic Nordic shapes.
"""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import materials as M
from .room import H, X0
from .util import RNG, add_bevel, box, cylinder, mesh_object, revolve, smooth, sphere, tag, tube_along

DESK = dict(x=-0.1, y=1.75, w=1.5, d=0.7, top=0.75)
SIDEBOARD = dict(x0=X0 + 0.012, depth=0.42, y0=0.12, y1=1.47, z0=0.14, z1=0.64)
SHELF_Z = (1.22, 1.6)
SHELF = dict(depth=0.25, y0=0.16, y1=1.43, t=0.034)
CHAIR = dict(x=0.0, y=1.02, rot=math.radians(160))


def tapered_leg(name, top, bottom_r, top_r, height, coll, mat, tilt=(0.0, 0.0)):
    """A round tapered leg hanging from `top` (x, y, z). tilt = (dx, dy) splay at the foot."""
    prof = [(bottom_r, 0.0), (bottom_r * 1.02, 0.004), (top_r, height)]
    ob = revolve(name, prof, coll, mat, segs=20, cap_bottom=True, cap_top=True)
    ob.location = (top[0] + tilt[0], top[1] + tilt[1], top[2] - height)
    # tilt the leg so its top meets `top`
    dx, dy = -tilt[0], -tilt[1]
    ob.rotation_euler = (math.atan2(dy, height) * -1, math.atan2(dx, height), 0)
    return ob


def group_parent(name, loc, rot_z, coll):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    e.rotation_euler.z = rot_z
    coll.objects.link(e)
    return e


def parent_all(objs, parent):
    for o in objs:
        o.parent = parent


# ------------------------------------------------------------------ desk

def build_desk(coll) -> list:
    d = DESK
    oak = M.oak('oak_desk', 'light', 'X')
    parts = []
    top = box('desk_top', (d['w'], d['d'], 0.03), (d['x'], d['y'], d['top'] - 0.015), coll, oak, bevel=0.008, segments=3)
    parts.append(top)
    # slim apron with a centred drawer
    apron_z = d['top'] - 0.03 - 0.035
    parts.append(box('desk_apron_b', (d['w'] - 0.16, 0.018, 0.07), (d['x'], d['y'] + d['d'] / 2 - 0.06, apron_z), coll, oak, bevel=0.003))
    parts.append(box('desk_apron_l', (0.018, d['d'] - 0.14, 0.07), (d['x'] - d['w'] / 2 + 0.08, d['y'], apron_z), coll, oak, bevel=0.003))
    parts.append(box('desk_apron_r', (0.018, d['d'] - 0.14, 0.07), (d['x'] + d['w'] / 2 - 0.08, d['y'], apron_z), coll, oak, bevel=0.003))
    parts.append(box('desk_drawer', (0.62, d['d'] - 0.16, 0.07), (d['x'] - 0.12, d['y'], apron_z), coll, oak, bevel=0.004))
    parts.append(box('desk_drawer_pull', (0.16, 0.012, 0.012), (d['x'] - 0.12, d['y'] - d['d'] / 2 + 0.072, apron_z - 0.01), coll, M.oak('oak_dark', 'warm', 'X'), bevel=0.005))
    for sx in (-1, 1):
        for sy in (-1, 1):
            tx = d['x'] + sx * (d['w'] / 2 - 0.085)
            ty = d['y'] + sy * (d['d'] / 2 - 0.075)
            parts.append(tapered_leg(f'desk_leg_{sx}_{sy}', (tx, ty, d['top'] - 0.03), 0.015, 0.022, d['top'] - 0.03, coll, oak, tilt=(sx * 0.025, sy * 0.02)))
    for p in parts:
        tag(p, bake='furniture')
    return parts


# ------------------------------------------------------------------ chairs

def shell_surface(name, coll, mat, seat_z=0.45, rx=0.27, ry=0.25, back_h=0.36, arm_h=0.17, flare=0.07, recline=0.09):
    """An upholstered tub shell as one continuous surface: a dished seat pan that rises into
    armrests and a reclined back, built on an (angle, height) grid and smoothed afterwards.
    The chair faces -y in its own space."""
    bm = bmesh.new()
    na, ns = 72, 22
    rows = []
    for j in range(ns + 1):
        t = j / ns
        ring = []
        for i in range(na):
            th = 2 * math.pi * i / na  # 0 = front (-y)
            front = 0.5 + 0.5 * math.cos(th)  # 1 at the front, 0 at the back
            wall = max(back_h * (1 - front) ** 1.25 + arm_h * math.sin(th) ** 2 * 0.35, 0.018)
            if t <= 0.55:
                k = t / 0.55
                r = k
                z = seat_z - 0.022 * (1 - k * k)  # a gentle dish
                lift = 0.0
            else:
                k = (t - 0.55) / 0.45
                r = 1.0 + (flare / rx) * k
                z = seat_z + wall * (1 - (1 - k) ** 2)
                lift = recline * k * (1 - front)
            ring.append(bm.verts.new((-math.sin(th) * rx * r, -math.cos(th) * ry * r + lift, z)))
        rows.append(ring)
    center = bm.verts.new((0, 0, seat_z - 0.022))
    for i in range(na):
        i2 = (i + 1) % na
        bm.faces.new((center, rows[1][i], rows[1][i2]))
    for j in range(1, ns):
        for i in range(na):
            i2 = (i + 1) % na
            bm.faces.new((rows[j][i], rows[j + 1][i], rows[j + 1][i2], rows[j][i2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_object(name, bm, coll, mat)
    sol = ob.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.024
    sol.offset = -1.0
    sub = ob.modifiers.new('Sub', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 2
    smooth(ob)
    return ob


def build_desk_chair(coll) -> list:
    """An upholstered shell armchair in oat wool on four splayed oak legs, turned out from
    the desk as if just left (it faces -y in its own space)."""
    c = CHAIR
    oak = M.oak('oak_chair', 'light', 'Z')
    wool = M.wool('#CFC6B6', 'wool_shell', 260.0)
    cushion_wool = M.wool('#B9AE9B', 'wool_cushion', 300.0)
    parent = group_parent('desk_chair', (c['x'], c['y'], 0), c['rot'], coll)
    seat_z = 0.45
    parts = [shell_surface('chair_shell', coll, wool, seat_z=seat_z)]
    # a loose seat cushion, slightly domed
    cush = box('chair_cushion', (0.42, 0.38, 0.05), (0, -0.015, seat_z + 0.012), coll, cushion_wool, bevel=0.022, segments=4)
    sub = cush.modifiers.new('Sub', 'SUBSURF')
    sub.levels = 2
    smooth(cush)
    parts.append(cush)
    # mounting plate under the seat and four splayed oak legs
    parts.append(box('chair_plate', (0.26, 0.24, 0.016), (0, 0.0, seat_z - 0.05), coll, M.matte('#2B2B2D', 'black_steel', 0.5), bevel=0.004))
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(tapered_leg(f'chair_leg_{sx}_{sy}', (sx * 0.11, sy * 0.1, seat_z - 0.058), 0.012, 0.018, seat_z - 0.058, coll, oak, tilt=(sx * 0.06, sy * 0.055)))
    parent_all(parts, parent)
    for p in parts:
        tag(p, bake='furniture')
    return parts


# ------------------------------------------------------------------ storage

def build_sideboard(coll) -> list:
    s = SIDEBOARD
    oak = M.oak('oak_sideboard', 'light', 'Y')
    parts = []
    x0, x1 = s['x0'], s['x0'] + s['depth']
    cx = (x0 + x1) / 2
    cy = (s['y0'] + s['y1']) / 2
    L = s['y1'] - s['y0']
    hb = s['z1'] - s['z0']
    parts.append(box('sb_top', (s['depth'] + 0.01, L + 0.02, 0.024), (cx + 0.005, cy, s['z1'] - 0.012), coll, oak, bevel=0.005))
    parts.append(box('sb_body', (s['depth'] - 0.03, L, hb - 0.024), (cx - 0.015, cy, s['z0'] + (hb - 0.024) / 2), coll, oak, bevel=0.003))
    # fluted doors on the +x face
    doors = 4
    dw = L / doors
    flutes = 12
    fw = (dw - 0.012) / flutes
    for di in range(doors):
        y_start = s['y0'] + di * dw + 0.006
        for fi in range(flutes):
            y = y_start + fw * (fi + 0.5)
            fl = box(f'sb_flute_{di}_{fi}', (0.018, fw * 0.92, hb - 0.05), (x1 - 0.009, y, s['z0'] + 0.012 + (hb - 0.05) / 2), coll, oak, bevel=fw * 0.42, segments=3)
            parts.append(fl)
    # four short tapered legs
    for yy in (s['y0'] + 0.08, s['y1'] - 0.08):
        for xx in (x0 + 0.06, x1 - 0.06):
            parts.append(tapered_leg(f'sb_leg_{yy:.2f}_{xx:.2f}', (xx, yy, s['z0']), 0.013, 0.02, s['z0'], coll, oak))
    for p in parts:
        tag(p, bake='furniture')
    return parts


def build_shelves(coll) -> list:
    sh = SHELF
    oak = M.oak('oak_shelf', 'light', 'Y')
    parts = []
    for i, z in enumerate(SHELF_Z):
        parts.append(box(f'shelf_{i}', (sh['depth'], sh['y1'] - sh['y0'], sh['t']), (X0 + sh['depth'] / 2, (sh['y0'] + sh['y1']) / 2, z - sh['t'] / 2), coll, oak, bevel=0.004))
    for p in parts:
        tag(p, bake='furniture')
    return parts


def build_rug(coll, center=(-0.05, 1.18), size=(2.1, 1.5)) -> list:
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for lp in f.loops:
            lp[uv].uv = (lp.vert.co.x / size[0] + 0.5, lp.vert.co.y / size[1] + 0.5)
    ob = mesh_object('rug', bm, coll, M.rug())
    ob.location = (center[0], center[1], 0.0)
    sol = ob.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.012
    sol.offset = 1.0
    add_bevel(ob, 0.004, 2)
    return [tag(ob, bake='furniture')]


# ------------------------------------------------------------------ lamps

def build_pendant(coll, coll_dyn, loc=(-0.12, 1.66), bottom=1.88) -> dict:
    white = M.ceramic('#F2EFE9', 'ceramic_shade', 0.45, speckle=False)
    inner = M.emission('#FFE2BC', 1.5, 'pendant_inner')
    prof = [(0.215, 0.0), (0.212, 0.012), (0.19, 0.07), (0.14, 0.13), (0.07, 0.17), (0.03, 0.185), (0.03, 0.2)]
    shade = revolve('pendant_shade', prof, coll, white, loc=(loc[0], loc[1], bottom), segs=64, cap_bottom=False, cap_top=True)
    sol = shade.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.004
    # glowing inner disc (bulb diffuser) just inside the rim
    disc = cylinder('pendant_diffuser', 0.09, 0.004, (loc[0], loc[1], bottom + 0.11), coll_dyn, inner, segs=32)
    tag(disc, dyn='emitter', glow='#FFE2BC', strength=1.5)
    cord = tube_along('pendant_cord', [(loc[0], loc[1], bottom + 0.2), (loc[0], loc[1], H)], 0.0035, coll, M.matte('#1E1E20', 'cord', 0.6))
    rose = cylinder('pendant_rose', 0.055, 0.025, (loc[0], loc[1], H - 0.0125), coll, white, segs=32)
    parts = [shade, cord, rose]
    for p in parts:
        tag(p, bake='furniture')
    for p in (shade, cord):
        tag(p, sway='pendant')
    return {'parts': parts, 'light_pos': (loc[0], loc[1], bottom + 0.09)}


def build_desk_lamp(coll, coll_dyn, base=(-0.74, 1.96)) -> dict:
    """A slim task lamp: weighted base, bent arm, small conical head aimed at the desk."""
    paint = M.matte('#E9E4DA', 'lamp_paint', 0.4)
    top = DESK['top']
    head_pos = Vector((base[0] + 0.2, base[1] - 0.2, top + 0.40))
    parts = [cylinder('dl_base', 0.07, 0.018, (base[0], base[1], top + 0.009), coll, paint, segs=48, bevel=0.005)]
    parts.append(tube_along('dl_arm', [(base[0], base[1], top + 0.018), (base[0] + 0.02, base[1] - 0.02, top + 0.44), head_pos + Vector((-0.02, 0.02, 0.04))], 0.0065, coll, paint))
    head = revolve('dl_head', [(0.075, 0.0), (0.07, 0.012), (0.04, 0.09), (0.018, 0.11)], coll, paint, segs=48, cap_bottom=False, cap_top=True)
    sol = head.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.003
    head.location = head_pos
    head.rotation_euler = (math.radians(-28), math.radians(-24), 0)
    parts.append(head)
    bulb = sphere('dl_bulb', 0.022, head_pos + Vector((0, 0, 0.02)), coll_dyn, M.emission('#FFE6C4', 4.0, 'bulb_warm'))
    tag(bulb, dyn='emitter', glow='#FFE6C4', strength=4.0)
    for p in parts:
        tag(p, bake='furniture')
    return {'parts': parts, 'light_pos': tuple(head_pos + Vector((0, 0, 0.01))), 'aim': (base[0] + 0.32, base[1] - 0.38, top)}
