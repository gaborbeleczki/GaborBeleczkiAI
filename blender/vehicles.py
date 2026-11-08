"""Vehicles for the window view, modelled in Blender and rendered as side-view sprites.

Cars (sedans, hatchbacks, a yellow Budapest taxi, a van), a blue city bus, the yellow
articulated tram on line 2 and two river boats. Each is rendered twice with a transparent
background: by day (sun and sky) and by night (body in near darkness, lit windows and lamps).
The sprites are packed into two atlases with the same layout:

  public/textures/vehicles_day.webp, vehicles_night.webp (lossless, premultiplied alpha)
  public/models/vehicles.json                            (layout, sizes, lamp positions)

Run with the bpy venv:  python blender/vehicles.py
"""

from __future__ import annotations

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import bpy  # noqa: E402  (bpy first: it makes bmesh importable)
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402
from PIL import Image  # noqa: E402

from lib import materials as M  # noqa: E402
from lib.util import mesh_object, reset_scene  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'blender', 'out', 'vehicles')
TEX = os.path.join(ROOT, 'public', 'textures')
MODELS = os.path.join(ROOT, 'public', 'models')


# ------------------------------------------------------------------ materials

def paint(color: str, name: str):
    m, nt, b = M._new(name)
    M.set_in(b, 'Base Color', M.hex_rgb(color))
    M.set_in(b, 'Roughness', 0.32)
    M.set_in(b, ('Coat Weight', 'Clearcoat'), 0.6)
    return m


def flat(color: str, name: str, rough=0.6, metal=0.0):
    m, nt, b = M._new(name)
    M.set_in(b, 'Base Color', M.hex_rgb(color))
    M.set_in(b, 'Roughness', rough)
    M.set_in(b, 'Metallic', metal)
    return m


def lamp(color: str, name: str, day_color: str):
    """A lens: plain plastic by day, glowing at night (emission set per render)."""
    m, nt, b = M._new(name)
    M.set_in(b, 'Base Color', M.hex_rgb(day_color))
    M.set_in(b, 'Roughness', 0.25)
    M.set_in(b, ('Emission Color', 'Emission'), M.hex_rgb(color))
    M.set_in(b, 'Emission Strength', 0.0)
    m['glow'] = 1
    return m


def window_glass(name: str, night_color='#FFC98A'):
    m, nt, b = M._new(name)
    M.set_in(b, 'Base Color', M.hex_rgb('#1B2128'))
    M.set_in(b, 'Roughness', 0.08)
    M.set_in(b, ('Emission Color', 'Emission'), M.hex_rgb(night_color))
    M.set_in(b, 'Emission Strength', 0.0)
    m['cabin'] = 1
    return m


# ------------------------------------------------------------------ geometry helpers

def prism(name, profile, y0, y1, mat, bevel=0.0):
    """Extrude a side profile (x, z points, counter-clockwise) across y0..y1."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for x, z in profile]
    b = [bm.verts.new((x, y1, z)) for x, z in profile]
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    n = len(profile)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_object(name, bm, bpy.context.scene.collection, mat)
    if bevel > 0:
        mod = ob.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = 'ANGLE'
    return ob


def slab(name, x0, x1, z0, z1, y, mat, depth=0.02, bevel=0.0):
    """A thin panel on the near side (y), for windows, doors and lamps."""
    return prism(name, [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y - depth, y, mat, bevel)


def wheel(x, r, y, width=0.24, tyre='#16171A', rim='#9EA2A8'):
    parts = []
    for side in (y, -y):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=r, radius2=r, depth=width)
        ob = mesh_object('tyre', bm, bpy.context.scene.collection, flat(tyre, 'tyre', 0.8))
        ob.rotation_euler.x = math.radians(90)
        ob.location = (x, side, r)
        parts.append(ob)
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=r * 0.62, radius2=r * 0.62, depth=width + 0.02)
        ob = mesh_object('rim', bm, bpy.context.scene.collection, flat(rim, 'rim', 0.35, 0.8))
        ob.rotation_euler.x = math.radians(90)
        ob.location = (x, side, r)
        parts.append(ob)
    return parts


# ------------------------------------------------------------------ vehicles (front at +x)

def car(color: str, kind='sedan'):
    """Side profiles of an everyday saloon, hatchback or van; 1.8 m wide."""
    body = paint(color, f'paint_{color}')
    w = 0.9
    if kind == 'sedan':
        L = 4.6
        prof = [(0.0, 0.32), (4.6, 0.32), (4.62, 0.62), (4.45, 0.82), (3.4, 0.98), (2.9, 1.42), (1.45, 1.44), (0.95, 1.02), (0.05, 0.92), (-0.02, 0.62)]
        win = [(1.55, 1.02), (3.25, 1.02), (2.82, 1.37), (1.62, 1.38)]
        wheels = (0.95, 3.7)
    elif kind == 'hatch':
        L = 4.1
        prof = [(0.0, 0.32), (4.1, 0.32), (4.12, 0.6), (3.95, 0.8), (3.05, 0.96), (2.55, 1.42), (0.7, 1.46), (0.12, 1.12), (-0.02, 0.62)]
        win = [(0.62, 1.04), (2.9, 1.0), (2.48, 1.38), (0.74, 1.4)]
        wheels = (0.8, 3.3)
    else:  # van
        L = 5.2
        prof = [(0.0, 0.34), (5.2, 0.34), (5.22, 0.66), (5.05, 0.92), (4.35, 1.2), (3.85, 2.02), (0.1, 2.06), (0.0, 1.95)]
        win = [(3.95, 1.25), (4.3, 1.25), (3.88, 1.86), (3.6, 1.86)]
        wheels = (1.0, 4.15)
    parts = [prism('body', prof, -w, w, body, bevel=0.06)]
    glass = flat('#1A2129', 'glass', 0.06)
    xs = [p[0] for p in win]
    parts.append(prism('windows', win, -w - 0.012, -w + 0.02, glass))
    if kind != 'van':
        # B-pillar
        mid = (min(xs) + max(xs)) / 2
        parts.append(slab('pillar', mid - 0.05, mid + 0.05, 1.0, 1.42, -w - 0.014, body, 0.03))
    # bumpers and sills in dark trim
    trim = flat('#2A2C30', 'trim', 0.55)
    parts.append(slab('sill', wheels[0] + 0.35, wheels[1] - 0.35, 0.32, 0.42, -w - 0.006, trim, 0.03))
    parts.append(slab('door_line', (wheels[0] + wheels[1]) / 2 - 0.01, (wheels[0] + wheels[1]) / 2 + 0.01, 0.45, 0.98, -w - 0.008, trim, 0.02))
    head = lamp('#FFF4DE', 'headlamp', '#E9EDF2')
    tail = lamp('#FF2A12', 'taillamp', '#B4251C')
    parts.append(slab('head', L - 0.2, L + 0.02, 0.66, 0.8, -w + 0.05, head, 0.2))
    parts.append(slab('tail', -0.03, 0.14, 0.72, 0.86, -w + 0.05, tail, 0.2))
    parts += wheel(wheels[0], 0.33, -w + 0.1)
    parts += wheel(wheels[1], 0.33, -w + 0.1)
    return parts, L, 2.06 if kind == 'van' else 1.46, {'head': (L, 0.73), 'tail': (0.0, 0.79)}


def taxi():
    parts, L, H, lamps = car('#F2C200', 'hatch')
    sign = flat('#F7F3E3', 'taxi_sign', 0.4)
    parts.append(slab('taxi_sign', 1.25, 1.85, 1.46, 1.62, -0.2, sign, 0.4, bevel=0.02))
    return parts, L, 1.62, lamps


def bus():
    """A 12 m city bus in Budapest blue."""
    L, H, w = 12.0, 3.05, 1.27
    blue = paint('#1C63B5', 'bus_blue')
    prof = [(0.0, 0.38), (L, 0.38), (L + 0.02, 2.75), (L - 0.15, 3.02), (0.15, 3.02), (-0.02, 2.75)]
    parts = [prism('bus', prof, -w, w, blue, bevel=0.08)]
    glass = window_glass('bus_glass', '#FFE7B8')
    # one long band of windows split by pillars, a door forward and one in the middle
    for x0, x1 in ((0.35, 2.3), (2.45, 4.7), (6.1, 8.3), (8.45, 9.8)):
        parts.append(slab('bus_win', x0, x1, 1.32, 2.62, -w - 0.01, glass, 0.03))
    door = flat('#20262E', 'bus_door', 0.2)
    for x0, x1 in ((4.85, 5.95), (10.0, 11.1)):
        parts.append(slab('bus_door', x0, x1, 0.45, 2.62, -w - 0.012, door, 0.03))
    parts.append(slab('bus_wind', L - 0.04, L + 0.02, 0.95, 2.7, -w + 0.1, glass, 2 * w - 0.2))
    parts.append(slab('bus_skirt', 0.0, L, 0.38, 0.62, -w - 0.006, flat('#1E1F22', 'skirt', 0.6), 0.02))
    head = lamp('#FFF4DE', 'headlamp', '#E9EDF2')
    tail = lamp('#FF2A12', 'taillamp', '#B4251C')
    parts.append(slab('head', L - 0.12, L + 0.03, 0.62, 0.86, -w + 0.12, head, 0.2))
    parts.append(slab('tail', -0.03, 0.1, 0.7, 1.15, -w + 0.12, tail, 0.2))
    parts.append(slab('route', L - 0.6, L + 0.0, 2.72, 2.95, -w - 0.01, lamp('#FFB347', 'route_sign', '#202020'), 0.03))
    parts += wheel(2.55, 0.5, -w + 0.16, 0.3)
    parts += wheel(8.6, 0.5, -w + 0.16, 0.3)
    return parts, L, H, {'head': (L, 0.74), 'tail': (0.0, 0.92)}


def tram():
    """Line 2's articulated tram: three yellow sections with a white roof band and a pantograph."""
    seg, gap = 9.6, 0.6
    L = 3 * seg + 2 * gap
    w = 1.2
    yellow = paint('#F2BD1D', 'tram_yellow')
    white = paint('#EDEBE4', 'tram_white')
    grey = flat('#3B3E43', 'tram_grey', 0.6)
    glass = window_glass('tram_glass', '#FFE3A8')
    parts = []
    for k in range(3):
        x0 = k * (seg + gap)
        x1 = x0 + seg
        nose_l = 0.5 if k == 0 else 0.0
        nose_r = 0.5 if k == 2 else 0.0
        prof = [(x0 + nose_l * 0.4, 0.42), (x1 - nose_r * 0.4, 0.42), (x1, 1.1), (x1 - nose_r, 3.25), (x0 + nose_l, 3.25), (x0, 1.1)]
        parts.append(prism(f'tram_{k}', prof, -w, w, yellow, bevel=0.07))
        parts.append(slab(f'tram_roof_{k}', x0 + nose_l + 0.05, x1 - nose_r - 0.05, 2.78, 3.24, -w - 0.01, white, 0.03))
        parts.append(slab(f'tram_skirt_{k}', x0 + 0.1, x1 - 0.1, 0.42, 0.72, -w - 0.008, grey, 0.02))
        # windows, with a door in each section
        n = 4
        span = (x1 - x0 - 0.8) / n
        for i in range(n):
            wx0 = x0 + 0.4 + i * span + 0.12
            wx1 = wx0 + span - 0.24
            if i == 1:
                parts.append(slab('tram_door', wx0, wx1, 0.5, 2.62, -w - 0.012, glass, 0.03))
            else:
                parts.append(slab('tram_win', wx0, wx1, 1.25, 2.62, -w - 0.012, glass, 0.03))
        parts += wheel(x0 + 2.2, 0.36, -w + 0.2, 0.2, '#202124', '#55585D')
        parts += wheel(x1 - 2.2, 0.36, -w + 0.2, 0.2, '#202124', '#55585D')
        if k < 2:
            parts.append(slab('bellows', x1 - 0.05, x1 + gap + 0.05, 0.75, 3.05, -w + 0.1, flat('#1B1C1F', 'bellows', 0.9), 2 * w - 0.2))
    # pantograph on the middle section
    mid = seg + gap + seg / 2
    rod = flat('#2B2D31', 'rod', 0.5, 0.6)
    for a, b in (((mid - 0.9, 3.3), (mid, 4.0)), ((mid, 4.0), (mid + 0.9, 3.3)), ((mid - 0.6, 4.0), (mid + 0.6, 4.0))):
        dx, dz = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dz)
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.035, radius2=0.035, depth=length)
        ob = mesh_object('panto', bm, bpy.context.scene.collection, rod)
        ob.location = ((a[0] + b[0]) / 2, -0.3, (a[1] + b[1]) / 2)
        ob.rotation_euler.y = math.atan2(dx, dz)
        parts.append(ob)
    head = lamp('#FFF4DE', 'headlamp', '#E9EDF2')
    tail = lamp('#FF2A12', 'taillamp', '#B4251C')
    parts.append(slab('head', L - 0.12, L + 0.03, 0.78, 1.0, -w + 0.1, head, 0.2))
    parts.append(slab('tail', -0.03, 0.1, 0.8, 1.05, -w + 0.1, tail, 0.2))
    return parts, L, 4.05, {'head': (L, 0.9), 'tail': (0.0, 0.92)}


def boat(kind='cruise'):
    """River boats: a long cruise ship (two decks of cabins) or a glass-roofed sightseeing boat."""
    w = 4.5 if kind == 'cruise' else 3.6
    hull_c = paint('#F3F1EC', 'hull_white')
    band = paint('#1C3557', 'hull_band')
    glass = window_glass('boat_glass', '#FFC77D')
    parts = []
    if kind == 'cruise':
        L, H = 56.0, 7.4
        hull = [(1.5, 0.0), (L - 4.0, 0.0), (L, 1.6), (L - 0.3, 2.4), (0.0, 2.4), (0.0, 1.0)]
        parts.append(prism('hull', hull, -w, w, hull_c, bevel=0.1))
        parts.append(slab('band', 0.6, L - 1.2, 0.0, 0.75, -w - 0.01, band, 0.03))
        decks = [(1.5, L - 7.0, 2.4, 4.5), (4.0, L - 10.0, 4.5, 6.4)]
        for i, (x0, x1, z0, z1) in enumerate(decks):
            parts.append(prism(f'deck_{i}', [(x0, z0), (x1, z0), (x1 + 0.6, z1 - 0.3), (x1, z1), (x0, z1)], -w + 0.3, w - 0.3, hull_c, bevel=0.06))
            n = int((x1 - x0) / 2.2)
            for k in range(n):
                wx = x0 + 0.7 + k * (x1 - x0 - 1.2) / n
                parts.append(slab('cabin_win', wx, wx + 1.3, z0 + 0.65, z1 - 0.45, -w + 0.28, glass, 0.03))
        # wheelhouse and sun deck rail
        parts.append(prism('wheelhouse', [(L - 15.0, 6.4), (L - 10.5, 6.4), (L - 10.0, 7.3), (L - 15.0, 7.3)], -2.0, 2.0, hull_c, bevel=0.05))
        parts.append(slab('wh_glass', L - 14.6, L - 10.3, 6.7, 7.15, -2.02, glass, 0.03))
        rail = flat('#8D9298', 'rail', 0.4, 0.7)
        parts.append(slab('rail', 4.0, L - 16.0, 7.0, 7.07, -w + 0.3, rail, 0.03))
        for k in range(18):
            x = 4.0 + k * (L - 20.0) / 17
            parts.append(slab('post', x, x + 0.06, 6.4, 7.05, -w + 0.3, rail, 0.03))
        parts.append(slab('funnel', 26.0, 27.6, 6.4, 7.4, -1.0, band, 0.6, bevel=0.05))
        lamps = {'head': (L - 1.0, 2.3), 'tail': (0.4, 2.3)}
    else:
        L, H = 40.0, 5.0
        hull = [(1.0, 0.0), (L - 3.0, 0.0), (L, 1.4), (L - 0.3, 2.0), (0.0, 2.0), (0.0, 0.9)]
        parts.append(prism('hull', hull, -w, w, hull_c, bevel=0.1))
        parts.append(slab('band', 0.5, L - 1.0, 0.0, 0.6, -w - 0.01, band, 0.03))
        cab = [(2.5, 2.0), (L - 5.0, 2.0), (L - 4.0, 3.2), (L - 6.0, 4.6), (3.5, 4.6), (2.5, 3.8)]
        parts.append(prism('cabin', cab, -w + 0.4, w - 0.4, glass, bevel=0.15))
        parts.append(prism('roof', [(3.3, 4.55), (L - 6.2, 4.55), (L - 6.0, 4.7), (3.3, 4.7)], -w + 0.3, w - 0.3, hull_c))
        rib = flat('#E9E9E6', 'rib', 0.4)
        for k in range(12):
            x = 3.2 + k * (L - 9.4) / 11
            parts.append(slab('rib', x, x + 0.18, 2.0, 4.6, -w + 0.36, rib, 0.03))
        lamps = {'head': (L - 1.0, 1.9), 'tail': (0.4, 1.9)}
    return parts, L, H, lamps


# ------------------------------------------------------------------ rendering

def set_glow(on: bool):
    for m in bpy.data.materials:
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m.node_tree else None
        if b is None:
            continue
        if m.get('glow'):
            M.set_in(b, 'Emission Strength', 6.0 if on else 0.0)
        if m.get('cabin'):
            M.set_in(b, 'Emission Strength', 0.85 if on else 0.0)


def lights(night: bool):
    for ob in list(bpy.data.objects):
        if ob.type == 'LIGHT':
            bpy.data.objects.remove(ob, do_unlink=True)
    w = bpy.data.worlds.get('w') or bpy.data.worlds.new('w')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    if night:
        bg.inputs['Color'].default_value = (0.05, 0.06, 0.09, 1)
        bg.inputs['Strength'].default_value = 0.6
        # sodium-orange street light from above, a little from the front
        ld = bpy.data.lights.new('street', 'SUN')
        ld.energy = 0.35
        ld.color = (1.0, 0.62, 0.32)
        ob = bpy.data.objects.new('street', ld)
        ob.rotation_euler = (math.radians(20), math.radians(10), 0)
    else:
        bg.inputs['Color'].default_value = (0.62, 0.7, 0.82, 1)
        bg.inputs['Strength'].default_value = 0.9
        ld = bpy.data.lights.new('sun', 'SUN')
        ld.energy = 3.2
        ld.color = (1.0, 0.96, 0.9)
        ld.angle = math.radians(2)
        ob = bpy.data.objects.new('sun', ld)
        ob.rotation_euler = (math.radians(38), math.radians(-25), math.radians(-20))
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.scene.world = w


def render(L: float, H: float, ppm: float, path: str, samples=24):
    sc = bpy.context.scene
    pad = 0.25
    cam = bpy.data.objects.get('cam')
    if cam is None:
        cd = bpy.data.cameras.new('cam')
        cd.type = 'ORTHO'
        cam = bpy.data.objects.new('cam', cd)
        sc.collection.objects.link(cam)
    w_m, h_m = L + 2 * pad, H + 2 * pad
    cam.data.ortho_scale = max(w_m, h_m)
    cam.data.sensor_fit = 'HORIZONTAL' if w_m >= h_m else 'VERTICAL'
    # seen from the side and a touch from above, as from the hill across the river
    cam.location = (L / 2, -30, H / 2 + 30 * math.tan(math.radians(6)))
    cam.rotation_euler = (math.radians(84), 0, 0)
    sc.camera = cam
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = max(8, round(w_m * ppm))
    sc.render.resolution_y = max(8, round(h_m * ppm))
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return sc.render.resolution_x, sc.render.resolution_y, pad


SPRITES = [
    # name, kind, builder, pixels per metre
    ('sedan_white', 'car', lambda: car('#ECECEA', 'sedan'), 30),
    ('sedan_silver', 'car', lambda: car('#9EA3A8', 'sedan'), 30),
    ('sedan_black', 'car', lambda: car('#141518', 'sedan'), 30),
    ('sedan_blue', 'car', lambda: car('#1F3A66', 'sedan'), 30),
    ('hatch_red', 'car', lambda: car('#A3221B', 'hatch'), 30),
    ('hatch_grey', 'car', lambda: car('#5B6066', 'hatch'), 30),
    ('hatch_white', 'car', lambda: car('#E4E4E0', 'hatch'), 30),
    ('taxi', 'car', taxi, 30),
    ('van_white', 'car', lambda: car('#F0F0EC', 'van'), 26),
    ('bus', 'bus', bus, 22),
    ('tram', 'tram', tram, 18),
    ('cruise', 'boat', lambda: boat('cruise'), 13),
    ('sightseeing', 'boat', lambda: boat('sightseeing'), 15),
]


def premultiply(path: str) -> np.ndarray:
    im = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32) / 255.0
    im[..., :3] *= im[..., 3:4]
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = []
    for name, kind, build, ppm in SPRITES:
        reset_scene()
        parts, L, H, lamps = build()
        for ob in parts:
            if ob.modifiers:
                ob.select_set(False)
        for state in ('day', 'night'):
            lights(state == 'night')
            set_glow(state == 'night')
            w, h, pad = render(L, H, ppm, os.path.join(OUT, f'{name}_{state}.png'))
        meta.append({'name': name, 'kind': kind, 'length': L, 'height': H, 'px': [w, h], 'pad': pad, 'ppm': ppm, 'lamps': lamps})
        print(f'[vehicles] {name} {w}x{h}', flush=True)
    pack(meta)


def pack(meta):
    """Shelf-pack the sprites into a 2048-wide atlas (both states share the layout)."""
    W = 2048
    gap = 8
    x = y = gap
    row_h = 0
    for m in sorted(meta, key=lambda m: -m['px'][1]):
        w, h = m['px']
        if x + w + gap > W:
            x = gap
            y += row_h + gap
            row_h = 0
        m['at'] = [x, y]
        x += w + gap
        row_h = max(row_h, h)
    H = 1
    while H < y + row_h + gap:
        H *= 2
    for state in ('day', 'night'):
        atlas = np.zeros((H, W, 4), np.float32)
        for m in meta:
            im = premultiply(os.path.join(OUT, f"{m['name']}_{state}.png"))
            ax, ay = m['at']
            atlas[ay:ay + im.shape[0], ax:ax + im.shape[1]] = im
        img = Image.fromarray((np.clip(atlas, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
        img.save(os.path.join(OUT, f'atlas_{state}.png'))  # for looking at, not shipped
        img.save(os.path.join(TEX, f'vehicles_{state}.webp'), 'WEBP', lossless=True, quality=100, method=6, exact=True)
    out = {'size': [W, H], 'sprites': []}
    for m in meta:
        w, h = m['px']
        ax, ay = m['at']
        pad_px = m['pad'] * m['ppm']
        # the vehicle's own box inside the sprite (without the transparent margin), in atlas uv
        # with v measured from the bottom of the image (WebGL, flipY)
        x0 = (ax + pad_px) / W
        x1 = (ax + w - pad_px) / W
        y_top = ay + pad_px
        y_bot = ay + h - pad_px
        out['sprites'].append({
            'name': m['name'],
            'kind': m['kind'],
            'length': m['length'],
            'height': m['height'],
            'uv': [round(x0, 6), round(1 - y_bot / H, 6), round(x1 - x0, 6), round((y_bot - y_top) / H, 6)],
            'lamps': {k: [round(v[0] / m['length'], 4), round(v[1] / m['height'], 4)] for k, v in m['lamps'].items()},
        })
    with open(os.path.join(MODELS, 'vehicles.json'), 'w') as fh:
        json.dump(out, fh, indent=2)
    print(f'[vehicles] atlas {W}x{H}, {len(meta)} sprites', flush=True)


if __name__ == '__main__':
    main()
