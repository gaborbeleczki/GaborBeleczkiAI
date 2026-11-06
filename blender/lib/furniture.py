"""Furniture: oak desk, desk chair, fluted sideboard, floating shelves, lounge chair,
side table, rug and the three lamps. Original, generic Nordic shapes.
"""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import materials as M
from .room import X0
from .util import RNG, add_bevel, box, cylinder, mesh_object, revolve, smooth, sphere, tag, tube_along

DESK = dict(x=-0.1, y=1.72, w=1.6, d=0.72, top=0.75)
SIDEBOARD = dict(x0=X0 + 0.012, depth=0.45, y0=-0.7, y1=1.3, z0=0.14, z1=0.66)
SHELF_Z = (1.24, 1.64)
SHELF = dict(depth=0.25, y0=-0.55, y1=1.15, t=0.034)


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

def build_desk_chair(coll, loc=(-0.02, 1.0), rot_z=math.radians(-6)) -> list:
    oak = M.oak('oak_chair', 'light', 'Z')
    seat_mat = M.wool('#3F4246', 'wool_charcoal', 300.0)
    parent = group_parent('desk_chair', (loc[0], loc[1], 0), rot_z, coll)
    parts = []
    sw, sd, sh = 0.46, 0.43, 0.45
    parts.append(box('chair_seat', (sw, sd, 0.03), (0, 0, sh - 0.015), coll, oak, bevel=0.012))
    parts.append(box('chair_pad', (sw - 0.05, sd - 0.06, 0.03), (0, -0.01, sh + 0.012), coll, seat_mat, bevel=0.012, segments=4))
    for sx in (-1, 1):
        # front legs
        parts.append(tapered_leg(f'chair_fleg_{sx}', (sx * (sw / 2 - 0.04), -(sd / 2 - 0.04), sh - 0.03), 0.014, 0.019, sh - 0.03, coll, oak, tilt=(sx * 0.02, -0.025)))
        # back legs continue up as the back posts
        bx = sx * (sw / 2 - 0.045)
        parts.append(tube_along(f'chair_post_{sx}', [(bx + sx * 0.012, sd / 2 - 0.03 + 0.03, 0.0), (bx, sd / 2 - 0.04, sh), (bx - sx * 0.005, sd / 2 - 0.0, 0.8)], 0.017, coll, oak))
    # curved top rail
    rail = []
    for i in range(13):
        t = i / 12
        a = math.radians(-58 + 116 * t)
        rail.append((math.sin(a) * 0.27, sd / 2 - 0.13 + math.cos(a) * 0.14, 0.79))
    parts.append(tube_along('chair_rail', rail, 0.02, coll, oak))
    # two flat back slats
    for sx in (-1, 1):
        parts.append(box(f'chair_slat_{sx}', (0.02, 0.018, 0.28), (sx * 0.07, sd / 2 - 0.0, 0.63), coll, oak, bevel=0.006))
    # stretchers
    parts.append(tube_along('chair_str_f', [(-(sw / 2 - 0.05), -(sd / 2 - 0.06), 0.16), ((sw / 2 - 0.05), -(sd / 2 - 0.06), 0.16)], 0.009, coll, oak))
    parts.append(tube_along('chair_str_b', [(-(sw / 2 - 0.05), (sd / 2 - 0.05), 0.2), ((sw / 2 - 0.05), (sd / 2 - 0.05), 0.2)], 0.009, coll, oak))
    parent_all(parts, parent)
    for p in parts:
        tag(p, bake='furniture')
    return parts


def build_lounge_chair(coll, loc=(1.68, 1.42), facing=(-0.55, -0.84)) -> list:
    """Low lounge chair: oak frame, oat wool cushions, a lingonberry throw."""
    rot = math.atan2(-facing[0], facing[1]) + math.pi  # model faces -y
    rot = math.atan2(facing[0], -facing[1])
    parent = group_parent('lounge_chair', (loc[0], loc[1], 0), rot, coll)
    oak = M.oak('oak_lounge', 'warm', 'Y')
    wool = M.wool('#D9CFBF', 'wool_oat', 220.0)
    parts = []
    W, D = 0.74, 0.80
    for sx in (-1, 1):
        x = sx * (W / 2 - 0.03)
        # side frame: front leg, back leg, armrest
        parts.append(tube_along(f'lc_front_{sx}', [(x, -D / 2 + 0.06, 0.0), (x, -D / 2 + 0.07, 0.56)], 0.022, coll, oak))
        parts.append(tube_along(f'lc_back_{sx}', [(x, D / 2 + 0.02, 0.0), (x, D / 2 - 0.05, 0.36), (x, D / 2 + 0.03, 0.82)], 0.022, coll, oak))
        parts.append(box(f'lc_arm_{sx}', (0.07, D - 0.02, 0.026), (x, 0.0, 0.575), coll, oak, bevel=0.01))
        parts.append(tube_along(f'lc_rail_{sx}', [(x, -D / 2 + 0.07, 0.26), (x, D / 2 - 0.03, 0.26)], 0.016, coll, oak))
    parts.append(tube_along('lc_rail_f', [(-W / 2 + 0.03, -D / 2 + 0.07, 0.26), (W / 2 - 0.03, -D / 2 + 0.07, 0.26)], 0.016, coll, oak))
    parts.append(tube_along('lc_rail_b', [(-W / 2 + 0.03, D / 2 - 0.04, 0.3), (W / 2 - 0.03, D / 2 - 0.04, 0.3)], 0.016, coll, oak))
    # cushions: thick rounded boxes with a subdivision for softness
    seat = box('lc_seat', (W - 0.1, D - 0.12, 0.13), (0, -0.02, 0.34), coll, wool, bevel=0.045, segments=5)
    back = box('lc_backcushion', (W - 0.1, 0.14, 0.5), (0, D / 2 - 0.12, 0.6), coll, wool, bevel=0.05, segments=5)
    back.rotation_euler.x = math.radians(-14)
    for c in (seat, back):
        sub = c.modifiers.new('Sub', 'SUBSURF')
        sub.levels = 2
        sub.render_levels = 2
        smooth(c)
    parts += [seat, back]
    # folded wool throw over the right armrest
    throw = box('lc_throw', (0.2, 0.46, 0.05), (W / 2 - 0.03, 0.06, 0.6), coll, M.wool('#B5483A', 'wool_lingon', 160.0), bevel=0.02, segments=4)
    throw.rotation_euler.y = math.radians(8)
    sub = throw.modifiers.new('Sub', 'SUBSURF')
    sub.levels = 2
    smooth(throw)
    parts.append(throw)
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


def build_side_table(coll, loc=(1.0, 0.98)) -> list:
    oak = M.oak('oak_table', 'warm', 'X')
    parts = [cylinder('st_top', 0.24, 0.026, (loc[0], loc[1], 0.52), coll, oak, segs=48, bevel=0.006)]
    for k in range(3):
        a = k * 2 * math.pi / 3 + 0.4
        tx, ty = loc[0] + math.cos(a) * 0.15, loc[1] + math.sin(a) * 0.15
        parts.append(tapered_leg(f'st_leg_{k}', (tx, ty, 0.507), 0.012, 0.018, 0.507, coll, oak, tilt=(math.cos(a) * 0.05, math.sin(a) * 0.05)))
    for p in parts:
        tag(p, bake='furniture')
    return parts


def build_rug(coll, center=(0.55, 0.95), size=(2.7, 1.85)) -> list:
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

def build_pendant(coll, coll_dyn, loc=(-0.15, 1.62), bottom=1.93) -> dict:
    white = M.ceramic('#F2EFE9', 'ceramic_shade', 0.45, speckle=False)
    inner = M.emission('#FFE2BC', 1.5, 'pendant_inner')
    prof = [(0.215, 0.0), (0.212, 0.012), (0.19, 0.07), (0.14, 0.13), (0.07, 0.17), (0.03, 0.185), (0.03, 0.2)]
    shade = revolve('pendant_shade', prof, coll, white, loc=(loc[0], loc[1], bottom), segs=64, cap_bottom=False, cap_top=True)
    sol = shade.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.004
    # glowing inner disc (bulb diffuser) just inside the rim
    disc = cylinder('pendant_diffuser', 0.09, 0.004, (loc[0], loc[1], bottom + 0.11), coll_dyn, inner, segs=32)
    tag(disc, dyn='emitter', glow='#FFE2BC', strength=1.5)
    cord = tube_along('pendant_cord', [(loc[0], loc[1], bottom + 0.2), (loc[0], loc[1], 2.85)], 0.0035, coll, M.matte('#1E1E20', 'cord', 0.6))
    rose = cylinder('pendant_rose', 0.055, 0.025, (loc[0], loc[1], 2.85 - 0.0125), coll, white, segs=32)
    parts = [shade, cord, rose]
    for p in parts:
        tag(p, bake='furniture')
    for p in (shade, cord):
        tag(p, sway='pendant')
    return {'parts': parts, 'light_pos': (loc[0], loc[1], bottom + 0.09)}


def build_floor_lamp(coll, coll_dyn, loc=(2.2, 1.95)) -> dict:
    iron = M.matte('#2B2B2D', 'black_iron', 0.45)
    shade_mat = M.lampshade('#EFE8DA', 'linen_shade', glow=0.0)
    parts = [cylinder('fl_base', 0.15, 0.022, (loc[0], loc[1], 0.011), coll, iron, segs=48, bevel=0.006)]
    parts.append(tube_along('fl_pole', [(loc[0], loc[1], 0.02), (loc[0], loc[1], 1.45)], 0.009, coll, iron))
    shade = revolve('fl_shade', [(0.21, 0.0), (0.205, 0.30)], coll_dyn, shade_mat, loc=(loc[0], loc[1], 1.38), segs=64, cap_bottom=False)
    sol = shade.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.003
    tag(shade, dyn='emitter', glow='#FFD2A0', strength=0.9, base='#EFE8DA')
    for p in parts:
        tag(p, bake='furniture')
    return {'parts': parts, 'light_pos': (loc[0], loc[1], 1.55), 'shade': shade}


def build_desk_lamp(coll, coll_dyn, base=(-0.8, 1.93)) -> dict:
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
