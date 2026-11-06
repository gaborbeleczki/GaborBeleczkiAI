"""Bake the studio into texture atlases with Cycles.

For each bake group (floor, walls, furniture, props):
  albedo  DIFFUSE colour only, 2048², a few samples for anti-aliasing (no noise to remove)
  light   DIFFUSE direct + indirect, 1024², per lighting state, denoised with OpenImageDenoise
The browser multiplies them back together (albedo × light), so day and evening share one
albedo atlas and the lighting can cross-fade. Light maps are stored as sRGB(L / Lmax).

  python blender/bake.py                 # everything
  BAKE_GROUPS=floor BAKE_STATES=evening BAKE_SAMPLES=64 python blender/bake.py
"""

from __future__ import annotations

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from lib import lighting as L  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'blender', 'out')
BAKE_DIR = os.path.join(OUT, 'bake')
TEX_DIR = os.path.join(ROOT, 'public', 'textures')

GROUPS = os.environ.get('BAKE_GROUPS', 'floor,walls,furniture,props').split(',')
STATES = os.environ.get('BAKE_STATES', 'evening,day').split(',')
LIGHT_SAMPLES = int(os.environ.get('BAKE_SAMPLES', '192'))
ALBEDO_RES = int(os.environ.get('ALBEDO_RES', '2048'))
LIGHT_RES = int(os.environ.get('LIGHT_RES', '1024'))
SKIP_ALBEDO = os.environ.get('SKIP_ALBEDO') == '1'


def load():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, 'studio.blend'))
    with open(os.path.join(OUT, 'anchors.json')) as fh:
        return {k: tuple(v) for k, v in json.load(fh).items()}


def scene_setup(samples: int):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 8
    sc.cycles.diffuse_bounces = 5
    sc.cycles.glossy_bounces = 2
    sc.cycles.transmission_bounces = 4
    sc.cycles.sample_clamp_indirect = 6.0
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    bk = sc.render.bake
    bk.target = 'IMAGE_TEXTURES'
    bk.use_clear = True
    bk.margin_type = 'EXTEND'
    for ob in bpy.data.objects:
        if ob.get('invisible') or ob.name.startswith('hit_'):
            ob.hide_render = True


def target_image(name: str, res: int) -> bpy.types.Image:
    img = bpy.data.images.get(name)
    if img is not None:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, res, res, alpha=False, float_buffer=True)
    img.colorspace_settings.name = 'Linear Rec.709'
    return img


def assign_target(ob: bpy.types.Object, img: bpy.types.Image):
    """Make `img` the active (unconnected) image node in every material of the object."""
    for slot in ob.material_slots:
        m = slot.material
        if m is None:
            continue
        nt = m.node_tree
        node = nt.nodes.get('__bake_target')
        if node is None:
            node = nt.nodes.new('ShaderNodeTexImage')
            node.name = '__bake_target'
            uvn = nt.nodes.new('ShaderNodeUVMap')
            uvn.name = '__bake_uv'
            uvn.uv_map = 'BakeUV'
            nt.links.new(uvn.outputs['UV'], node.inputs['Vector'])
        node.image = img
        for n in nt.nodes:
            n.select = False
        node.select = True
        nt.nodes.active = node


def bake(ob, kind: str, img: bpy.types.Image, margin: int):
    sc = bpy.context.scene
    bpy.ops.object.select_all(action='DESELECT')
    ob.hide_render = False
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    assign_target(ob, img)
    bk = sc.render.bake
    bk.margin = margin
    if kind == 'albedo':
        bk.use_pass_direct = False
        bk.use_pass_indirect = False
        bk.use_pass_color = True
    else:
        bk.use_pass_direct = True
        bk.use_pass_indirect = True
        bk.use_pass_color = False
    t = time.time()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'} if kind == 'albedo' else {'DIRECT', 'INDIRECT'}, margin=margin, use_clear=True)
    print(f'[bake] {ob.name} {kind} {img.size[0]}px {sc.cycles.samples}spp in {time.time() - t:.0f}s', flush=True)


def pixels(img) -> np.ndarray:
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)[::-1, :, :3].copy()  # top row first


def denoise(img: bpy.types.Image) -> np.ndarray:
    """Run the image through the compositor's OpenImageDenoise node (CPU)."""
    sc = bpy.context.scene
    w, h = img.size
    ng = bpy.data.node_groups.new('bake_denoise', 'CompositorNodeTree')
    if not ng.interface.items_tree:
        ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    src = ng.nodes.new('CompositorNodeImage')
    src.image = img
    dn = ng.nodes.new('CompositorNodeDenoise')
    try:
        dn.inputs['HDR'].default_value = True
    except Exception:
        pass
    out = ng.nodes.new('NodeGroupOutput')
    ng.links.new(src.outputs['Image'], dn.inputs['Image'])
    ng.links.new(dn.outputs['Image'], out.inputs[0])
    prev = sc.compositing_node_group
    sc.compositing_node_group = ng
    sc.render.use_compositing = True
    sc.render.compositor_device = 'CPU'
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    old_samples = sc.cycles.samples
    sc.cycles.samples = 1
    hidden = []
    for ob in bpy.data.objects:
        if not ob.hide_render:
            ob.hide_render = True
            hidden.append(ob)
    sc.render.image_settings.file_format = 'OPEN_EXR'
    sc.render.image_settings.color_depth = '32'
    path = os.path.join(BAKE_DIR, '_denoise.exr')
    sc.render.filepath = path
    if sc.camera is None:
        cam = bpy.data.objects.new('_dn_cam', bpy.data.cameras.new('_dn_cam'))
        sc.collection.objects.link(cam)
        sc.camera = cam
    bpy.ops.render.render(write_still=True)
    for ob in hidden:
        ob.hide_render = False
    sc.cycles.samples = old_samples
    sc.compositing_node_group = prev
    bpy.data.node_groups.remove(ng)
    res = bpy.data.images.load(path)
    arr = pixels(res)
    bpy.data.images.remove(res)
    return arr


def srgb_encode(lin: np.ndarray) -> np.ndarray:
    lin = np.clip(lin, 0.0, 1.0)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)


def coverage_mask(arr: np.ndarray) -> np.ndarray:
    return arr.max(axis=2) > 1e-6


def save_webp(arr01: np.ndarray, path: str, quality: int = 90, lossless: bool = False):
    im = Image.fromarray(np.round(np.clip(arr01, 0, 1) * 255).astype(np.uint8))
    im.save(path, 'WEBP', quality=quality, method=6, lossless=lossless)
    im.save(os.path.join(BAKE_DIR, os.path.basename(path).replace('.webp', '.png')))  # for QA, not shipped


def main():
    os.makedirs(BAKE_DIR, exist_ok=True)
    os.makedirs(TEX_DIR, exist_ok=True)
    anchors = load()
    meta_path = os.path.join(OUT, 'bake_meta.json')
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    t_all = time.time()
    for g in GROUPS:
        ob = bpy.data.objects[f'bake_{g}']
        if not SKIP_ALBEDO:
            scene_setup(12)
            L.evening(anchors)
            img = target_image(f'{g}_albedo', ALBEDO_RES)
            bake(ob, 'albedo', img, margin=16)
            alb = pixels(img)
            save_webp(srgb_encode(alb), os.path.join(TEX_DIR, f'{g}_albedo.webp'), quality=88)
        for state in STATES:
            scene_setup(LIGHT_SAMPLES)
            (L.evening if state == 'evening' else L.day)(anchors)
            img = target_image(f'{g}_light_{state}', LIGHT_RES)
            bake(ob, 'light', img, margin=12)
            raw = pixels(img)
            np.save(os.path.join(BAKE_DIR, f'{g}_light_{state}_raw.npy'), raw.astype(np.float16))
            den = denoise(img)
            np.save(os.path.join(BAKE_DIR, f'{g}_light_{state}_den.npy'), den.astype(np.float16))
            mask = coverage_mask(raw)
            vals = den[mask].max(axis=1) if mask.any() else np.array([1.0])
            # headroom for most of the surface; tiny hot spots right next to bulbs may clip
            lmax = float(np.clip(np.percentile(vals, 99.0), 1.0, 6.0))
            enc = srgb_encode(den / lmax)
            save_webp(enc, os.path.join(TEX_DIR, f'{g}_light_{state}.webp'), quality=92)
            meta.setdefault(g, {})[state] = {'lmax': round(lmax, 4)}
            with open(meta_path, 'w') as fh:
                json.dump(meta, fh, indent=2)
    # merge the light scales into the runtime metadata
    studio_json = os.path.join(ROOT, 'public', 'models', 'studio.json')
    sj = json.load(open(studio_json))
    sj['bake'] = meta
    with open(studio_json, 'w') as fh:
        json.dump(sj, fh, indent=2)
    print(f'[bake] all done in {time.time() - t_all:.0f}s', flush=True)


if __name__ == '__main__':
    main()
