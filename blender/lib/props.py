"""Props: the display and peripherals, the desk objects you can pick up, the chapter dossiers,
the record player, plants, books, ceramics and art.

Objects tagged dyn=... stay separate in the export and are lit live in WebGL
(they move, glow or reflect). Everything tagged bake='props' is merged and baked.
"""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import materials as M
from .furniture import DESK, SHELF, SHELF_Z, SIDEBOARD, group_parent, parent_all
from .room import X0, Y1, WIN_Z0
from .util import RNG, add_bevel, add_box, box, cylinder, mesh_object, revolve, smooth, sphere, tag, tube_along

FOLIO_COLORS = ['#E9E4DA', '#A9B8A4', '#8FA9C4', '#1D2D3D', '#C9A27C', '#D9C9AE', '#C8432B', '#416180']
FOLIO_IDS = ['hello', 'approach', 'role', 'work', 'career', 'toolkit', 'faq', 'contact']
BOOK_COLORS = ['#D9CFBF', '#A9B8A4', '#8FA9C4', '#1D2D3D', '#C9A27C', '#E9E4DA', '#B5483A', '#6E7F8F', '#F2EFE9', '#3F4246', '#CFC4AE']

DISPLAY_ROT = math.radians(15)
DISPLAY_POS = (DESK['x'] - 0.12, DESK['y'] + 0.1)
SCREEN_W, SCREEN_H = 0.608, 0.38

# A hardcover dossier for A4 pages (metres). In its own space it stands upright: the spine
# faces +x, the boards run back to -x, the front board is on the +y side, z is up.
DOSSIER = dict(
    board_w=0.222,   # spine to fore-edge
    board_h=0.312,
    board_t=0.0028,
    thick=0.032,     # closed, board to board
    hinge_x=-0.002,  # the front board turns about a vertical line here
    page_w=0.21,
    page_h=0.297,
    page_x=-0.008,   # page block starts this far behind the spine
    spacing=0.044,
)


def place(ob, origin, rot_z):
    """Rotate an object (built around the local origin) about Z and move it to `origin`."""
    m = Matrix.Translation(Vector(origin)) @ Matrix.Rotation(rot_z, 4, 'Z')
    # matrix_basis reflects location/rotation immediately (matrix_world waits for a depsgraph update)
    ob.matrix_basis = m @ ob.matrix_basis
    return ob


# ------------------------------------------------------------------ desk setup

def build_display(coll_dyn, coll_props) -> dict:
    top = DESK['top']
    origin = (DISPLAY_POS[0], DISPLAY_POS[1], top)
    alu = M.metal('#CDCFD3', 'aluminium', 0.3)
    black = M.matte('#0B0C0E', 'bezel_black', 0.12)
    parts = []
    base = box('display_base', (0.2, 0.17, 0.008), (0, 0.03, 0.004), coll_dyn, alu, bevel=0.003)
    stand = box('display_stand', (0.13, 0.012, 0.3), (0, 0.075, 0.16), coll_dyn, alu, bevel=0.002)
    stand.rotation_euler.x = math.radians(-9)
    body = box('display_body', (0.64, 0.014, 0.404), (0, 0.0, 0.33), coll_dyn, alu, bevel=0.004)
    bezel = box('display_bezel', (0.632, 0.002, 0.396), (0, -0.0072, 0.33), coll_dyn, black, bevel=0.001)
    parts = [base, stand, body, bezel]
    for p in parts:
        place(p, origin, DISPLAY_ROT)
        tag(p, dyn='display')
    # Screen: a UV-mapped quad that the runtime paints with a canvas.
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    hw, hh = SCREEN_W / 2, SCREEN_H / 2
    zc = 0.33
    vs = [bm.verts.new(p) for p in ((-hw, -0.0085, zc - hh), (hw, -0.0085, zc - hh), (hw, -0.0085, zc + hh), (-hw, -0.0085, zc + hh))]
    f = bm.faces.new(vs)
    for lp, co in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = co
    screen = mesh_object('screen', bm, coll_dyn, M.emission('#F4F1EA', 2.2, 'screen_glow'))
    place(screen, origin, DISPLAY_ROT)
    tag(screen, dyn='screen', hit='screen', label='Display')
    # keyboard + trackpad (static, baked)
    kb_mat = M.matte('#DADBDE', 'kb_alu', 0.5)
    key_mat = M.matte('#F4F4F5', 'keycaps', 0.6)
    kb = box('keyboard', (0.28, 0.115, 0.007), (-0.02, -0.29, 0.0035), coll_props, kb_mat, bevel=0.003)
    keys = []
    for r in range(5):
        for c in range(14):
            kx = -0.02 - 0.13 + c * 0.0186 + (0.004 if r % 2 else 0)
            ky = -0.29 - 0.043 + r * 0.0195
            if c == 13 and r % 2:
                continue
            keys.append(box(f'key_{r}_{c}', (0.0155, 0.0155, 0.003), (kx, ky, 0.0085), coll_props, key_mat, bevel=0.0018, segments=2))
    pad = box('trackpad', (0.13, 0.105, 0.006), (0.215, -0.29, 0.003), coll_props, kb_mat, bevel=0.003)
    statics = [kb, pad] + keys
    for p in statics:
        place(p, origin, math.radians(4))
        tag(p, bake='props')
    return {'screen': screen, 'parts': parts}


# ------------------------------------------------------------------ the desk, dressed

def build_desk_things(coll, coll_dyn, art_paths: dict) -> dict:
    """Everyday objects that are also ways into the portfolio (the browser makes each one
    clickable): business cards, a phone, a framed portrait, the printed CV, a notebook,
    headphones, a brass armillary sphere and a coffee mug."""
    top = DESK['top']
    parts = []
    anchors = {}
    oak = M.oak('oak_small', 'light', 'X')
    # ---- mug, front right
    mug_pos = (0.47, 1.52, top)
    mug = revolve('mug', [(0.0, 0.0), (0.038, 0.0), (0.041, 0.006), (0.043, 0.09), (0.04, 0.092), (0.037, 0.012), (0.0, 0.012)], coll, M.ceramic('#E7E0D3', 'ceramic_oat', 0.4), loc=mug_pos, segs=40, cap_bottom=False)
    handle = tube_along('mug_handle', [(mug_pos[0] + 0.04, mug_pos[1], top + 0.07), (mug_pos[0] + 0.066, mug_pos[1], top + 0.066), (mug_pos[0] + 0.07, mug_pos[1], top + 0.045), (mug_pos[0] + 0.062, mug_pos[1], top + 0.028), (mug_pos[0] + 0.04, mug_pos[1], top + 0.025)], 0.006, coll, M.ceramic('#E7E0D3', 'ceramic_oat', 0.4))
    coffee = cylinder('coffee', 0.037, 0.002, (mug_pos[0], mug_pos[1], top + 0.078), coll, M.matte('#3B2A20', 'coffee', 0.2), segs=32)
    parts += [mug, handle, coffee]
    anchors['coffee'] = (mug_pos[0], mug_pos[1], top + 0.1)
    # ---- linen notebook with an elastic band, mid right: a movable group (the browser lifts it,
    # slips the band off and opens the front cover on its hinge); the pen stays on the desk
    nb_pos = (0.53, 1.8)
    rot = math.radians(-12)
    nb = notebook(coll_dyn, (nb_pos[0], nb_pos[1], top), rot)
    pen = tube_along('pen', [(nb_pos[0] - 0.105, nb_pos[1] - 0.07, top + 0.005), (nb_pos[0] - 0.09, nb_pos[1] + 0.07, top + 0.005)], 0.0045, coll, M.matte('#1D1D1F', 'pen_black', 0.35))
    parts.append(pen)
    anchors['notebook'] = (nb_pos[0], nb_pos[1], top + 0.03)
    # ---- the printed CV: three A4 sheets under a binder clip, the top one is the real one-pager
    cv_pos = (0.27, 1.76)
    cv_rot = math.radians(-9)
    for i in range(2):
        sh = box(f'cv_copy_{i}', (0.21, 0.297, 0.0006), (cv_pos[0] + 0.004 * (2 - i), cv_pos[1] - 0.003 * (2 - i), top + 0.0004 + i * 0.0007), coll, M.paper('#F6F3EC', 'paper_white'), rot_z=cv_rot + math.radians(1.5 * (2 - i)))
        parts.append(sh)
    # the top sheet is the real one-pager; it is movable (the browser lifts it to read)
    cv_art = art_paths.get('cv')
    cv_sheet = flat_art('cv_sheet', cv_art, (0.21, 0.297), coll_dyn, rough=0.88) if cv_art else box('cv_sheet', (0.21, 0.297, 0.0004), (0, 0, 0), coll_dyn, M.paper('#F6F3EC', 'paper_white'))
    cv_sheet.location = (cv_pos[0], cv_pos[1], top + 0.0024)
    cv_sheet.rotation_euler.z = cv_rot
    tag(cv_sheet, dyn='cv', hit='cv', label='CV, printed')
    # binder clip at the top edge, in the sheet's own frame
    clip_parent = group_parent('cv_clip_grp', (cv_pos[0], cv_pos[1], top), cv_rot, coll)
    clip_parts = [
        box('cv_clip', (0.032, 0.014, 0.008), (0.0, 0.142, 0.0055), coll, M.matte('#1D1D1F', 'clip_black', 0.3), bevel=0.002),
        tube_along('cv_clip_wire', [(-0.012, 0.136, 0.0095), (-0.012, 0.118, 0.0105), (0.012, 0.118, 0.0105), (0.012, 0.136, 0.0095)], 0.0011, coll, M.metal('#C9CBCF', 'steel_wire', 0.3)),
    ]
    parent_all(clip_parts, clip_parent)
    parts += clip_parts
    anchors['cv'] = (cv_pos[0], cv_pos[1], top + 0.01)
    # ---- small oak frame with the portrait, standing at the back right
    if 'portrait' in art_paths:
        parts += photo_frame(coll, art_paths['portrait'], (0.21, 2.02, top), math.radians(-18))
    anchors['about'] = (0.21, 2.0, top + 0.1)
    # ---- brass armillary sphere on an oak foot (the rings turn in the browser)
    arm_pos = (0.5, 2.0)
    parts.append(cylinder('arm_foot', 0.05, 0.022, (arm_pos[0], arm_pos[1], top + 0.011), coll, oak, segs=48, bevel=0.004))
    parts.append(revolve('arm_collar', [(0.012, 0.0), (0.012, 0.006), (0.006, 0.012), (0.0045, 0.014)], coll, M.metal('#B8955A', 'brass', 0.28), loc=(arm_pos[0], arm_pos[1], top + 0.022), segs=32))
    parts.append(tube_along('arm_stem', [(arm_pos[0], arm_pos[1], top + 0.03), (arm_pos[0], arm_pos[1], top + 0.058)], 0.0045, coll, M.metal('#B8955A', 'brass', 0.28)))
    # the meridian stand: a fixed half ring that holds the sphere
    stand_pts = [(arm_pos[0] + 0.082 * math.sin(a), arm_pos[1], top + 0.135 - 0.082 * math.cos(a)) for a in [math.radians(d) for d in range(-120, 121, 8)]]
    parts.append(tube_along('arm_stand', stand_pts, 0.0026, coll, M.metal('#B8955A', 'brass', 0.28)))
    rings = armillary(coll_dyn, (arm_pos[0], arm_pos[1], top + 0.135))
    anchors['globe'] = (arm_pos[0], arm_pos[1], top + 0.135)
    # ---- smartphone lying face up, front right: a movable group (the browser picks it up and
    # lights its screen)
    ph_pos = (0.2, 1.5)
    screen = phone(coll_dyn, (ph_pos[0], ph_pos[1], top), math.radians(-8))
    anchors['phone'] = (ph_pos[0], ph_pos[1], top + 0.01)
    # ---- business cards in a shallow oak tray, front left; the browser lifts the top card
    cd_pos = (-0.55, 1.47)
    cd_rot = math.radians(6)
    tray_parent = group_parent('card_tray_grp', (cd_pos[0], cd_pos[1], top), cd_rot, coll)
    tray_parts = [
        box('card_tray_base', (0.112, 0.074, 0.004), (0, 0, 0.002), coll, oak, bevel=0.0012),
        box('card_tray_wall_f', (0.112, 0.006, 0.013), (0, -0.034, 0.0065), coll, oak, bevel=0.0015),
        box('card_tray_wall_b', (0.112, 0.006, 0.013), (0, 0.034, 0.0065), coll, oak, bevel=0.0015),
        box('card_tray_wall_l', (0.006, 0.062, 0.013), (-0.053, 0, 0.0065), coll, oak, bevel=0.0015),
        box('card_tray_wall_r', (0.006, 0.062, 0.013), (0.053, 0, 0.0065), coll, oak, bevel=0.0015),
        box('card_stack', (0.089, 0.052, 0.009), (0, 0, 0.004 + 0.0045), coll, M.paper('#F4F0E6', 'card_stock'), bevel=0.0005, segments=2),
    ]
    parent_all(tray_parts, tray_parent)
    parts += tray_parts
    card = box('card_top', (0.089, 0.052, 0.0004), (cd_pos[0], cd_pos[1], top + 0.0134), coll_dyn, M.paper('#F7F3EA', 'card_face'), rot_z=cd_rot)
    tag(card, dyn='card', hit='cards', label='Business cards')
    anchors['cards'] = (cd_pos[0], cd_pos[1], top + 0.014)
    # ---- two books, front left, with over-ear headphones resting on them
    parts += book_stack('desk_books', (-0.66, 1.7, top), coll, n=2, rot=math.radians(-6))
    parts += headphones(coll, (-0.66, 1.7, top + 0.064))
    anchors['music'] = (-0.66, 1.7, top + 0.1)
    for p in parts:
        tag(p, bake='props')
    return {'parts': parts, 'anchors': anchors, 'armillary': rings, 'card': card, 'phone': screen, 'notebook': nb, 'cv': cv_sheet}


# notebook dimensions (metres): A5-ish, lying flat; the spine is on its left (-x) edge
NOTEBOOK = dict(w=0.15, h=0.21, cover_t=0.0022, pages_t=0.0116, page_w=0.142, page_h=0.202, page_x=0.004)
PHONE = dict(w=0.0716, h=0.1466, t=0.0078, screen_w=0.0644, screen_h=0.1392)


def notebook(coll_dyn, pos, rot_z):
    """Linen-bound notebook: back board and page block, a front board that turns on the spine,
    and the red elastic band. Parts hang under the empty `notebook`."""
    n = NOTEBOOK
    linen = M.wool('#2D4257', 'linen_navy', 400.0)
    parent = bpy.data.objects.new('notebook', None)
    parent.location = pos
    parent.rotation_euler.z = rot_z
    coll_dyn.objects.link(parent)
    tag(parent, dyn='notebook', hit='notebook', label='Notebook')
    tc, tp = n['cover_t'], n['pages_t']
    back = box('notebook_back', (n['w'], n['h'], tc), (0, 0, tc / 2), coll_dyn, linen, bevel=0.0008, segments=2)
    spine = box('notebook_spine', (0.003, n['h'], 2 * tc + tp), (-n['w'] / 2 + 0.0015, 0, (2 * tc + tp) / 2), coll_dyn, linen, bevel=0.001, segments=2)
    block = box('notebook_block', (n['page_w'], n['page_h'], tp), (-n['w'] / 2 + n['page_x'] + n['page_w'] / 2, 0, tc + tp / 2), coll_dyn, M.paper('#F2ECDF', 'paper_cream'), bevel=0.0008, segments=2)
    cover = box('notebook_cover', (n['w'], n['h'], tc), (0, 0, 0), coll_dyn, linen, bevel=0.0008, segments=2)
    cover.data.transform(Matrix.Translation((n['w'] / 2, 0, 0)))
    cover.location = (-n['w'] / 2, 0, tc + tp + tc / 2)
    band = box('notebook_band', (0.004, n['h'] + 0.004, 2 * tc + tp + 0.0015), (n['w'] / 2 - 0.025, 0, (2 * tc + tp) / 2), coll_dyn, M.matte('#C8432B', 'elastic_red', 0.6))
    for p in (back, spine, block, cover, band):
        p.parent = parent
        tag(p, dyn='notebook_part', part=p.name.split('_')[-1])
    return parent


def phone(coll_dyn, pos, rot_z):
    """A smartphone face up: graphite body, glass, camera lens; the screen is a UV-mapped quad
    the browser paints. Parts hang under the empty `phone`."""
    p = PHONE
    parent = bpy.data.objects.new('phone', None)
    parent.location = pos
    parent.rotation_euler.z = rot_z
    coll_dyn.objects.link(parent)
    tag(parent, dyn='phone', hit='phone', label='Phone')
    body = box('phone_body', (p['w'], p['h'], p['t']), (0, 0, p['t'] / 2), coll_dyn, M.metal('#3A3C40', 'graphite', 0.35), bevel=0.0035, segments=4)
    glass = box('phone_glass', (p['w'] - 0.001, p['h'] - 0.001, 0.0006), (0, 0, p['t'] + 0.0001), coll_dyn, M.matte('#0A0B0D', 'phone_glass', 0.08), bevel=0.0028, segments=3)
    lens = cylinder('phone_lens', 0.0045, 0.0012, (-0.02, 0.058, 0.0004), coll_dyn, M.matte('#111214', 'lens', 0.1), segs=24)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    hw, hh = p['screen_w'] / 2, p['screen_h'] / 2
    vs = [bm.verts.new(q) for q in ((-hw, -hh, 0), (hw, -hh, 0), (hw, hh, 0), (-hw, hh, 0))]
    f = bm.faces.new(vs)
    for lp, co in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = co
    screen = mesh_object('phone_screen', bm, coll_dyn, M.matte('#050506', 'phone_off', 0.1))
    screen.location = (0, 0, p['t'] + 0.0006)
    for q in (body, glass, lens, screen):
        q.parent = parent
        tag(q, dyn='phone_part', part=q.name.split('_')[-1])
    tag(screen, dyn='phone_part', part='screen', screen=1)
    return screen


def flat_art(name, image_path, size, coll, rough=0.85):
    """A printed surface lying flat (+z), UV-mapped to a whole image."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('ArtUV')
    w, h = size
    vs = [bm.verts.new(p) for p in ((-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0))]
    f = bm.faces.new(vs)
    for lp, co in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = co
    return mesh_object(name, bm, coll, M.image_diffuse(name, image_path, rough))


def photo_frame(coll, image_path, pos, rot_z) -> list:
    """A small oak frame (13 x 17.5 cm) leaning back on a strut, the picture facing -y."""
    oak = M.oak('oak_frame_small', 'light', 'Z')
    w, h, t, d = 0.13, 0.175, 0.012, 0.014
    lean = math.radians(-11)
    parent = group_parent('photo_frame', pos, rot_z, coll)
    tilt = bpy.data.objects.new('photo_frame_tilt', None)
    tilt.rotation_euler.x = lean
    tilt.parent = parent
    coll.objects.link(tilt)
    parts = [
        box('pf_top', (w, d, t), (0, 0, h - t / 2), coll, oak, bevel=0.0015),
        box('pf_bot', (w, d, t), (0, 0, t / 2), coll, oak, bevel=0.0015),
        box('pf_l', (t, d, h), (-w / 2 + t / 2, 0, h / 2), coll, oak, bevel=0.0015),
        box('pf_r', (t, d, h), (w / 2 - t / 2, 0, h / 2), coll, oak, bevel=0.0015),
        box('pf_back', (w - 0.006, 0.003, h - 0.006), (0, 0.005, h / 2), coll, M.paper('#E9E2D4', 'frame_back')),
        box('pf_mat', (w - 2 * t, 0.002, h - 2 * t), (0, -0.002, h / 2), coll, M.paper('#F5F2EC', 'passe_small')),
    ]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('ArtUV')
    pw, ph = w - 2 * t - 0.022, h - 2 * t - 0.03
    vs = [bm.verts.new(p) for p in ((-pw / 2, 0, -ph / 2), (pw / 2, 0, -ph / 2), (pw / 2, 0, ph / 2), (-pw / 2, 0, ph / 2))]
    f = bm.faces.new(vs)
    for lp, co in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = co
    pic = mesh_object('pf_photo', bm, coll, M.image_diffuse('pf_photo', image_path, 0.6))
    pic.location = (0, -0.0035, h / 2 + 0.004)
    parts.append(pic)
    parent_all(parts, tilt)
    # the strut runs from the back of the frame, a third of the way up, down to the desk
    strut = box('pf_strut', (0.03, 0.004, 0.12), (0, 0.0515, 0.055), coll, oak, bevel=0.001)
    strut.rotation_euler.x = math.radians(23)
    strut.parent = parent
    parts.append(strut)
    return parts


def armillary(coll_dyn, center) -> list:
    """Three brass rings (equator, colure, ecliptic) around a small sphere. Each ring keeps
    its origin at the centre so the browser can spin it about its own axis."""
    brass = M.metal('#C2A066', 'brass_bright', 0.24)
    R, r = 0.072, 0.0028
    prof = [(R + r * math.cos(a), r * math.sin(a)) for a in [k * 2 * math.pi / 16 for k in range(17)]]
    rings = []
    for i, (rx, ry) in enumerate(((0.0, 0.0), (math.radians(90), 0.0), (math.radians(66.6), math.radians(20)))):
        ring = revolve(f'arm_ring_{i}', prof, coll_dyn, brass, segs=96, cap_bottom=False)
        ring.location = center
        ring.rotation_euler = (rx, ry, 0.0)
        tag(ring, dyn='armillary', ring=i, hit='globe', label='Armillary sphere')
        rings.append(ring)
    core = sphere('arm_core', 0.016, center, coll_dyn, brass, segs=32, rings=16)
    tag(core, dyn='armillary', ring=3, hit='globe', label='Armillary sphere')
    rings.append(core)
    return rings


def headphones(coll, center) -> list:
    """Over-ear headphones lying folded flat: two cups, a padded band arching between them."""
    shell = M.matte('#2C2D30', 'hp_shell', 0.42)
    pad = M.wool('#3A3B3E', 'hp_pad', 500.0)
    alu = M.metal('#9A9DA3', 'hp_alu', 0.3)
    cx, cy, cz = center
    parts = []
    sep = 0.085
    for i, sx in enumerate((-1, 1)):
        x = cx + sx * sep
        parts.append(cylinder(f'hp_cup_{i}', 0.044, 0.03, (x, cy, cz + 0.015 + 0.012), coll, shell, segs=48, bevel=0.006))
        parts.append(cylinder(f'hp_cushion_{i}', 0.041, 0.016, (x, cy, cz + 0.006), coll, pad, segs=48, bevel=0.006))
        parts.append(tube_along(f'hp_yoke_{i}', [(x, cy + 0.04, cz + 0.03), (x, cy + 0.058, cz + 0.03)], 0.004, coll, alu))
    arc = []
    for k in range(25):
        a = math.pi * k / 24
        arc.append((cx - math.cos(a) * sep, cy + 0.058 + math.sin(a) * 0.075, cz + 0.03 + math.sin(a) * 0.004))
    parts.append(tube_along('hp_band', arc, 0.0085, coll, shell))
    parts.append(tube_along('hp_band_pad', [(p[0], p[1] - 0.004, p[2] - 0.005) for p in arc[5:20]], 0.0065, coll, pad))
    return parts


def book(name, w, d, t, loc, rot_z, color, coll, standing=True):
    """A hardcover: coloured case with a cream page block. Standing books have the spine facing +x."""
    cover = M.paper(color, f'cover_{color}')
    pages = M.paper('#EFE8DA', 'pages')
    if standing:
        c = box(name, (d, t, w), (loc[0], loc[1], loc[2] + w / 2), coll, cover, bevel=0.0015, segments=2)
        p = box(name + '_p', (d - 0.006, t - 0.004, w - 0.008), (loc[0] - 0.004, loc[1], loc[2] + w / 2), coll, pages)
    else:
        c = box(name, (d, w, t), (loc[0], loc[1], loc[2] + t / 2), coll, cover, bevel=0.0015, segments=2)
        p = box(name + '_p', (d - 0.006, w - 0.008, t - 0.004), (loc[0] - 0.004, loc[1], loc[2] + t / 2), coll, pages)
    for o in (c, p):
        o.rotation_euler.z = rot_z
    return [c, p]


def book_stack(name, loc, coll, n=3, rot=0.0):
    out = []
    z = loc[2]
    for i in range(n):
        t = RNG.uniform(0.022, 0.04)
        w = RNG.uniform(0.2, 0.25)
        d = RNG.uniform(0.15, 0.18)
        color = RNG.choice(BOOK_COLORS)
        bs = book(f'{name}_{i}', w, d, t, (loc[0] + RNG.uniform(-0.01, 0.01), loc[1] + RNG.uniform(-0.01, 0.01), z), rot + RNG.uniform(-0.15, 0.15), color, coll, standing=False)
        out += bs
        z += t
    return out


# ------------------------------------------------------------------ shelves: dossiers + books

def _spine_strip(name, coll, mat, d):
    """The cloth spine: a slightly rounded strip joining the two boards."""
    bm = bmesh.new()
    T = d['thick']
    n = 10
    rows = []
    for z in (0.0, d['board_h']):
        row = []
        for i in range(n + 1):
            y = -T / 2 + T * i / n
            x = 0.0035 * (1 - (2 * y / T) ** 2)
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    for i in range(n):
        bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
    ob = mesh_object(name, bm, coll, mat)
    sol = ob.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.0024
    sol.offset = -1.0
    smooth(ob)
    return ob


def dossier(i, fid, color, loc, rot_z, coll_dyn):
    """A cloth-bound hardcover dossier: back board and spine (one part), a front board that
    turns on its hinge, and a block of A4 pages. Parts hang under an empty `folio_NN` that
    the browser moves; it opens the front board and turns pages on top of the block."""
    d = DOSSIER
    T, tb = d['thick'], d['board_t']
    cloth = M.matte(color, f'cloth_{color}', 0.82)
    paper = M.paper('#F1EBDF', 'page_block')
    parent = bpy.data.objects.new(f'folio_{i:02d}', None)
    parent.location = loc
    parent.rotation_euler.z = rot_z
    coll_dyn.objects.link(parent)
    tag(parent, dyn='folio', folio=fid, index=i, hit=f'folio:{fid}', label=fid)
    bw, bh = d['board_w'], d['board_h']
    hx = d['hinge_x']
    back = box(f'folio_{i:02d}_back', (bw, tb, bh), (hx - bw / 2, -T / 2 + tb / 2, bh / 2), coll_dyn, cloth, bevel=0.0009, segments=2)
    spine = _spine_strip(f'folio_{i:02d}_spine', coll_dyn, cloth, d)
    # the front board, modelled about its hinge line so it can turn in place
    cover = box(f'folio_{i:02d}_cover', (bw, tb, bh), (0, 0, 0), coll_dyn, cloth, bevel=0.0009, segments=2)
    cover.data.transform(Matrix.Translation((-bw / 2, 0, bh / 2)))
    cover.location = (hx, T / 2 - tb / 2, 0)
    gap = 0.0005
    pt = T - 2 * tb - 2 * gap
    block = box(f'folio_{i:02d}_block', (d['page_w'], pt, d['page_h']), (d['page_x'] - d['page_w'] / 2, 0, (bh - d['page_h']) / 2 + d['page_h'] / 2), coll_dyn, paper, bevel=0.0012, segments=2)
    for p in (back, spine, cover, block):
        p.parent = parent
        tag(p, dyn='folio_part', part=p.name.split('_')[-1])
    return parent


def build_shelf_things(coll_dyn, coll_props) -> dict:
    sh = SHELF
    d = DOSSIER
    z_low, z_high = SHELF_Z
    folios = []
    # the eight dossiers stand at the window end of the lower shelf, spines flush with its edge,
    # so they face the room and are in view from the door
    x_spine = X0 + sh['depth'] - 0.012
    y_first = sh['y1'] - 0.09 - 7 * d['spacing']
    for i, (fid, col) in enumerate(zip(FOLIO_IDS, FOLIO_COLORS)):
        ob = dossier(i, fid, col, (x_spine, y_first + i * d['spacing'], z_low), math.radians(RNG.uniform(-0.8, 0.8)), coll_dyn)
        folios.append(ob)
    statics = []
    # an oak bookend, then books towards the door, and a sand vase at the end
    y_end = y_first - d['thick'] / 2 - 0.008
    oak = M.oak('oak_bookend', 'light', 'X')
    statics.append(box('bookend', (0.15, 0.022, 0.16), (X0 + 0.02 + 0.075, y_end - 0.011, z_low + 0.08), coll_props, oak, bevel=0.003))
    yb = y_end - 0.03
    for i in range(8):
        t = RNG.uniform(0.022, 0.042)
        w = RNG.uniform(0.21, 0.26)
        statics += book(f'shelf_book_{i}', w, 0.17, t, (X0 + 0.02 + 0.085, yb - t / 2, z_low), RNG.uniform(-0.02, 0.02), RNG.choice(BOOK_COLORS), coll_props)
        yb -= t + 0.002
    statics.append(revolve('shelf_vase', [(0.0, 0.0), (0.035, 0.0), (0.05, 0.05), (0.042, 0.11), (0.022, 0.15), (0.024, 0.16), (0.0, 0.16)], coll_props, M.ceramic('#D9D2C3', 'ceramic_sand', 0.5), loc=(X0 + 0.13, sh['y0'] + 0.12, z_low), segs=40))
    # upper shelf: a lying stack, standing books, a sage pot with a coin-leaf plant
    statics += book_stack('upper_stack', (X0 + 0.13, sh['y0'] + 0.18, z_high), coll_props, n=3, rot=math.radians(90))
    yb = sh['y0'] + 0.38
    for i in range(9):
        t = RNG.uniform(0.02, 0.04)
        w = RNG.uniform(0.19, 0.26)
        statics += book(f'upper_book_{i}', w, 0.16, t, (X0 + 0.02 + 0.08, yb + t / 2, z_high), RNG.uniform(-0.02, 0.02), RNG.choice(BOOK_COLORS), coll_props)
        yb += t + 0.002
    statics.append(revolve('upper_pot', [(0.0, 0.0), (0.045, 0.0), (0.055, 0.1), (0.058, 0.105), (0.0, 0.105)], coll_props, M.ceramic('#A9B8A4', 'ceramic_sage', 0.45), loc=(X0 + 0.13, sh['y1'] - 0.16, z_high), segs=40))
    statics += pilea('upper_plant', (X0 + 0.13, sh['y1'] - 0.16, z_high + 0.1), coll_props, size=0.85)
    for p in statics:
        tag(p, bake='props')
    mid = (Vector(folios[0].location) + Vector(folios[-1].location)) / 2
    return {'folios': folios, 'mid': tuple(mid)}


# ------------------------------------------------------------------ record player

RECORD_Y = 1.2


def build_record_player(coll_dyn, coll_props) -> dict:
    s = SIDEBOARD
    cx = s['x0'] + s['depth'] / 2 + 0.01
    cy = RECORD_Y
    z = s['z1']
    oak = M.oak('oak_plinth', 'warm', 'Y')
    plinth = box('tt_plinth', (0.34, 0.44, 0.07), (cx, cy, z + 0.035), coll_props, oak, bevel=0.008)
    feet = [cylinder(f'tt_foot_{i}', 0.02, 0.008, (cx + dx, cy + dy, z - 0.002), coll_props, M.matte('#1E1E20', 'rubber', 0.8), segs=20) for i, (dx, dy) in enumerate(((0.13, 0.18), (-0.13, 0.18), (0.13, -0.18), (-0.13, -0.18)))]
    for f in feet:
        f.location.z = z + 0.002
    for p in [plinth] + feet:
        tag(p, bake='props')
    pz = z + 0.07
    pcx, pcy = cx - 0.02, cy - 0.05
    platter = cylinder('tt_platter', 0.15, 0.02, (pcx, pcy, pz + 0.01), coll_dyn, M.metal('#C4C6CA', 'alu_brushed', 0.38), segs=64)
    tag(platter, dyn='platter', hit='record', label='Record player')
    record = cylinder('tt_record', 0.148, 0.0025, (pcx, pcy, pz + 0.0215), coll_dyn, M.matte('#111113', 'vinyl', 0.25), segs=96)
    tag(record, dyn='record', hit='record')
    # Tonearm, origin at the pivot so it can swing onto the record.
    pivot = Vector((cx + 0.11, cy + 0.15, pz))
    base = cylinder('tt_arm_base', 0.022, 0.03, (0, 0, 0.015), coll_dyn, M.metal('#B9BBC0', 'alu_dark', 0.3), segs=32)
    tube = tube_along('tt_arm_tube', [(0, 0, 0.032), (-0.03, -0.12, 0.034), (-0.045, -0.205, 0.03)], 0.0035, coll_dyn, M.metal('#D0D2D6', 'alu_bright', 0.25))
    head = box('tt_headshell', (0.018, 0.04, 0.006), (-0.047, -0.222, 0.027), coll_dyn, M.matte('#1D1D1F', 'headshell', 0.4))
    cw = cylinder('tt_counterweight', 0.012, 0.03, (0.008, 0.05, 0.032), coll_dyn, M.metal('#9EA1A6', 'alu_dark2', 0.35), segs=24)
    cw.rotation_euler.x = math.radians(90)
    from .util import join
    arm = join([base, tube, head, cw], 'tonearm', coll_dyn)
    arm.location = pivot  # parts were modelled around the origin, i.e. in pivot space
    tag(arm, dyn='tonearm', hit='record')
    return {'platter': platter, 'record': record, 'tonearm': arm, 'pivot': tuple(pivot), 'center': (cx, cy, z)}


# ------------------------------------------------------------------ plants

def leaf_mesh(bm, length, width, base: Vector, direction: Vector, up: Vector, cup=0.25, droop=0.25):
    """Add a single leaf (folded ellipse) to a bmesh."""
    segs = 7
    verts_l, verts_r, mid = [], [], []
    d = direction.normalized()
    side = d.cross(up).normalized()
    nrm = side.cross(d).normalized()
    for i in range(segs + 1):
        t = i / segs
        wdt = width * math.sin(math.pi * min(1.0, t * 1.05)) * (1 - 0.15 * t)
        p = base + d * (length * t) - nrm * (droop * length * t * t)
        mid.append(bm.verts.new(p + nrm * (cup * wdt * 0.3)))
        verts_l.append(bm.verts.new(p + side * wdt / 2))
        verts_r.append(bm.verts.new(p - side * wdt / 2))
    for i in range(segs):
        bm.faces.new((verts_l[i], verts_l[i + 1], mid[i + 1], mid[i]))
        bm.faces.new((mid[i], mid[i + 1], verts_r[i + 1], verts_r[i]))


def pilea(name, loc, coll, size=1.0) -> list:
    """Coin-leaf plant: round leaves on thin petioles fanning out from a short stem."""
    bm = bmesh.new()
    origin = Vector(loc)
    leaves = 16
    for i in range(leaves):
        a = i * 2.4
        tilt = RNG.uniform(0.35, 0.9)
        L = RNG.uniform(0.08, 0.13) * size
        dirv = Vector((math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt), math.cos(tilt)))
        tip = origin + dirv * L
        leaf_mesh(bm, 0.05 * size, 0.05 * size, tip, Vector((dirv.x, dirv.y, 0.2)).normalized(), Vector((0, 0, 1)), cup=0.5, droop=0.05)
    ob = mesh_object(name, bm, coll, M.leaf('#4F6B45', 'leaf_pilea'))
    tag(ob, sway='leaf', sway_base=float(origin.z), sway_height=0.16 * size)
    sol = ob.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.0015
    smooth(ob)
    stems = []
    for i in range(leaves):
        a = i * 2.4
        tilt = RNG.uniform(0.35, 0.9)
        L = RNG.uniform(0.07, 0.12) * size
        dirv = Vector((math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt), math.cos(tilt)))
        stems.append(tube_along(f'{name}_stem_{i}', [tuple(origin), tuple(origin + dirv * L)], 0.0015, coll, M.leaf('#6E8A55', 'stem_green')))
    return [ob] + stems


def big_plant(coll, loc=(-1.55, 1.84)) -> list:
    """A tall ficus-like plant in a pale ceramic pot for the corner by the window."""
    parts = []
    pot = revolve('big_pot', [(0.0, 0.0), (0.16, 0.0), (0.2, 0.06), (0.215, 0.34), (0.21, 0.36), (0.19, 0.36), (0.19, 0.33), (0.0, 0.33)], coll, M.ceramic('#E4DED3', 'ceramic_pale', 0.55), loc=(loc[0], loc[1], 0), segs=56, cap_bottom=True)
    soil = cylinder('big_soil', 0.19, 0.01, (loc[0], loc[1], 0.33), coll, M.matte('#3A2E26', 'soil', 0.95), segs=40)
    parts += [pot, soil]
    bark = M.oak('bark', 'warm', 'Z')
    bm = bmesh.new()
    stems = [
        [(0, 0, 0.33), (0.02, 0.01, 0.9), (0.05, -0.02, 1.45), (0.06, 0.0, 1.85)],
        [(0, 0, 0.33), (-0.04, 0.03, 0.8), (-0.12, 0.06, 1.25), (-0.18, 0.04, 1.55)],
        [(0, 0, 0.33), (0.03, -0.03, 0.7), (0.14, -0.06, 1.05), (0.22, -0.1, 1.3)],
    ]
    for si, st in enumerate(stems):
        pts = [(loc[0] + p[0], loc[1] + p[1], p[2]) for p in st]
        parts.append(tube_along(f'big_stem_{si}', pts, 0.012 - si * 0.002, coll, bark))
        # leaves along the upper part of each stem
        n = 14 - si * 2
        for k in range(n):
            t = 0.35 + 0.65 * k / n
            seg = min(int(t * (len(pts) - 1)), len(pts) - 2)
            u = t * (len(pts) - 1) - seg
            p0, p1 = Vector(pts[seg]), Vector(pts[seg + 1])
            base = p0.lerp(p1, u)
            a = k * 2.39996 + si
            out = Vector((math.cos(a), math.sin(a), RNG.uniform(0.1, 0.7))).normalized()
            L = RNG.uniform(0.2, 0.3)
            leaf_mesh(bm, L, L * 0.62, base, out, Vector((0, 0, 1)), cup=0.35, droop=0.35)
    leaves = mesh_object('big_leaves', bm, coll, M.leaf('#4B6A43', 'leaf_ficus'))
    tag(leaves, sway='leaf', sway_base=0.6, sway_height=1.4)
    sol = leaves.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.002
    smooth(leaves)
    parts.append(leaves)
    for p in parts:
        tag(p, bake='props')
    return parts


def sill_things(coll) -> list:
    parts = []
    z = WIN_Z0
    yy = Y1 + 0.1
    pot = revolve('sill_pot', [(0.0, 0.0), (0.05, 0.0), (0.06, 0.09), (0.062, 0.095), (0.0, 0.095)], coll, M.ceramic('#C9785B', 'terracotta', 0.7, speckle=False), loc=(0.92, yy, z), segs=40)
    parts.append(pot)
    parts += pilea('sill_pilea', (0.92, yy, z + 0.095), coll, size=1.05)
    # a tall bud vase with a dried stem, and a small candle holder
    vase = revolve('sill_vase', [(0.0, 0.0), (0.03, 0.0), (0.045, 0.06), (0.03, 0.16), (0.012, 0.22), (0.014, 0.23), (0.0, 0.23)], coll, M.ceramic('#1D2D3D', 'ceramic_navy', 0.3, speckle=False), loc=(-0.85, yy, z), segs=40)
    parts.append(vase)
    for i in range(3):
        a = i * 2.1
        tip = (-0.85 + math.cos(a) * 0.08, yy + math.sin(a) * 0.05, z + 0.5 + i * 0.05)
        parts.append(tube_along(f'dried_{i}', [(-0.85, yy, z + 0.2), tip], 0.0015, coll, M.matte('#B59A72', 'dried_grass', 0.9)))
        parts.append(sphere(f'dried_head_{i}', 0.012, tip, coll, M.wool('#D8C6A2', 'grass_fluff', 600.0), segs=10, rings=6, scale=(1, 1, 2.2)))
    holder = revolve('sill_candle_holder', [(0.0, 0.0), (0.035, 0.0), (0.036, 0.04), (0.03, 0.04), (0.03, 0.008), (0.0, 0.008)], coll, glass_tint(), loc=(-0.55, yy, z), segs=32)
    parts.append(holder)
    for p in parts:
        tag(p, bake='props')
    return parts


def glass_tint():
    return M.ceramic('#B9C4C8', 'smoked_glass', 0.15, speckle=False)


def set_uv_front(ob):
    """Map a thin box's large faces to the full 0-1 UV square (for printed covers)."""
    me = ob.data
    uv = me.uv_layers.get('ArtUV') or me.uv_layers.new(name='ArtUV')
    xs = [v.co.x for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))


# ------------------------------------------------------------------ sideboard top + floor bits

def sideboard_things(coll, art_paths: dict) -> dict:
    """Under the shelves: a framed print leaning on the wall, ceramics, a candle in a glass,
    a short stack of books; record sleeves lean against the end of the sideboard."""
    s = SIDEBOARD
    z = s['z1']
    cx = s['x0'] + s['depth'] / 2
    parts = []
    parts += leaning_print(coll, art_paths['print'], (X0 + 0.1, 0.38, z), size=(0.4, 0.5))
    # ceramics in front of the print, overlapping it a little
    parts.append(revolve('sb_vase_small', [(0.0, 0.0), (0.06, 0.0), (0.075, 0.05), (0.06, 0.12), (0.045, 0.13), (0.0, 0.13)], coll, M.ceramic('#A9B8A4', 'ceramic_sage', 0.45), loc=(cx + 0.08, 0.26, z), segs=48))
    bud = revolve('sb_bud_vase', [(0.0, 0.0), (0.028, 0.0), (0.04, 0.05), (0.026, 0.14), (0.011, 0.19), (0.013, 0.2), (0.0, 0.2)], coll, M.ceramic('#EDE7DC', 'ceramic_chalk', 0.6), loc=(cx + 0.1, 0.5, z), segs=40)
    parts.append(bud)
    for i in range(3):
        a = i * 2.2 + 0.4
        tip = (cx + 0.1 + math.cos(a) * 0.07, 0.5 + math.sin(a) * 0.05, z + 0.4 + i * 0.03)
        parts.append(tube_along(f'sb_stem_{i}', [(cx + 0.1, 0.5, z + 0.18), tip], 0.0014, coll, M.matte('#B59A72', 'dried_grass', 0.9)))
        parts.append(sphere(f'sb_stem_head_{i}', 0.011, tip, coll, M.wool('#D8C6A2', 'grass_fluff', 600.0), segs=10, rings=6, scale=(1, 1, 2.2)))
    # a pillar candle in a smoked glass, the evening's small light
    cpos = (cx + 0.1, 0.92)
    glass = revolve('sb_candle_glass', [(0.0, 0.0), (0.042, 0.0), (0.044, 0.004), (0.044, 0.09), (0.04, 0.09), (0.04, 0.008), (0.0, 0.008)], coll, glass_tint(), loc=(cpos[0], cpos[1], z), segs=40)
    wax = cylinder('sb_candle', 0.036, 0.06, (cpos[0], cpos[1], z + 0.008 + 0.03), coll, M.matte('#F4EEDF', 'wax', 0.6), segs=40)
    wick = tube_along('sb_wick', [(cpos[0], cpos[1], z + 0.067), (cpos[0], cpos[1], z + 0.077)], 0.0012, coll, M.matte('#1A1A1A', 'wick', 0.9))
    parts += [glass, wax, wick]
    flame = (cpos[0], cpos[1], z + 0.09)
    # two books lying flat between the ceramics and the candle
    parts += book_stack('sb_books', (cx, 0.72, z), coll, n=2, rot=math.radians(4))
    # record sleeves leaning against the end of the sideboard
    for i, key in enumerate(('sleeve_a', 'sleeve_b', 'sleeve_c')):
        mat = M.image_diffuse(f'sleeve_{i}', art_paths[key], 0.7) if key in art_paths else M.paper(BOOK_COLORS[i], f'sleeve_{i}')
        sl = box(f'sleeve_{i}', (0.315, 0.004, 0.315), (cx - 0.02 + i * 0.012, s['y1'] + 0.06 + i * 0.012, 0.16), coll, mat, bevel=0.001)
        sl.rotation_euler.x = math.radians(-12 + i * 2)
        set_uv_front(sl)
        parts.append(sl)
    for p in parts:
        tag(p, bake='props')
    return {'parts': parts, 'flame': flame}


def leaning_print(coll, image_path, base, size=(0.4, 0.5)) -> list:
    """An oak frame with a passe-partout, standing on the sideboard and leaning on the wall
    behind it (the picture faces +x, into the room)."""
    w, h = size
    oak = M.oak('oak_frame', 'light', 'Z')
    t, d = 0.022, 0.024
    # built facing -y about its bottom edge, then turned to face +x and leaned back
    parent = group_parent('print_frame', base, math.radians(90), coll)
    parent.rotation_euler.x = math.radians(-9)
    parts = [
        box('frame_top', (w, d, t), (0, 0, h - t / 2), coll, oak, bevel=0.002),
        box('frame_bot', (w, d, t), (0, 0, t / 2), coll, oak, bevel=0.002),
        box('frame_l', (t, d, h), (-w / 2 + t / 2, 0, h / 2), coll, oak, bevel=0.002),
        box('frame_r', (t, d, h), (w / 2 - t / 2, 0, h / 2), coll, oak, bevel=0.002),
        box('frame_back', (w - 0.008, 0.004, h - 0.008), (0, 0.009, h / 2), coll, M.paper('#E9E2D4', 'frame_back')),
        box('passepartout', (w - 2 * t, 0.003, h - 2 * t), (0, 0.004, h / 2), coll, M.paper('#F5F2EC', 'passe_partout')),
    ]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('ArtUV')
    pw, ph = w - 2 * t - 0.08, h - 2 * t - 0.1
    vs = [bm.verts.new(p) for p in ((-pw / 2, 0, -ph / 2), (pw / 2, 0, -ph / 2), (pw / 2, 0, ph / 2), (-pw / 2, 0, ph / 2))]
    f = bm.faces.new(vs)
    for lp, co in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = co
    art = mesh_object('print_art', bm, coll, M.image_diffuse('print_art', image_path, 0.9))
    art.location = (0, 0.0022, h / 2 + 0.008)
    parts.append(art)
    parent_all(parts, parent)
    return parts


# ------------------------------------------------------------------ hit areas

def hit_box(name, size, loc, coll, hit, label, rot_z=0.0):
    ob = box(name, size, loc, coll, None, rot_z=rot_z)
    ob.hide_render = True
    ob.display_type = 'WIRE'
    tag(ob, hit=hit, label=label, invisible=True)
    return ob
