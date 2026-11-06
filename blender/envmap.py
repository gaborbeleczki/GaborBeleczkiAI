"""Render small equirectangular HDR panoramas from inside the room (one per lighting state).
The browser prefilters them (PMREM) to light the moving objects — folios, display, record
player — so they sit in the same light as the baked surfaces.
"""

from __future__ import annotations

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import bpy  # noqa: E402

from lib import lighting as L  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'blender', 'out')


def main():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, 'studio.blend'))
    anchors = {k: tuple(v) for k, v in json.load(open(os.path.join(OUT, 'anchors.json'))).items()}
    sc = bpy.context.scene
    for ob in bpy.data.objects:
        if ob.get('invisible') or ob.name.startswith('hit_'):
            ob.hide_render = True
    cam = bpy.data.cameras.new('pano')
    cam.type = 'PANO'
    try:
        cam.panorama_type = 'EQUIRECTANGULAR'
    except AttributeError:
        cam.cycles.panorama_type = 'EQUIRECTANGULAR'
    ob = bpy.data.objects.new('pano', cam)
    sc.collection.objects.link(ob)
    ob.location = (-0.9, 0.7, 1.25)
    ob.rotation_euler = (math.radians(90), 0, math.radians(-90))
    sc.camera = ob
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 96
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.render.resolution_x, sc.render.resolution_y = 512, 256
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.render.image_settings.file_format = 'HDR'
    os.makedirs(os.path.join(OUT, 'env'), exist_ok=True)
    for state in ('evening', 'day'):
        (L.evening if state == 'evening' else L.day)(anchors)
        sc.render.filepath = os.path.join(OUT, 'env', f'room_{state}.hdr')
        bpy.ops.render.render(write_still=True)
        print('[env]', state, 'done')


if __name__ == '__main__':
    main()
