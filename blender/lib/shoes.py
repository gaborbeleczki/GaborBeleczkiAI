"""Running shoes after the ASICS MEGABLAST, EKIDEN colourway (Vital Green / Black).

What the model takes from the shoe: the tallest stack in the range (about 45 mm under the heel,
37 mm under the forefoot, an 8 mm drop) in one piece of foam, a rocker that lifts the toe and
bevels the heel, a heel that flares out behind the upper, a thin translucent woven upper, a slim
tongue, a padded collar, rubber only where the foot lands and pushes off, and the two crossing
side stripes. The colours follow the colourway's name: a vital green upper and foam, black for the
stripes, laces, collar, heel tab and rubber.

The right shoe is built heel at the origin, toe along +x, the inside of the foot towards +y;
mirror=True gives the left one.
"""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Vector

from . import materials as M
from .util import mesh_object, smooth, tube_along

L = 0.29                        # EU 44.5
GREEN = '#46C35A'               # vital green
GREEN_DARK = '#2E8F42'
FOAM = '#7FD48E'                # the same green, lighter: FF Turbo² foam
BLACK = '#141517'

# full width of the foot's outline along the length (s = x / L)
WIDTH = [(-0.04, 0.026), (-0.025, 0.05), (0.0, 0.062), (0.08, 0.07), (0.25, 0.071), (0.4, 0.073), (0.55, 0.087),
         (0.7, 0.097), (0.82, 0.092), (0.92, 0.072), (0.97, 0.046), (1.0, 0.016)]
# the rocker: underside of the sole, and the stack (foam plus rubber) above it
BOTTOM = [(-0.04, 0.024), (-0.02, 0.014), (0.0, 0.008), (0.06, 0.002), (0.14, 0.0), (0.56, 0.0), (0.7, 0.002),
          (0.82, 0.008), (0.92, 0.018), (1.0, 0.032)]
STACK = [(-0.04, 0.03), (-0.02, 0.04), (0.0, 0.045), (0.15, 0.045), (0.45, 0.042), (0.75, 0.037), (0.9, 0.034),
         (1.0, 0.026)]
# the top line of the upper (collar, instep, toe box), absolute height
TOP = [(0.0, 0.094), (0.05, 0.111), (0.2, 0.115), (0.36, 0.107), (0.48, 0.096), (0.62, 0.083), (0.78, 0.07),
       (0.9, 0.06), (0.96, 0.053), (0.985, 0.047)]


def _interp(pts, s):
    if s <= pts[0][0]:
        return pts[0][1]
    for (a, va), (b, vb) in zip(pts, pts[1:]):
        if s <= b:
            t = (s - a) / (b - a)
            t = t * t * (3 - 2 * t)
            return va + (vb - va) * t
    return pts[-1][1]


def _spow(v, e):
    return math.copysign(abs(v) ** e, v)


def _centre(s):
    """The toe points a little towards the inside of the foot."""
    return 0.007 * max(0.0, s) ** 2


# ---------------------------------------------------------------- materials

def _woven(name=f'shoe_mesh_{GREEN}'):
    """A thin woven upper: a fine two-way weave in the base green, a little sheen."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m, nt, b = M._new(name)
    co = M._coord(nt)
    warp = nt.nodes.new('ShaderNodeTexWave')
    warp.wave_type = 'BANDS'
    warp.bands_direction = 'X'
    warp.inputs['Scale'].default_value = 420.0
    warp.inputs['Distortion'].default_value = 0.4
    nt.links.new(co, warp.inputs['Vector'])
    weft = nt.nodes.new('ShaderNodeTexWave')
    weft.wave_type = 'BANDS'
    weft.bands_direction = 'Z'
    weft.inputs['Scale'].default_value = 420.0
    weft.inputs['Distortion'].default_value = 0.4
    nt.links.new(co, weft.inputs['Vector'])
    cross = M._mix(nt, warp.outputs['Fac'], weft.outputs['Fac'], 0.5, 'MULTIPLY')
    col = M._mix(nt, M.hex_rgb(GREEN), M.hex_rgb(GREEN_DARK), cross, 'MIX')
    col = M._mix(nt, M.hex_rgb(GREEN), col, 0.45)
    nt.links.new(col, b.inputs['Base Color'])
    M.set_in(b, 'Roughness', 0.62)
    # no sheen and no bump: either one left the light bake of the upper black (the weave is in
    # the colour, which is all a baked surface keeps of it anyway)
    return m


def _materials():
    return {
        'mesh': _woven(),
        'foam': M.matte(FOAM, 'shoe_foam_green', 0.78),
        'rubber': M.matte('#1B1C1F', 'shoe_rubber_black', 0.86),
        'black': M.matte(BLACK, 'shoe_black', 0.62),
        'inside': M.matte('#0E0F10', 'shoe_inside_black', 0.95),
        'lace': M.matte('#1A1B1D', 'shoe_lace_black', 0.8),
    }


# ---------------------------------------------------------------- geometry

def _loft(name, rings, coll, mats, face_mat):
    """Skin closed rings (heel to toe) into a solid with fan caps; face_mat(ring, centre) picks
    the material per face."""
    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in r] for r in rings]
    n = len(vs[0])
    for i in range(len(vs) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            f = bm.faces.new((vs[i][k], vs[i][k2], vs[i + 1][k2], vs[i + 1][k]))
            f.material_index = face_mat(i, sum((v.co for v in f.verts), Vector()) / 4)
    for ring, first in ((vs[0], True), (vs[-1], False)):
        c = bm.verts.new(sum((v.co for v in ring), Vector()) / n)
        for k in range(n):
            k2 = (k + 1) % n
            f = bm.faces.new((c, ring[k2], ring[k]) if first else (c, ring[k], ring[k2]))
            f.material_index = face_mat(0 if first else len(vs) - 2, c.co)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # recalc can still leave a closed loft inside out (the upper came out that way, and its light
    # baked black): the signed volume says which way is out
    vol = sum(f.verts[0].co.dot(f.verts[i].co.cross(f.verts[i + 1].co)) for f in bm.faces for i in range(1, len(f.verts) - 1))
    if vol < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    ob = mesh_object(name, bm, coll, mats[0])
    for m in mats[1:]:
        ob.data.materials.append(m)
    sub = ob.modifiers.new('Sub', 'SUBSURF')
    sub.levels = 1
    sub.render_levels = 2
    smooth(ob)
    return ob


def upper_point(s, a, sgn=1.0):
    """A point on the upper: s along the foot, a around it (0 underneath, pi on top,
    pi/2 the inside of the foot, 3pi/2 the outside)."""
    w = _interp(WIDTH, s) - 0.004
    z0 = _interp(BOTTOM, s) + _interp(STACK, s) - 0.008
    z1 = _interp(TOP, s)
    zc, hh = (z0 + z1) / 2, (z1 - z0)
    cy, cz = math.sin(a), -math.cos(a)
    e = 2 / 2.6
    y = _centre(s) + (w / 2) * _spow(cy, e)
    return Vector((s * L, sgn * y, zc + (hh / 2) * _spow(cz, e)))


def _sole_ring(s, sgn, n=20):
    w = _interp(WIDTH, s)
    z0 = _interp(BOTTOM, s)
    z1 = z0 + _interp(STACK, s)
    zc, hh = (z0 + z1) / 2, (z1 - z0)
    flare_top, flare_bot = 0.003, 0.006 + 0.006 * max(0.0, 0.25 - s) / 0.29   # the heel flares most
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        cy, cz = math.sin(a), -math.cos(a)
        ey, ez = _spow(cy, 2 / 4.2), _spow(cz, 2 / 4.2)       # boxy: a tall, flat sidewall
        half = w / 2 + flare_top + (flare_bot - flare_top) * (1 - ez) / 2
        pts.append(Vector((s * L, sgn * (_centre(s) + half * ey), zc + (hh / 2) * ez)))
    return pts


def upper_top_z(s, y_local):
    """Height of the upper's surface at s and y (in the right shoe's frame), seen from above."""
    w = _interp(WIDTH, s) - 0.004
    z0 = _interp(BOTTOM, s) + _interp(STACK, s) - 0.008
    z1 = _interp(TOP, s)
    zc, hh = (z0 + z1) / 2, (z1 - z0)
    yy = min(abs(y_local - _centre(s)) / (w / 2), 0.999)
    return zc + (hh / 2) * (1 - yy ** 2.6) ** (1 / 2.6)


def _outward(s, p, sgn):
    w = _interp(WIDTH, s)
    z0 = _interp(BOTTOM, s) + _interp(STACK, s) - 0.008
    zc = (z0 + _interp(TOP, s)) / 2
    return Vector((0.0, p.y - sgn * _centre(s), p.z - zc)).normalized()


def _ribbon(name, pts_sa, width, coll, mat, sgn):
    """A flat band laid on the upper along a path given in (s, a), lifted a hair off it."""
    bm = bmesh.new()
    h = 1e-3
    rows, normals = [], []
    for i, (s, a) in enumerate(pts_sa):
        p = upper_point(s, a, sgn)
        ps = (upper_point(s + h, a, sgn) - upper_point(s - h, a, sgn)) / (2 * h)
        pa = (upper_point(s, a + h, sgn) - upper_point(s, a - h, sgn)) / (2 * h)
        nrm = ps.cross(pa).normalized()
        if nrm.dot(_outward(s, p, sgn)) < 0:
            nrm = -nrm
        j, k = min(i + 1, len(pts_sa) - 1), max(i - 1, 0)
        tan = (upper_point(*pts_sa[j], sgn) - upper_point(*pts_sa[k], sgn)).normalized()
        across = nrm.cross(tan).normalized()
        lift = nrm * 0.0009
        rows.append((bm.verts.new(p + lift + across * width / 2), bm.verts.new(p + lift - across * width / 2)))
        normals.append(nrm)
    for i, ((a1, b1), (a2, b2)) in enumerate(zip(rows, rows[1:])):
        f = bm.faces.new((a1, b1, b2, a2))
        f.normal_update()
        if f.normal.dot(normals[i]) < 0:
            f.normal_flip()
    ob = mesh_object(name, bm, coll, mat)
    smooth(ob)
    return ob


def _ellipsoid(name, centre, radii, pitch, coll, mat):
    """A smooth ellipsoid, tipped forward by `pitch` (radians) about the y axis."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1.0)
    cp, sp = math.cos(pitch), math.sin(pitch)
    for v in bm.verts:
        x, y, z = v.co.x * radii[0], v.co.y * radii[1], v.co.z * radii[2]
        v.co = Vector((x * cp - z * sp, y, x * sp + z * cp)) + Vector(centre)
    ob = mesh_object(name, bm, coll, mat)
    smooth(ob)
    return ob


def _opening(name, ox, rx, ry, coll, mat, sgn, lift=0.0016, rings=6, segs=28):
    """The dark opening: a disc that lies on the upper's top, following its curve."""
    bm = bmesh.new()
    centre = bm.verts.new((ox, sgn * _centre(ox / L), upper_top_z(ox / L, _centre(ox / L)) + lift))
    prev = None
    for r in [i / rings for i in range(1, rings + 1)]:
        ring = []
        for k in range(segs):
            t = 2 * math.pi * k / segs
            x = ox + rx * r * math.cos(t)
            yl = _centre(x / L) + ry * r * math.sin(t)
            ring.append(bm.verts.new((x, sgn * yl, upper_top_z(x / L, yl) + lift)))
        for k in range(segs):
            k2 = (k + 1) % segs
            if prev is None:
                bm.faces.new((centre, ring[k], ring[k2]))
            else:
                bm.faces.new((prev[k], ring[k], ring[k2], prev[k2]))
        prev = ring
    for f in bm.faces:
        f.normal_update()
        if f.normal.z < 0:
            f.normal_flip()
    ob = mesh_object(name, bm, coll, mat)
    smooth(ob)
    return ob


def megablast(name: str, coll, mirror: bool = False) -> list:
    sgn = -1.0 if mirror else 1.0
    mt = _materials()
    parts = []

    # the sole: one piece of foam on a rocker, rubber where the foot lands and pushes off
    ss = [-0.04, -0.03, -0.02, -0.01] + [i / 30 for i in range(31)]
    rings = [_sole_ring(s, sgn) for s in ss]

    sole = _loft(f'{name}_sole', rings, coll, [mt['foam'], mt['rubber']], lambda i, c: 0)
    for f in sole.data.polygons:
        s = f.center.x / L
        if f.normal.z < -0.72 and (s < 0.3 or s > 0.5):
            f.material_index = 1
    parts.append(sole)

    # the upper: woven, a black heel cap; rounded at the heel and the toe
    us = [-0.03, -0.02, -0.01] + [i / 34 * 0.985 for i in range(35)]
    na = 28
    up_rings = [[upper_point(s, 2 * math.pi * k / na, sgn) for k in range(na)] for s in us]

    parts.append(_loft(name, up_rings, coll, [mt['mesh']], lambda i, c: 0))

    # the opening: dark, ringed by a padded black collar; the tongue rises at its front
    ox, rx, ry = 0.21 * L, 0.046, 0.021            # clear of the heel's rounded back
    parts.append(_opening(f'{name}_opening', ox, rx, ry, coll, mt['inside'], sgn))
    collar = []
    for k in range(25):
        t = math.radians(55 + 250 * k / 24)            # round the back, open at the front
        x = ox + (rx + 0.0025) * math.cos(t)
        yl = _centre(x / L) + (ry + 0.0025) * math.sin(t)
        collar.append((x, sgn * yl, upper_top_z(x / L, yl) + 0.0024))
    parts.append(tube_along(f'{name}_collar', collar, 0.0036, coll, mt['black'], segs=10))
    ts = 0.36
    slope = math.atan2(_interp(TOP, ts + 0.02) - _interp(TOP, ts - 0.02), 0.04 * L)
    parts.append(_ellipsoid(f'{name}_tongue', (ts * L, sgn * _centre(ts), upper_top_z(ts, _centre(ts)) + 0.0016), (0.026, 0.0155, 0.0034), -slope, coll, mt['mesh']))
    # six rows of flat black laces across the instep
    for j in range(6):
        s = 0.44 + j * 0.042
        c = _centre(s)
        hw = 0.015 + 0.0016 * j
        pts = [(s * L, sgn * (c - hw), upper_top_z(s, c - hw) + 0.0012),
               (s * L, sgn * (c - hw / 2), upper_top_z(s, c - hw / 2) + 0.0022),
               (s * L, sgn * c, upper_top_z(s, c) + 0.0026),
               (s * L, sgn * (c + hw / 2), upper_top_z(s, c + hw / 2) + 0.0022),
               (s * L, sgn * (c + hw), upper_top_z(s, c + hw) + 0.0012)]
        parts.append(tube_along(f'{name}_lace_{j}', pts, 0.0016, coll, mt['lace'], segs=6))
    # a pull tab at the heel
    tz = upper_top_z(0.0, _centre(0.0))
    parts.append(tube_along(f'{name}_tab', [(0.006, sgn * -0.008, tz - 0.006), (-0.009, 0.0, tz + 0.012), (0.006, sgn * 0.008, tz - 0.006)], 0.0028, coll, mt['black'], segs=6))

    # the two crossing stripes, on both sides
    for side, base in (('out', 1.5 * math.pi), ('in', 0.5 * math.pi)):
        flip = 1.0 if side == 'out' else -1.0
        top_a = base - flip * 0.36 * math.pi           # just under the lacing
        low_a = base + flip * 0.3 * math.pi            # just above the foam
        for k, (s0, s1, bend) in enumerate(((0.57, 0.11, 0.06), (0.31, 0.47, -0.035))):
            path = []
            for t in [i / 18 for i in range(19)]:
                s = s0 + (s1 - s0) * t + bend * math.sin(math.pi * t)
                a = top_a + (low_a - top_a) * t
                path.append((s, a))
            parts.append(_ribbon(f'{name}_stripe_{side}_{k}', path, 0.0052, coll, mt['black'], sgn))
    return parts
