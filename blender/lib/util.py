"""Small procedural-modeling toolkit on top of bpy/bmesh.

Everything is built from code so the studio can be regenerated, tweaked and re-baked
without opening the Blender UI. Units are metres, Z is up, the window wall faces -Y.
"""

from __future__ import annotations

import math
import random
from typing import Iterable, Sequence

import bmesh
import bpy
from mathutils import Matrix, Vector

RNG = random.Random(7)


# ---------------------------------------------------------------- scene / collections

def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.render.engine = 'CYCLES'


def collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(coll)
    return coll


def tag(ob: bpy.types.Object, **props) -> bpy.types.Object:
    """Custom properties travel to glTF as `extras` and drive the runtime."""
    for k, v in props.items():
        ob[k] = v
    return ob


# ---------------------------------------------------------------- mesh helpers

def mesh_object(name: str, bm: bmesh.types.BMesh, coll: bpy.types.Collection, mat=None) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    if mat is not None:
        me.materials.append(mat)
    return ob


def add_box(bm: bmesh.types.BMesh, size: Sequence[float], center: Sequence[float] = (0, 0, 0), rot_z: float = 0.0):
    m = Matrix.Translation(Vector(center)) @ Matrix.Rotation(rot_z, 4, 'Z') @ Matrix.Diagonal((*size, 1.0))
    return bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def box(name: str, size, loc, coll, mat=None, bevel: float = 0.0, segments: int = 3, rot_z: float = 0.0) -> bpy.types.Object:
    bm = bmesh.new()
    add_box(bm, size)
    ob = mesh_object(name, bm, coll, mat)
    ob.location = loc
    ob.rotation_euler.z = rot_z
    if bevel > 0:
        add_bevel(ob, bevel, segments)
    return ob


def add_bevel(ob: bpy.types.Object, width: float, segments: int = 3, angle: float = 40.0) -> None:
    mod = ob.modifiers.new('Bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    mod.harden_normals = False
    mod.use_clamp_overlap = True


def cylinder(name: str, r: float, h: float, loc, coll, mat=None, segs: int = 64, bevel: float = 0.0, r_top: float | None = None) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r, radius2=r if r_top is None else r_top, depth=h)
    ob = mesh_object(name, bm, coll, mat)
    ob.location = loc
    if bevel > 0:
        add_bevel(ob, bevel, 2)
    smooth(ob)
    return ob


def sphere(name: str, r: float, loc, coll, mat=None, segs: int = 36, rings: int = 24, scale=(1, 1, 1)) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    ob = mesh_object(name, bm, coll, mat)
    ob.location = loc
    smooth(ob)
    return ob


def revolve(name: str, profile: Sequence[tuple[float, float]], coll, mat=None, loc=(0, 0, 0), segs: int = 96,
            cap_bottom: bool = True, cap_top: bool = False) -> bpy.types.Object:
    """Lathe a (radius, z) profile around Z. Profiles run bottom to top."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        a, b = rings[j], rings[j + 1]
        for i in range(segs):
            i2 = (i + 1) % segs
            try:
                bm.faces.new((a[i], a[i2], b[i2], b[i]))
            except ValueError:
                pass
    if cap_bottom and profile[0][0] > 1e-4:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top and profile[-1][0] > 1e-4:
        bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_object(name, bm, coll, mat)
    ob.location = loc
    smooth(ob)
    return ob


def tube_along(name: str, points: Sequence[Sequence[float]], radius: float, coll, mat=None, segs: int = 16) -> bpy.types.Object:
    """A round tube along a polyline (lamp arms, chair spindles, bridge cables)."""
    crv = bpy.data.curves.new(name + '_crv', 'CURVE')
    crv.dimensions = '3D'
    crv.bevel_depth = radius
    crv.bevel_resolution = max(2, segs // 3)
    crv.use_fill_caps = True
    spline = crv.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (co[0], co[1], co[2], 1.0)
    ob = bpy.data.objects.new(name, crv)
    coll.objects.link(ob)
    if mat is not None:
        crv.materials.append(mat)
    return ob


def smooth(ob: bpy.types.Object, smooth_faces: bool = True) -> None:
    if ob.type != 'MESH':
        return
    for p in ob.data.polygons:
        p.use_smooth = smooth_faces


def smooth_by_angle(ob: bpy.types.Object, angle_deg: float = 35.0) -> None:
    """Sharp edges above the angle, smooth below (replacement for legacy auto smooth)."""
    if ob.type != 'MESH':
        return
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    bm = bmesh.new()
    bm.from_mesh(me)
    limit = math.radians(angle_deg)
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.calc_face_angle(0.0) < limit
        else:
            e.smooth = False
    bm.to_mesh(me)
    bm.free()


def apply_modifiers(ob: bpy.types.Object) -> bpy.types.Object:
    """Bake modifiers/curves into a plain mesh using the evaluated depsgraph (no operators)."""
    deps = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(deps)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=deps)
    if ob.type == 'MESH':
        old = ob.data
        ob.modifiers.clear()
        ob.data = me
        if old.users == 0:
            bpy.data.meshes.remove(old)
        return ob
    # curve -> new mesh object in the same collections
    new = bpy.data.objects.new(ob.name + '_m', me)
    for c in ob.users_collection:
        c.objects.link(new)
    new.matrix_world = ob.matrix_world.copy()
    for k in ob.keys():
        new[k] = ob[k]
    name = ob.name
    bpy.data.objects.remove(ob, do_unlink=True)
    new.name = name
    return new


def join(objs: Iterable[bpy.types.Object], name: str, coll: bpy.types.Collection) -> bpy.types.Object:
    """Merge meshes (world transforms applied) into one object, keeping material slots."""
    objs = [apply_modifiers(o) for o in objs]
    # identical UV layer and colour attribute sets on every mesh so bmesh merges them by name
    for ob in objs:
        ensure_sway(ob.data)
        if 'ArtUV' not in ob.data.uv_layers:
            ob.data.uv_layers.new(name='ArtUV')
        for layer in list(ob.data.uv_layers):
            if layer.name != 'ArtUV':
                ob.data.uv_layers.remove(layer)
    bm = bmesh.new()
    mats: list = []
    for ob in objs:
        me = ob.data
        tmp = bmesh.new()
        tmp.from_mesh(me)
        tmp.transform(ob.matrix_world)
        remap = {}
        for i, m in enumerate(me.materials):
            if m not in mats:
                mats.append(m)
            remap[i] = mats.index(m)
        for f in tmp.faces:
            f.material_index = remap.get(f.material_index, 0)
        me2 = bpy.data.meshes.new('_tmp')
        tmp.to_mesh(me2)
        tmp.free()
        bm.from_mesh(me2)
        bpy.data.meshes.remove(me2)
    out_me = bpy.data.meshes.new(name)
    bm.to_mesh(out_me)
    bm.free()
    for m in mats:
        out_me.materials.append(m)
    out = bpy.data.objects.new(name, out_me)
    coll.objects.link(out)
    for ob in objs:
        bpy.data.objects.remove(ob, do_unlink=True)
    return out


SWAY_KIND = {'curtain': 0.25, 'leaf': 0.5, 'pendant': 0.75}


def ensure_sway(me: bpy.types.Mesh) -> None:
    """Per-vertex motion data for the browser: R = weight, G = kind, B = phase (A unused)."""
    if 'sway' not in me.color_attributes:
        attr = me.color_attributes.new('sway', 'FLOAT_COLOR', 'POINT')
        for d in attr.data:
            d.color = (0.0, 0.0, 0.0, 1.0)


def write_sway(ob: bpy.types.Object, kind: str, weight_fn, phase_fn) -> None:
    """Fill the sway attribute from world-space vertex positions (modifiers already applied)."""
    me = ob.data
    ensure_sway(me)
    attr = me.color_attributes['sway']
    mw = ob.matrix_world
    code = SWAY_KIND[kind]
    for v, d in zip(me.vertices, attr.data):
        co = mw @ v.co
        d.color = (max(0.0, min(1.0, weight_fn(co))), code, phase_fn(co) % 1.0, 1.0)


def set_origin_to_bounds_center(ob: bpy.types.Object) -> None:
    me = ob.data
    co = [ob.matrix_world @ v.co for v in me.vertices]
    mn = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
    mx = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    center = (mn + mx) / 2
    inv = ob.matrix_world.inverted()
    local_center = inv @ center
    me.transform(Matrix.Translation(-local_center))
    ob.matrix_world = Matrix.Translation(center) @ ob.matrix_world.to_3x3().to_4x4()


def bounds(ob: bpy.types.Object) -> tuple[Vector, Vector]:
    co = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    mn = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
    mx = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    return mn, mx


def empty(name: str, loc, coll, **props) -> bpy.types.Object:
    ob = bpy.data.objects.new(name, None)
    ob.location = loc
    ob.empty_display_size = 0.1
    coll.objects.link(ob)
    tag(ob, **props)
    return ob


def blender_to_three(v: Sequence[float]) -> list[float]:
    """glTF/three.js use +Y up and -Z forward: (x, y, z)_blender -> (x, z, -y)."""
    return [round(v[0], 5), round(v[2], 5), round(-v[1], 5)]


def kelvin(k: float) -> tuple[float, float, float]:
    """Approximate blackbody colour (linear-ish), good enough for lamp tints."""
    t = k / 100.0
    if t <= 66:
        r = 255
        g = 99.4708025861 * math.log(t) - 161.1195681661
        b = 0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307
    else:
        r = 329.698727446 * ((t - 60) ** -0.1332047592)
        g = 288.1221695283 * ((t - 60) ** -0.0755148492)
        b = 255
    c = [max(0.0, min(255.0, x)) / 255.0 for x in (r, g, b)]
    return tuple((x ** 2.2) for x in c)  # sRGB-ish to linear
