"""Export the studio for the browser: blender/out/studio_raw.glb (optimised afterwards by
scripts/optimize-assets.mjs into public/models/studio.glb).

- bake_* meshes: one primitive each (materials stripped), BakeUV as TEXCOORD_0
- DYN objects: their Principled values as glTF PBR, lit live in WebGL
- hit_* boxes: invisible click targets with extras {hit, label}
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import bpy  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'blender', 'out')


def main():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, 'studio.blend'))
    keep = []
    for ob in bpy.data.objects:
        if ob.name.startswith('bake_') and ob.type == 'MESH':
            me = ob.data
            for layer in list(me.uv_layers):
                if layer.name != 'BakeUV':
                    me.uv_layers.remove(layer)
            me.materials.clear()
            keep.append(ob)
        elif ob.get('dyn') and ob.type == 'MESH':
            # dynamic objects keep a simple UV only if they need one (screen); drop ArtUV/BakeUV
            keep.append(ob)
        elif ob.get('hit') and ob.type == 'MESH':
            ob.hide_render = False
            ob.data.materials.clear()
            keep.append(ob)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in keep:
        ob.hide_set(False)
        ob.hide_viewport = False
        ob.select_set(True)
    path = os.path.join(OUT, 'studio_raw.glb')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_image_format='NONE',
        export_vertex_color='ACTIVE',
    )
    print(f'[export] {len(keep)} objects -> {path} ({os.path.getsize(path) / 1e6:.2f} MB)')


if __name__ == '__main__':
    main()
