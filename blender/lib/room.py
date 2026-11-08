"""Room shell: oak floor, plaster walls, a deep window reveal with a painted frame, curtains.

A small, focused study (metres, Z up): interior x in [-1.9, 1.7], y in [-1.05, 2.2],
z in [0, 2.75]. The window wall is at y = +2.2 and looks across the Danube.
"""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Vector

from . import materials as M
from .util import RNG, add_bevel, box, mesh_object, smooth, tag, tube_along

X0, X1 = -1.9, 1.7
Y0, Y1 = -1.05, 2.2
H = 2.75
WIN_X0, WIN_X1 = -1.2, 1.2
WIN_Z0, WIN_Z1 = 0.86, 2.42
REVEAL = 0.24  # wall depth at the window
GLASS_Y = Y1 + REVEAL - 0.05


def quad(bm, a, b, c, d):
    vs = [bm.verts.new(p) for p in (a, b, c, d)]
    return bm.faces.new(vs)


def build_shell(coll_floor, coll_walls) -> dict:
    out = {}
    # Floor
    bm = bmesh.new()
    quad(bm, (X0, Y0, 0), (X1, Y0, 0), (X1, Y1, 0), (X0, Y1, 0))
    # floor continues into the window reveal under the sill wall? no: wall starts at Y1
    out['floor'] = tag(mesh_object('floor', bm, coll_floor, M.oak_floor()), bake='floor')

    # Walls + ceiling (single-sided, facing inward), front wall split around the window.
    wall_mat = M.plaster()
    bm = bmesh.new()
    # left wall (x = X0), normal +x
    quad(bm, (X0, Y1, 0), (X0, Y0, 0), (X0, Y0, H), (X0, Y1, H))
    # right wall (x = X1), normal -x
    quad(bm, (X1, Y0, 0), (X1, Y1, 0), (X1, Y1, H), (X1, Y0, H))
    # back wall (y = Y0), normal +y
    quad(bm, (X0, Y0, 0), (X1, Y0, 0), (X1, Y0, H), (X0, Y0, H))
    # front wall (y = Y1), normal -y, four pieces around the opening
    quad(bm, (X1, Y1, 0), (X0, Y1, 0), (X0, Y1, WIN_Z0), (X1, Y1, WIN_Z0))  # below
    quad(bm, (X1, Y1, WIN_Z1), (X0, Y1, WIN_Z1), (X0, Y1, H), (X1, Y1, H))  # above
    quad(bm, (WIN_X0, Y1, WIN_Z0), (X0, Y1, WIN_Z0), (X0, Y1, WIN_Z1), (WIN_X0, Y1, WIN_Z1))  # left
    quad(bm, (X1, Y1, WIN_Z0), (WIN_X1, Y1, WIN_Z0), (WIN_X1, Y1, WIN_Z1), (X1, Y1, WIN_Z1))  # right
    # window reveal (top, left, right); the bottom is the sill
    yr = Y1 + REVEAL
    quad(bm, (WIN_X0, Y1, WIN_Z1), (WIN_X1, Y1, WIN_Z1), (WIN_X1, yr, WIN_Z1), (WIN_X0, yr, WIN_Z1))
    quad(bm, (WIN_X0, yr, WIN_Z0), (WIN_X0, Y1, WIN_Z0), (WIN_X0, Y1, WIN_Z1), (WIN_X0, yr, WIN_Z1))
    quad(bm, (WIN_X1, Y1, WIN_Z0), (WIN_X1, yr, WIN_Z0), (WIN_X1, yr, WIN_Z1), (WIN_X1, Y1, WIN_Z1))
    walls = mesh_object('walls', bm, coll_walls, wall_mat)
    bmesh_fix_normals(walls, inward=True)
    out['walls'] = tag(walls, bake='walls')

    # Ceiling (slightly warmer white)
    bm = bmesh.new()
    quad(bm, (X0, Y0, H), (X0, Y1, H), (X1, Y1, H), (X1, Y0, H))
    out['ceiling'] = tag(mesh_object('ceiling', bm, coll_walls, M.plaster('#F1EEE9', 'ceiling')), bake='walls')

    trim = M.paint('#F4F1EB', 'trim', 0.5)
    # Deep painted sill, protruding 6 cm into the room.
    out['sill'] = tag(box('sill', (WIN_X1 - WIN_X0 + 0.1, REVEAL + 0.06, 0.035), (0, Y1 + REVEAL / 2 - 0.03, WIN_Z0 - 0.0175), coll_walls, trim, bevel=0.006), bake='walls')

    # Window frame near the outer face of the reveal: outer frame, two mullions, a transom.
    fy = GLASS_Y
    fd = 0.07   # frame depth
    fw = 0.055  # frame width
    parts = []
    w = WIN_X1 - WIN_X0
    hgt = WIN_Z1 - WIN_Z0
    parts.append(box('frame_b', (w, fd, fw), (0, fy, WIN_Z0 + fw / 2), coll_walls, trim))
    parts.append(box('frame_t', (w, fd, fw), (0, fy, WIN_Z1 - fw / 2), coll_walls, trim))
    parts.append(box('frame_l', (fw, fd, hgt), (WIN_X0 + fw / 2, fy, (WIN_Z0 + WIN_Z1) / 2), coll_walls, trim))
    parts.append(box('frame_r', (fw, fd, hgt), (WIN_X1 - fw / 2, fy, (WIN_Z0 + WIN_Z1) / 2), coll_walls, trim))
    mull_w = 0.045
    for i in (1, 2):
        x = WIN_X0 + w * i / 3
        parts.append(box(f'mullion_{i}', (mull_w, fd, hgt), (x, fy - 0.004, (WIN_Z0 + WIN_Z1) / 2), coll_walls, trim))
    transom_z = WIN_Z1 - 0.42
    parts.append(box('transom', (w, fd, mull_w), (0, fy - 0.008, transom_z), coll_walls, trim))
    # small window handles on the two outer casements
    for i, x in enumerate((WIN_X0 + w / 3 - 0.06, WIN_X1 - w / 3 + 0.06)):
        parts.append(box(f'handle_{i}', (0.012, 0.03, 0.11), (x, fy - 0.05, WIN_Z0 + 0.55), coll_walls, M.matte('#B9B4AA', 'brass_soft', 0.4), bevel=0.003))
    for p in parts:
        tag(p, bake='walls')
    out['frame_parts'] = parts

    # Skirting boards
    sk_h, sk_d = 0.09, 0.016
    skirts = [
        box('skirt_l', (sk_d, Y1 - Y0, sk_h), (X0 + sk_d / 2, (Y0 + Y1) / 2, sk_h / 2), coll_walls, trim, bevel=0.003),
        box('skirt_r', (sk_d, Y1 - Y0, sk_h), (X1 - sk_d / 2, (Y0 + Y1) / 2, sk_h / 2), coll_walls, trim, bevel=0.003),
        box('skirt_f', (X1 - X0, sk_d, sk_h), (0, Y1 - sk_d / 2, sk_h / 2), coll_walls, trim, bevel=0.003),
        box('skirt_b', (X1 - X0, sk_d, sk_h), (0, Y0 + sk_d / 2, sk_h / 2), coll_walls, trim, bevel=0.003),
    ]
    for s in skirts:
        tag(s, bake='walls')

    # Curtain rod and two sheer linen curtains gathered at the sides.
    rod = tube_along('curtain_rod', [(WIN_X0 - 0.42, Y1 - 0.09, WIN_Z1 + 0.16), (WIN_X1 + 0.42, Y1 - 0.09, WIN_Z1 + 0.16)], 0.011, coll_walls, M.matte('#2E2E30', 'black_iron', 0.45))
    tag(rod, bake='walls')
    out['curtains'] = [
        curtain('curtain_l', WIN_X0 - 0.38, WIN_X0 + 0.08, coll_walls),
        curtain('curtain_r', WIN_X1 - 0.08, WIN_X1 + 0.38, coll_walls),
    ]
    return out


def curtain(name: str, xa: float, xb: float, coll) -> bpy.types.Object:
    """A gathered sheer curtain: a sine-folded sheet hanging from the rod to the floor."""
    bm = bmesh.new()
    nx, nz = 48, 24
    top = WIN_Z1 + 0.15
    bottom = 0.012
    y = Y1 - 0.09
    folds = 7
    grid = []
    for j in range(nz + 1):
        t = j / nz
        z = bottom + (top - bottom) * t
        row = []
        for i in range(nx + 1):
            s = i / nx
            x = xa + (xb - xa) * s
            amp = 0.035 + 0.01 * math.sin(t * 3.1)
            dy = amp * math.sin(s * folds * 2 * math.pi + t * 0.6)
            row.append(bm.verts.new((x, y + dy, z)))
        grid.append(row)
    for j in range(nz):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    ob = mesh_object(name, bm, coll, M.lampshade('#EFE9DD', 'linen_sheer'))
    tag(ob, sway='curtain', sway_top=top, sway_bottom=bottom)
    mod = ob.modifiers.new('Solidify', 'SOLIDIFY')
    mod.thickness = 0.004
    smooth(ob)
    return tag(ob, bake='walls')


def bmesh_fix_normals(ob, inward=True):
    """Make faces point into the room (towards the centre of the box)."""
    me = ob.data
    center = Vector(((X0 + X1) / 2, (Y0 + Y1) / 2, H / 2))
    bm = bmesh.new()
    bm.from_mesh(me)
    for f in bm.faces:
        to_c = center - f.calc_center_median()
        if (f.normal.dot(to_c) < 0) == inward:
            f.normal_flip()
    bm.to_mesh(me)
    bm.free()
