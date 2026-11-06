"""Save a self-contained copy of the scene for opening in Blender: blender/studio.blend
(images packed in, compressed). The working copy in blender/out/ stays unpacked.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import bpy  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, 'blender', 'out', 'studio.blend'))
# drop transient bake targets so the file stays small
for img in list(bpy.data.images):
    if img.name.endswith(('_albedo', '_light_evening', '_light_day')) or img.users == 0:
        bpy.data.images.remove(img)
bpy.ops.file.pack_all()
dst = os.path.join(ROOT, 'blender', 'studio.blend')
bpy.ops.wm.save_as_mainfile(filepath=dst, compress=True, copy=True)
print(f'[package] {dst} {os.path.getsize(dst) / 1e6:.1f} MB')
