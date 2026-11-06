"""Render the view out of the studio window: a stylised Budapest across the Danube.

Outputs (blender/out/city/ and public/textures/):
  city_evening.png / city_day.png   colour, rendered from the window centre (110° wide)
  city_lights_evening.png           emission only, drives twinkling in the shader
  city_data.png                     R = disparity (10 m / depth), G = water mask
  tram_evening.png / tram_day.png   side view of a tram for the shader to drive past
The camera sits at the window: 14 m above the Pest embankment, looking west.
"""

from __future__ import annotations

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import bpy  # noqa: E402  (must come first: it makes bmesh/mathutils importable)
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

from lib import materials as M  # noqa: E402
from lib.util import RNG, add_box, box, collection, cylinder, mesh_object, reset_scene, sphere, tube_along  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'blender', 'out', 'city')
HFOV = 110.0
RES = (int(os.environ.get('CITY_W', '2048')), int(os.environ.get('CITY_W', '2048')) // 2)
CAM_H = 14.0
NIGHT = {'value': 1.0}


# ------------------------------------------------------------------ materials with a day/night switch

def night_value_node(nt):
    v = nt.nodes.new('ShaderNodeValue')
    v.name = 'night'
    v.label = 'night'
    v.outputs[0].default_value = NIGHT['value']
    return v.outputs[0]


def facade(name, base, win_w=3.0, floor_h=3.4, lit_ratio=0.45, glow='#FFC98A', strength=6.0, flood=0.0):
    """Plaster facade with a grid of windows; some are lit at night. `flood` adds warm floodlight."""
    m, nt, b = M._new(name)
    co = M._coord(nt)
    rot = M._mapping(nt, co, rot=(math.radians(90), 0, 0))
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.offset = 0.0
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = win_w * 0.42
    br.inputs['Brick Width'].default_value = win_w
    br.inputs['Row Height'].default_value = floor_h
    br.inputs['Color1'].default_value = (0.0, 0.0, 0.0, 1)
    br.inputs['Color2'].default_value = (1.0, 1.0, 1.0, 1)
    br.inputs['Mortar'].default_value = (0, 0, 0, 1)
    nt.links.new(rot, br.inputs['Vector'])
    # br Fac: 1 on mortar (wall), 0 inside the window
    is_win = nt.nodes.new('ShaderNodeMath')
    is_win.operation = 'SUBTRACT'
    is_win.inputs[0].default_value = 1.0
    nt.links.new(br.outputs['Fac'], is_win.inputs[1])
    gray = nt.nodes.new('ShaderNodeRGBToBW')
    nt.links.new(br.outputs['Color'], gray.inputs[0])
    lit = nt.nodes.new('ShaderNodeMath')
    lit.operation = 'LESS_THAN'
    lit.inputs[1].default_value = lit_ratio
    nt.links.new(gray.outputs[0], lit.inputs[0])
    lit_win = nt.nodes.new('ShaderNodeMath')
    lit_win.operation = 'MULTIPLY'
    nt.links.new(is_win.outputs[0], lit_win.inputs[0])
    nt.links.new(lit.outputs[0], lit_win.inputs[1])
    night = night_value_node(nt)
    em = nt.nodes.new('ShaderNodeMath')
    em.operation = 'MULTIPLY'
    nt.links.new(lit_win.outputs[0], em.inputs[0])
    nt.links.new(night, em.inputs[1])
    em2 = nt.nodes.new('ShaderNodeMath')
    em2.operation = 'MULTIPLY'
    em2.inputs[1].default_value = strength
    nt.links.new(em.outputs[0], em2.inputs[0])
    if flood > 0:
        fl = nt.nodes.new('ShaderNodeMath')
        fl.operation = 'MULTIPLY_ADD'
        fl.inputs[1].default_value = flood
        nt.links.new(night, fl.inputs[0])
        nt.links.new(em2.outputs[0], fl.inputs[2])
        em_out = fl.outputs[0]
    else:
        em_out = em2.outputs[0]
    win_color = M._mix(nt, M.hex_rgb(base), M.hex_rgb('#3B4552'), is_win.outputs[0])
    nt.links.new(win_color, b.inputs['Base Color'])
    M.set_in(b, ('Emission Color', 'Emission'), M.hex_rgb(glow))
    nt.links.new(em_out, b.inputs['Emission Strength'])
    M.set_in(b, 'Roughness', 0.8)
    return m


def night_emission(name, color, strength):
    m, nt, b = M._new(name)
    M.set_in(b, 'Base Color', M.hex_rgb(color))
    M.set_in(b, ('Emission Color', 'Emission'), M.hex_rgb(color))
    night = night_value_node(nt)
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = strength
    nt.links.new(night, mul.inputs[0])
    nt.links.new(mul.outputs[0], b.inputs['Emission Strength'])
    return m


def water():
    m, nt, b = M._new('danube')
    co = M._coord(nt)
    v = M._mapping(nt, co, scale=(0.05, 0.4, 1.0))
    n = M._noise(nt, v, scale=6.0, detail=6.0, rough=0.6)
    M.set_in(b, 'Base Color', M.hex_rgb('#1E3346'))
    M.set_in(b, 'Roughness', 0.08)
    M.set_in(b, 'Metallic', 0.0)
    M.set_in(b, ('Specular IOR Level', 'Specular'), 0.9)
    nt.links.new(M._bump(nt, n.outputs['Fac'], 0.35, 0.3), b.inputs['Normal'])
    return m


def foliage(name='trees', color='#2F4433'):
    m, nt, b = M._new(name)
    co = M._coord(nt)
    n = M._noise(nt, co, scale=0.6, detail=8.0, rough=0.7)
    col = M._mix(nt, M.hex_rgb(color), M.hex_rgb('#4F6A44'), n.outputs['Fac'])
    nt.links.new(col, b.inputs['Base Color'])
    M.set_in(b, 'Roughness', 0.9)
    nt.links.new(M._bump(nt, n.outputs['Fac'], 1.0, 1.0), b.inputs['Normal'])
    return m


# ------------------------------------------------------------------ geometry

def hill(name, cx, cy, rx, ry, height, coll, mat, res=64, noise=0.08, power=1.0):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=res, y_segments=res, size=1.0)
    for v in bm.verts:
        x, y = v.co.x, v.co.y
        r2 = x * x + y * y
        h = math.exp(-(r2 ** power) * 2.6)
        h *= 1 + noise * (math.sin(x * 9.1 + y * 3.7) + 0.6 * math.sin(x * 23.0 - y * 17.0))
        v.co = Vector((cx + x * rx, cy + y * ry, h * height - 0.5))
    ob = mesh_object(name, bm, coll, mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def build_city():
    reset_scene()
    c = collection('CITY')
    plaster_light = '#D9CBB4'
    # ground on the Pest side (street, sidewalk) below the camera
    box('street', (1400, 26, 1.0), (0, 13, -0.5), c, M.matte('#3A3C40', 'asphalt', 0.75))
    box('sidewalk', (1400, 5, 1.0), (0, 2.5, -0.35), c, M.matte('#8C8A86', 'paving', 0.85))
    # tram tracks (two pairs of rails)
    for y in (17.2, 18.6, 20.4, 21.8):
        box(f'rail_{y}', (1400, 0.12, 0.08), (0, y, 0.04), c, M.metal('#9A9DA3', 'rail', 0.25))
    # embankment wall with a stone parapet
    box('quay_wall', (1400, 2.0, 7.0), (0, 25.0, -3.5), c, M.matte('#8E8676', 'stone', 0.9))
    box('parapet', (1400, 0.6, 1.0), (0, 24.2, 0.5), c, M.matte('#A39A88', 'stone_light', 0.85))
    # the Danube
    river = box('river', (3000, 420, 0.2), (0, 230, -5.1), c, water())
    river.pass_index = 1
    # Buda embankment
    box('buda_quay', (3000, 30, 6.0), (0, 452, -2.5), c, M.matte('#857D6F', 'stone_far', 0.9))
    # Buda riverside buildings with lit windows
    x = -900.0
    k = 0
    while x < 900:
        w = RNG.uniform(22, 40)
        h = RNG.uniform(16, 26)
        col = RNG.choice(['#D8C8AE', '#CDBFA6', '#E2D6C1', '#C9B79A', '#D6C2A0'])
        mat = facade(f'buda_facade_{k % 5}', col, lit_ratio=0.4)
        box(f'buda_bldg_{k}', (w - 1.5, 14, h), (x + w / 2, 478, h / 2 + 0.5), c, mat)
        box(f'buda_roof_{k}', (w - 1.5, 14, 3.5), (x + w / 2, 478, h + 2.2), c, M.matte('#4A4744', 'roof', 0.8))
        x += w
        k += 1
    # Castle Hill (long ridge) and Gellért Hill (big, to the left)
    green = foliage()
    hill('castle_hill', 40, 585, 660, 170, 70, c, green, noise=0.04, power=2.0)
    hill('gellert_hill', -780, 860, 420, 260, 135, c, foliage('trees_far', '#2B3D31'), noise=0.07)
    hill('buda_hills', 0, 3200, 4200, 700, 380, c, foliage('hills_far', '#3E4E5C'), noise=0.12)
    # Palace on the ridge: long wings, central drum and dome with a lantern
    pal = facade('palace', '#D9C29C', win_w=4.2, floor_h=4.6, lit_ratio=0.65, glow='#FFC783', strength=3.4, flood=0.42)
    box('palace_wing', (300, 40, 50), (30, 560, 66 + 1), c, pal)
    box('palace_court', (90, 46, 56), (30, 565, 66 + 4), c, pal)
    box('palace_roof', (300, 40, 4), (30, 560, 66 + 28), c, M.matte('#5D6A66', 'copper_roof', 0.6))
    drum = cylinder('palace_drum', 15, 16, (30, 562, 66 + 40), c, pal, segs=48)
    dome = sphere('palace_dome', 15.5, (30, 562, 66 + 48), c, night_emission('dome_green', '#6E8C80', 0.35), segs=48, rings=24, scale=(1, 1, 1.15))
    tube_along('palace_lantern', [(30, 562, 66 + 64), (30, 562, 66 + 78)], 1.6, c, night_emission('lantern', '#E9D5AA', 2.0))
    # Gothic church spire and bastion turrets to the right of the palace (north)
    church = facade('church', '#E7DFD0', win_w=3.0, floor_h=8.0, lit_ratio=0.0, flood=1.1)
    box('church_nave', (26, 50, 54), (300, 610, 66 + 3), c, church)
    tw = box('church_tower', (12, 12, 84), (288, 600, 66 + 18), c, church)
    spire = cylinder('church_spire', 6.5, 34, (288, 600, 66 + 60 + 17), c, church, segs=8, r_top=0.2)
    for i in range(6):
        xb = 228 + i * 14
        cylinder(f'bastion_{i}', 3.2, 32, (xb, 540, 64 - 4), c, church, segs=16)
        cylinder(f'bastion_cap_{i}', 3.6, 7, (xb, 540, 64 + 15.5), c, church, segs=16, r_top=0.1)
    box('bastion_wall', (110, 4, 28), (270, 542, 64 - 6), c, church)
    # Gellért Hill monument (a slim pillar and figure) and the citadel wall
    tube_along('monument', [(-760, 880, 120), (-760, 880, 160)], 1.4, c, night_emission('monument', '#E8DCC6', 1.4))
    box('citadel', (160, 20, 10), (-700, 900, 118), c, facade('citadel', '#BFB29C', lit_ratio=0.0, flood=0.6))
    # Suspension bridge to the right, crossing the river (receding away from us)
    build_bridge(c, x=205)
    # Pest-side foreground: plane trees and street lamps along the embankment
    trunk = M.matte('#5A4E44', 'trunk', 0.9)
    canopy = foliage('canopy', '#38513B')
    lamp_glow = night_emission('street_lamp', '#FFD7A0', 18.0)
    for i in range(-14, 15):
        xt = i * 13.0 + RNG.uniform(-1.2, 1.2)
        if abs(xt) > 34:
            tube_along(f'tree_trunk_{i}', [(xt, 4.0, 0), (xt + 0.3, 4.0, 5.5)], 0.32, c, trunk)
            for k in range(3):
                sphere(f'tree_canopy_{i}_{k}', RNG.uniform(2.6, 3.4), (xt + RNG.uniform(-2, 2), 4.2 + RNG.uniform(-1.5, 1.5), 7.6 + RNG.uniform(-0.6, 1.6)), c, canopy, segs=12, rings=8, scale=(1.1, 1.0, 0.8))
        xl = xt + 6.5
        tube_along(f'lamp_post_{i}', [(xl, 23.4, 0.5), (xl, 23.4, 6.2)], 0.09, c, M.matte('#2A2C2E', 'iron_post', 0.5))
        sphere(f'lamp_{i}', 0.35, (xl, 23.4, 6.5), c, lamp_glow, segs=12, rings=8)
    # Buda embankment lamps (a row of tiny lights doubling in the water)
    far_glow = night_emission('far_lamp', '#FFD49A', 40.0)
    for i in range(-40, 41):
        sphere(f'far_lamp_{i}', 0.6, (i * 22.0, 440, 5.5), c, far_glow, segs=8, rings=6)
    return c


def build_bridge(c, x=118.0):
    stone = facade('bridge_stone', '#CDBEA2', lit_ratio=0.0, flood=0.7)
    deck_mat = M.matte('#4D4F52', 'bridge_deck', 0.7)
    chain_mat = M.matte('#3C4146', 'chain', 0.5)
    bulbs = night_emission('bridge_bulbs', '#FFF1D6', 30.0)
    towers = (95.0, 360.0)
    deck_z = 9.0
    box('bridge_deck', (16, 470, 1.6), (x, 232, deck_z), c, deck_mat)
    for ty in towers:
        # triumphal-arch tower: two piers and a lintel
        box(f'tower_l_{ty}', (6, 10, 44), (x - 9, ty, 22 - 2), c, stone)
        box(f'tower_r_{ty}', (6, 10, 44), (x + 9, ty, 22 - 2), c, stone)
        box(f'tower_top_{ty}', (24, 11, 12), (x, ty, 44 - 4), c, stone)
        box(f'pier_{ty}', (30, 16, 8), (x, ty, -2), c, M.matte('#8C8474', 'pier', 0.9))
    # chains: catenaries shore -> tower -> tower -> shore on both sides
    for side in (-1, 1):
        xs = x + side * 8.6
        pts = []
        def seg(y0, z0, y1, z1, sag, n=24):
            out = []
            for i in range(n + 1):
                t = i / n
                y = y0 + (y1 - y0) * t
                z = z0 + (z1 - z0) * t - sag * 4 * t * (1 - t)
                out.append((xs, y, z))
            return out
        pts += seg(26, deck_z + 2, towers[0], 44, 6)
        pts += seg(towers[0], 44, towers[1], 44, 30)[1:]
        pts += seg(towers[1], 44, 445, deck_z + 2, 6)[1:]
        tube_along(f'chain_{side}', pts, 0.45, c, chain_mat)
        for i, p in enumerate(pts[::2]):
            sphere(f'bulb_{side}_{i}', 0.28, p, c, bulbs, segs=8, rings=6)
        # hangers
        for p in pts[::3]:
            if p[2] > deck_z + 2.5:
                tube_along(f'hanger_{side}_{p[1]:.0f}', [p, (p[0], p[1], deck_z + 0.8)], 0.08, c, chain_mat)


# ------------------------------------------------------------------ tram sprite

def build_tram(c):
    yellow = M.matte('#F2C230', 'tram_yellow', 0.35)
    white = M.matte('#F4F1EA', 'tram_white', 0.4)
    dark = M.matte('#2C2E31', 'tram_dark', 0.4)
    win = night_emission('tram_windows', '#FFE2B0', 3.5)
    length = 30.0
    for k, (x0, x1) in enumerate(((-15, -5.2), (-5, 5), (5.2, 15))):
        L = x1 - x0
        box(f'tram_body_{k}', (L, 2.4, 2.4), ((x0 + x1) / 2, 0, 1.6), c, yellow, bevel=0.25)
        box(f'tram_band_{k}', (L, 2.42, 0.35), ((x0 + x1) / 2, 0, 0.75), c, white, bevel=0.05)
        box(f'tram_skirt_{k}', (L - 0.6, 2.2, 0.5), ((x0 + x1) / 2, 0, 0.3), c, dark)
        nwin = int(L / 1.6)
        for i in range(nwin):
            wx = x0 + 0.5 + (L - 1.0) * (i + 0.5) / nwin
            box(f'tram_win_{k}_{i}', ((L - 1.0) / nwin - 0.25, 2.44, 1.0), (wx, 0, 2.05), c, win)
    box('tram_roof', (length - 2, 1.6, 0.35), (0, 0, 2.95), c, M.matte('#D8D6D0', 'tram_roof', 0.6))
    tube_along('pantograph', [(0, 0, 3.1), (1.2, 0, 3.9), (0.2, 0, 4.4)], 0.06, c, dark)
    for x in (-12, -2, 8, 12.5):
        cylinder(f'wheel_{x}', 0.42, 2.0, (x, 0, 0.42), c, dark, segs=20).rotation_euler.x = math.radians(90)


# ------------------------------------------------------------------ rendering

def set_night(value: float):
    NIGHT['value'] = value
    for m in bpy.data.materials:
        if m.node_tree:
            n = m.node_tree.nodes.get('night')
            if n:
                n.outputs[0].default_value = value


def world_for(state: str):
    from lib.lighting import world_gradient
    if state == 'evening':
        world_gradient([(0.0, '#2A3550'), (0.29, '#6B6F8C'), (0.31, '#E9A06B'), (0.335, '#E7A984'), (0.38, '#B58FA2'), (0.47, '#6E7AA0'), (0.62, '#3F4C74'), (1.0, '#16223A')], strength=1.0, name='city_sky_evening', z_range=(-0.3, 0.7))
    else:
        world_gradient([(0.0, '#9AA6B2'), (0.29, '#C9D2DA'), (0.31, '#E9EBEA'), (0.38, '#CFE0EF'), (0.6, '#9DC0E6'), (1.0, '#6C99D2')], strength=2.4, name='city_sky_day', z_range=(-0.3, 0.7))


def lights_for(state: str):
    for ob in [o for o in bpy.data.objects if o.type == 'LIGHT']:
        bpy.data.objects.remove(ob, do_unlink=True)
    if state == 'day':
        ld = bpy.data.lights.new('sun', 'SUN')
        ld.energy = 3.6
        ld.angle = math.radians(1.0)
        ld.color = (1.0, 0.95, 0.88)
        ob = bpy.data.objects.new('sun', ld)
        ob.rotation_euler = Vector((0.55, 0.45, -0.7)).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.scene.collection.objects.link(ob)
    else:
        ld = bpy.data.lights.new('moonfill', 'SUN')
        ld.energy = 0.08
        ld.color = (0.6, 0.7, 1.0)
        ob = bpy.data.objects.new('moonfill', ld)
        ob.rotation_euler = Vector((-0.3, 0.6, -0.6)).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.scene.collection.objects.link(ob)


def camera_city():
    cam = bpy.data.cameras.new('window_cam')
    cam.sensor_fit = 'HORIZONTAL'
    cam.angle = math.radians(HFOV)
    cam.clip_start = 0.5
    cam.clip_end = 20000
    ob = bpy.data.objects.new('window_cam', cam)
    ob.location = (0, 0, CAM_H)
    ob.rotation_euler = (math.radians(90), 0, 0)  # look along +y (west); image right = +x (north)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.scene.camera = ob
    return ob


def render_color(state: str, samples: int) -> str:
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 4
    sc.cycles.filter_width = 1.5
    sc.view_layers[0].material_override = None
    sc.render.resolution_x, sc.render.resolution_y = RES
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Base Contrast'
    sc.view_settings.exposure = 0.0 if state == 'day' else 0.35
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.color_depth = '8'
    path = os.path.join(OUT, f'city_{state}_raw.png')
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def data_material():
    """Emission override: R = planar depth (m), G = object pass index (1 = water)."""
    m = bpy.data.materials.get('city_data_override') or bpy.data.materials.new('city_data_override')
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    cam = nt.nodes.new('ShaderNodeCameraData')
    info = nt.nodes.new('ShaderNodeObjectInfo')
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(cam.outputs['View Z Depth'], comb.inputs['X'])
    nt.links.new(info.outputs['Object Index'], comb.inputs['Y'])
    nt.links.new(comb.outputs['Vector'], em.inputs['Color'])
    em.inputs['Strength'].default_value = 1.0
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m


def render_data() -> np.ndarray:
    sc = bpy.context.scene
    world = sc.world
    black = bpy.data.worlds.new('black')
    black.color = (0, 0, 0)
    sc.world = black
    vl = sc.view_layers[0]
    vl.material_override = data_material()
    sc.cycles.samples = 2
    sc.cycles.use_denoising = False
    sc.cycles.filter_width = 0.01
    sc.cycles.max_bounces = 0
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0.0
    sc.render.image_settings.file_format = 'OPEN_EXR'
    sc.render.image_settings.color_depth = '32'
    sc.render.image_settings.color_mode = 'RGB'
    path = os.path.join(OUT, 'city_data.exr')
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    vl.material_override = None
    sc.world = world
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)[::-1]  # top row first


def postprocess(data: np.ndarray):
    """Fog by depth, a lights mask for twinkling, and the packed data texture."""
    from PIL import Image, ImageFilter
    depth = data[..., 0]
    water = (np.abs(data[..., 1] - 1.0) < 0.5).astype(np.float32)
    sky = depth <= 0.0
    depth_m = np.where(sky, 1e5, depth)
    disp = np.clip(10.0 / depth_m, 0.0, 1.0)
    disp[sky] = 0.0
    meta = {'nearDepth': 10.0, 'hfov': HFOV, 'camHeight': CAM_H, 'aspect': RES[0] / RES[1], 'tramDepth': 19.5, 'farTramDepth': 446.0, 'farTramGround': 0.5, 'tramLength': 30.0, 'tramHeight': 4.6}
    fog_cols = {'evening': np.array([96, 104, 138], np.float32), 'day': np.array([196, 207, 219], np.float32)}
    fog_amt = 1.0 - np.exp(-np.maximum(depth_m - 60.0, 0.0) / 2600.0)
    fog_amt[sky] = 0.0
    lights = None
    for state in ('evening', 'day'):
        raw = np.asarray(Image.open(os.path.join(OUT, f'city_{state}_raw.png')).convert('RGB'), dtype=np.float32)
        k = (0.55 if state == 'evening' else 0.75) * fog_amt[..., None]
        col = raw * (1 - k) + fog_cols[state] * k
        Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).save(os.path.join(OUT, f'city_{state}.png'))
        if state == 'evening':
            lum = col @ np.array([0.2126, 0.7152, 0.0722], np.float32)
            blur = np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)), dtype=np.float32)
            hp = np.clip((lum - blur - 18.0) / 60.0, 0.0, 1.0)
            hp[water > 0.5] *= 0.6
            lights = hp
    packed = np.zeros(depth.shape + (3,), np.uint8)
    packed[..., 0] = np.round(np.sqrt(disp) * 255).astype(np.uint8)
    packed[..., 1] = np.round(water * 255).astype(np.uint8)
    packed[..., 2] = np.round(lights * 255).astype(np.uint8)
    Image.fromarray(packed).save(os.path.join(OUT, 'city_data.png'))
    with open(os.path.join(OUT, 'city.json'), 'w') as fh:
        json.dump(meta, fh, indent=2)


def main():
    os.makedirs(OUT, exist_ok=True)
    samples = int(os.environ.get('CITY_SAMPLES', '64'))
    only = os.environ.get('CITY_ONLY', '')
    build_city()
    camera_city()
    if only != 'post':
        for state in ('evening', 'day'):
            set_night(1.0 if state == 'evening' else 0.0)
            world_for(state)
            lights_for(state)
            render_color(state, samples)
    data = render_data()
    postprocess(data)
    reset_scene()
    c = collection('TRAM')
    build_tram(c)
    for state in ('evening', 'day'):
        set_night(1.0 if state == 'evening' else 0.0)
        world_for(state)
        lights_for(state)
        render_tram(state)
    print('[city] rendered')


def render_tram(state: str):
    sc = bpy.context.scene
    cam = bpy.data.cameras.new('tram_cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = 32
    ob = bpy.data.objects.get('tram_cam') or bpy.data.objects.new('tram_cam', cam)
    if ob.name not in sc.collection.objects:
        sc.collection.objects.link(ob)
    ob.location = (0, -40, 2.2)
    ob.rotation_euler = (math.radians(90), 0, 0)
    sc.camera = ob
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = 1024, 160
    sc.view_settings.view_transform = 'AgX'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'
    sc.render.filepath = os.path.join(OUT, f'tram_{state}.png')
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
