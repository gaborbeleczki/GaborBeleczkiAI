"""Build the studio scene from code and save blender/out/studio.blend + public/models/studio.json.

Run with the bpy venv:  python blender/build_scene.py
"""

from __future__ import annotations

import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from lib import art, furniture as F, lighting as L, materials as M, props as P, room as R  # noqa: E402
from lib.util import apply_modifiers, blender_to_three, collection, empty, join, reset_scene, tag, write_sway  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'blender', 'out')
PUBLIC = os.path.join(ROOT, 'public')
WINDOW_PLATE = os.path.join(ROOT, 'public', 'textures', 'window_evening.webp')

BAKE_GROUPS = ['floor', 'walls', 'furniture', 'props']
ATLAS_PRIORITY = {
    # scale UV islands of surfaces the camera rarely sees so the texels go where they show
    'ceiling': 0.45,
    'skirt_b': 0.2,
}


def build():
    t0 = time.time()
    reset_scene()
    os.makedirs(OUT, exist_ok=True)
    arts = art.make_all(os.path.join(OUT, 'art'))
    # the printed CV on the desk is the original one-pager (scripts/cv-texture.mjs renders it)
    arts['cv'] = os.path.join(OUT, 'art', 'cv_page.png')
    arts['portrait'] = os.path.join(PUBLIC, 'img', 'gabor.jpg')
    for k in ('cv', 'portrait'):
        if not os.path.exists(arts[k]):
            del arts[k]

    c_floor = collection('BAKE_floor')
    c_walls = collection('BAKE_walls')
    c_furn = collection('BAKE_furniture')
    c_props = collection('BAKE_props')
    c_dyn = collection('DYN')
    c_hit = collection('HIT')
    c_meta = collection('META')
    c_env = collection('ENV')

    # ---- geometry
    R.build_shell(c_floor, c_walls)
    F.build_desk(c_furn)
    F.build_desk_chair(c_furn)
    F.build_sideboard(c_furn)
    F.build_shelves(c_furn)
    F.build_rug(c_furn)
    pendant = F.build_pendant(c_furn, c_dyn)
    desk_lamp = F.build_desk_lamp(c_furn, c_dyn)

    display = P.build_display(c_dyn, c_props)
    desk = P.build_desk_things(c_props, c_dyn, arts)
    shelf = P.build_shelf_things(c_dyn, c_props)
    turntable = P.build_record_player(c_dyn, c_props)
    P.big_plant(c_props)
    P.sill_things(c_props)
    side = P.sideboard_things(c_props, arts)

    # ---- city backdrop: the Budapest photo on an emissive plane behind the window (stills only)
    city_img = WINDOW_PLATE
    if os.path.exists(city_img):
        mat = M.image_emission('city_evening', city_img, 1.0)
    else:
        mat = M.emission('#3A4A6A', 1.0, 'city_evening')
    import bmesh
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('ArtUV')
    bw, bh, by, bz = 26.0, 14.0, 9.5, 2.6
    vs = [bm.verts.new(p) for p in ((bw / 2, by, bz - bh / 2), (-bw / 2, by, bz - bh / 2), (-bw / 2, by, bz + bh / 2), (bw / 2, by, bz + bh / 2))]
    f = bm.faces.new(vs)
    for lp, co in zip(f.loops, ((1, 0), (0, 0), (0, 1), (1, 1))):
        lp[uv].uv = co
    from lib.util import mesh_object
    backdrop = mesh_object('city_backdrop', bm, c_env, mat)
    # seen by the camera (stills) but not part of the room's lighting: daylight comes from the sky
    backdrop.visible_shadow = False
    backdrop.visible_diffuse = False
    backdrop.visible_glossy = False
    backdrop.visible_transmission = False
    backdrop.visible_volume_scatter = False

    # ---- hit areas for the browser (invisible)
    P.hit_box('hit_window', (R.WIN_X1 - R.WIN_X0, 0.05, R.WIN_Z1 - R.WIN_Z0), (0, R.Y1 + 0.08, (R.WIN_Z0 + R.WIN_Z1) / 2), c_hit, 'window', 'Window · Budapest')
    P.hit_box('hit_desk_lamp', (0.26, 0.26, 0.5), (desk_lamp['light_pos'][0] - 0.08, desk_lamp['light_pos'][1] + 0.08, F.DESK['top'] + 0.25), c_hit, 'lights', 'Desk lamp')
    P.hit_box('hit_pendant', (0.46, 0.46, 0.26), (pendant['light_pos'][0], pendant['light_pos'][1], pendant['light_pos'][2] + 0.02), c_hit, 'lights', 'Pendant')
    P.hit_box('hit_chair', (0.62, 0.62, 0.86), (F.CHAIR['x'], F.CHAIR['y'], 0.43), c_hit, 'desk', 'Sit at the desk')
    tt = turntable['center']
    P.hit_box('hit_record', (0.38, 0.48, 0.16), (tt[0], tt[1], tt[2] + 0.08), c_hit, 'record', 'Record player')
    P.hit_box('hit_print', (0.12, 0.42, 0.52), (F.SIDEBOARD['x0'] + 0.06, 0.38, F.SIDEBOARD['z1'] + 0.26), c_hit, 'print', 'Print · Duna')
    # the desk objects (generous boxes: they are small)
    top = F.DESK['top']
    a = desk['anchors']
    desk_hits = {
        'cards': ((0.15, 0.11, 0.06), (a['cards'][0], a['cards'][1], top + 0.02), 'Business cards'),
        'phone': ((0.11, 0.18, 0.04), (a['phone'][0], a['phone'][1], top + 0.012), 'Phone'),
        'about': ((0.17, 0.12, 0.22), (0.21, 2.03, top + 0.09), 'Portrait'),
        'cv': ((0.23, 0.31, 0.03), (a['cv'][0], a['cv'][1], top + 0.008), 'CV, printed'),
        'notebook': ((0.19, 0.24, 0.05), (a['notebook'][0], a['notebook'][1], top + 0.015), 'Notebook'),
        'globe': ((0.19, 0.19, 0.25), (a['globe'][0], a['globe'][1], top + 0.115), 'Armillary sphere'),
        'coffee': ((0.13, 0.11, 0.12), (a['coffee'][0] + 0.012, a['coffee'][1], top + 0.05), 'Coffee'),
        'music': ((0.3, 0.27, 0.14), (a['music'][0], a['music'][1] + 0.03, top + 0.07), 'Headphones'),
    }
    for key, (size, loc, label) in desk_hits.items():
        P.hit_box(f'hit_{key}', size, loc, c_hit, key, label)

    # ---- camera poses (empties in Blender, JSON for the runtime)
    disp_center = Vector((P.DISPLAY_POS[0], P.DISPLAY_POS[1], F.DESK['top'] + 0.33))
    disp_normal = Vector((math.sin(P.DISPLAY_ROT), -math.cos(P.DISPLAY_ROT), 0))
    desk_cam = disp_center + disp_normal * 0.93 + Vector((0, 0, 0.035))
    folio_mid = Vector(shelf['mid']) + Vector((0, 0, 0.15))
    tt_c = Vector(turntable['center'])
    poses = {
        'home': {'pos': (0.95, -0.8, 1.5), 'target': (-0.42, 1.55, 1.0), 'fit': (3.2, 1.8)},
        'desk': {'pos': tuple(desk_cam), 'target': tuple(disp_center + Vector((0, 0, -0.005))), 'fit': (0.7, 0.45)},
        'shelf': {'pos': (-0.62, 0.86, 1.46), 'target': tuple(folio_mid), 'fit': (0.62, 0.42)},
        'record': {'pos': (-1.02, 0.82, 1.12), 'target': tuple(tt_c + Vector((0.0, 0.0, 0.07))), 'fit': (0.72, 0.44)},
        'window': {'pos': (0.5, 0.95, 1.36), 'target': (0.08, 2.6, 1.6), 'fit': (2.4, 1.56)},
        # the desk top seen from the chair: phone, cards, CV, notebook, frame, sphere
        'objects': {'pos': (-0.08, 0.9, 1.42), 'target': (-0.06, 1.78, 0.76), 'fit': (1.62, 0.64)},
    }
    for name, p in poses.items():
        empty(f'CAM_{name}', p['pos'], c_meta, target=list(p['target']))

    # ---- light anchors
    anchors = {
        'pendant': pendant['light_pos'],
        'desk_lamp': desk_lamp['light_pos'],
        'desk_lamp_aim': desk_lamp['aim'],
        'candle': side['flame'],
    }

    # ---- per-vertex motion data (curtains breathe, leaves sway, the pendant swings)
    bpy.context.view_layer.update()
    pendant_top = R.H
    pendant_bottom = pendant['light_pos'][2] - 0.09
    for ob in [o for o in bpy.data.objects if o.get('sway')]:
        kind = ob['sway']
        ob = apply_modifiers(ob)
        if kind == 'curtain':
            top, bottom = float(ob['sway_top']), float(ob['sway_bottom'])
            write_sway(ob, kind, lambda c: (top - c.z) / (top - bottom), lambda c: c.x * 0.35)
        elif kind == 'leaf':
            base, height = float(ob['sway_base']), float(ob['sway_height'])
            write_sway(ob, kind, lambda c: (c.z - base) / height, lambda c: c.x * 3.1 + c.y * 1.7 + c.z * 2.3)
        elif kind == 'pendant':
            write_sway(ob, kind, lambda c: (pendant_top - c.z) / (pendant_top - pendant_bottom), lambda c: 0.0)

    # ---- finalize bake groups: apply modifiers, merge, unwrap into one atlas each
    bpy.context.view_layer.update()
    for g in BAKE_GROUPS:
        coll = bpy.data.collections[f'BAKE_{g}']
        objs = [o for o in coll.all_objects if o.type in ('MESH', 'CURVE')]
        merged = join(objs, f'bake_{g}', coll)
        tag(merged, bake=g)
        unwrap(merged, g)
        merged.data.color_attributes.active_color = merged.data.color_attributes['sway']
    # tidy empties used as parents
    for ob in list(bpy.data.objects):
        if ob.type == 'EMPTY' and not ob.name.startswith('CAM_') and not ob.children:
            bpy.data.objects.remove(ob, do_unlink=True)
    # dynamic objects: apply modifiers so the export matches the bake
    for ob in list(c_dyn.all_objects):
        if ob.type in ('MESH', 'CURVE') and (ob.modifiers or ob.type == 'CURVE'):
            apply_modifiers(ob)

    L.evening(anchors)
    setup_render()

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'studio.blend'), compress=True)

    # ---- runtime metadata (three.js coordinates)
    meta = {
        'version': 1,
        'generated': time.strftime('%Y-%m-%d'),
        'poses': {k: {'pos': blender_to_three(v['pos']), 'target': blender_to_three(v['target']), 'fit': list(v['fit'])} for k, v in poses.items()},
        'screen': {'size': [P.SCREEN_W, P.SCREEN_H], 'pixels': [1600, 1000]},
        'folios': [{'id': fid, 'object': f'folio_{i:02d}', 'color': col} for i, (fid, col) in enumerate(zip(P.FOLIO_IDS, P.FOLIO_COLORS))],
        'dossier': {k: v for k, v in P.DOSSIER.items()},
        'objects': {k: blender_to_three(v) for k, v in desk['anchors'].items()},
        'lights': {k: blender_to_three(v) for k, v in anchors.items() if k != 'desk_lamp_aim'},
        'flame': blender_to_three(side['flame']),
        'pendantPivot': blender_to_three((pendant['light_pos'][0], pendant['light_pos'][1], R.H)),
        'room': {'min': blender_to_three((R.X0, R.Y1, 0)), 'max': blender_to_three((R.X1, R.Y0, R.H))},
        'tonearm': {'pivot': blender_to_three(turntable['pivot'])},
        'window': {
            'center': blender_to_three((0, R.GLASS_Y, (R.WIN_Z0 + R.WIN_Z1) / 2)),
            'size': [R.WIN_X1 - R.WIN_X0, R.WIN_Z1 - R.WIN_Z0],
        },
        'atlases': BAKE_GROUPS,
        'states': ['evening', 'day'],
    }
    with open(os.path.join(PUBLIC, 'models', 'studio.json'), 'w') as fh:
        json.dump(meta, fh, indent=2)
    with open(os.path.join(OUT, 'anchors.json'), 'w') as fh:
        json.dump(anchors, fh, indent=2)
    print(f'[build] done in {time.time() - t0:.1f}s; objects={len(bpy.data.objects)}')


def unwrap(ob, group):
    """Smart-project a merged mesh, equalise texel density, then pack into 0-1."""
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    me = ob.data
    for layer in list(me.uv_layers):
        if layer.name != 'ArtUV':
            me.uv_layers.remove(layer)
    bake_uv = me.uv_layers.new(name='BakeUV')
    me.uv_layers.active = bake_uv
    bake_uv.active_render = True
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.pack_islands(rotate=True, margin=0.004 if group != 'floor' else 0.002)
    bpy.ops.object.mode_set(mode='OBJECT')
    ob.select_set(False)


def setup_render():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 256
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8
    sc.cycles.diffuse_bounces = 5
    sc.cycles.glossy_bounces = 3
    sc.cycles.transmission_bounces = 4
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.sample_clamp_indirect = 8.0
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Base Contrast'
    except TypeError:
        sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0.0
    sc.render.resolution_x = 1600
    sc.render.resolution_y = 900
    sc.render.film_transparent = False


if __name__ == '__main__':
    build()
