"""Render stills of the studio with Cycles: previews, the hero images for the static page,
the social card, and reference frames for the WebGL pixel-diff check.

  python blender/render_stills.py --pose home --state evening --res 1600x900 --samples 192 --out renders/x.png
  python blender/render_stills.py --preset hero   (all hero/OG stills)
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from lib import lighting as L  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'blender', 'out')


def load():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, 'studio.blend'))
    with open(os.path.join(OUT, 'anchors.json')) as fh:
        return {k: tuple(v) for k, v in json.load(fh).items()}


def pose(name: str):
    e = bpy.data.objects[f'CAM_{name}']
    return Vector(e.location), Vector(e['target'])


FITS = {'home': (6.3, 3.3), 'desk': (0.7, 0.45), 'shelf': (1.35, 0.78), 'record': (0.8, 0.5), 'window': (3.1, 1.75)}


def camera(name: str, res: tuple[int, int], fit=None):
    pos, target = pose(name)
    fit = fit or FITS.get(name, (4, 2.25))
    d = (target - pos).length
    aspect = res[0] / res[1]
    half_h = max(fit[1] / 2, fit[0] / 2 / aspect)
    vfov = 2 * math.atan(half_h / d)
    cam = bpy.data.cameras.get('still_cam') or bpy.data.cameras.new('still_cam')
    cam.sensor_fit = 'VERTICAL'
    cam.angle_y = vfov
    cam.clip_start = 0.02
    cam.clip_end = 200
    ob = bpy.data.objects.get('still_cam') or bpy.data.objects.new('still_cam', cam)
    if ob.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(ob)
    ob.location = pos
    ob.rotation_euler = (target - pos).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = ob
    return math.degrees(vfov)


def city_backdrop(state: str):
    """Show the matching Budapest photo behind the window (the scene is saved with the evening one)."""
    m = bpy.data.materials.get('city_evening')
    path = os.path.join(ROOT, 'public', 'textures', f'window_{state}.webp')
    if not m or not os.path.exists(path):
        return
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE':
            n.image = bpy.data.images.load(path, check_existing=True)


def hide_helpers():
    for ob in bpy.data.objects:
        if ob.get('invisible') or ob.name.startswith('hit_'):
            ob.hide_render = True


def render(path: str, pose_name: str, state: str, res, samples: int, anchors, exposure=0.0):
    sc = bpy.context.scene
    if state == 'evening':
        L.evening(anchors)
    else:
        L.day(anchors)
    city_backdrop(state)
    hide_helpers()
    vfov = camera(pose_name, res)
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.color_depth = '8'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Base Contrast'
    sc.view_settings.exposure = exposure
    sc.render.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f'[still] {pose_name}/{state} {res[0]}x{res[1]} {samples}spp vfov={vfov:.1f} -> {path} ({time.time() - t:.0f}s)')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pose', default='home')
    ap.add_argument('--state', default='evening')
    ap.add_argument('--res', default='960x540')
    ap.add_argument('--samples', type=int, default=48)
    ap.add_argument('--exposure', type=float, default=0.0)
    ap.add_argument('--out', default=os.path.join(ROOT, 'renders', 'preview.png'))
    ap.add_argument('--preset', default='')
    args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
    anchors = load()
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    if args.preset == 'hero':
        for state in ('evening', 'day'):
            render(os.path.join(OUT, 'stills', f'hero_{state}.png'), 'home', state, (1920, 1080), args.samples, anchors, args.exposure)
        return
    w, h = (int(x) for x in args.res.split('x'))
    render(args.out, args.pose, args.state, (w, h), args.samples, anchors, args.exposure)


if __name__ == '__main__':
    main()
