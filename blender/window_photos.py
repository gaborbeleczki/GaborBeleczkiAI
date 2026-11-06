"""The window: two photographs of Budapest turned into a small 3D scene.

  python blender/fetch_photos.py      # sources -> blender/assets/photos/
  python blender/window_photos.py

For each lighting state this writes
  public/textures/window_{state}.webp        the colour plate, full resolution
  public/textures/window_{state}_lo.webp     a 1024 px plate for the first frames
  public/textures/window_{state}_data.png    R depth, G water, B lights/glints, A foliage
and public/models/window.json: the camera of each photo and the paths of everything that moves
(traffic on the bridge and the embankment, tram 2, river boats, a plane, birds).

Nothing here is measured. Depth comes from a handful of lines drawn on each photo (the far bank,
the bridge deck, the towers, the trees in front) and the geometry of a camera standing 55-60 m
above the Danube: the river is a plane, so its distance follows from how far below the horizon
a pixel sits; buildings stand on the far bank; the bridge stands on its deck line.

  R = sqrt(10 m / depth)   (0 = sky)      G = river surface
  B = point lights (evening) or sun glints on the water (day)
  A = how much a pixel belongs to a tree crown that moves in the wind

Photos (credited on the page and in the README):
  evening  "Széchenyi Chain Bridge in Budapest at night", Wilfredor, CC0
  day      "View from Buda Castle", Yair-haklai, CC BY-SA 4.0. Cropped, a parked tram painted out;
           the edited plate is shared under the same licence.
"""

from __future__ import annotations

import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'blender', 'assets', 'photos')
TEX = os.path.join(ROOT, 'public', 'textures')
QA = os.path.join(ROOT, 'blender', 'out', 'window')
DATA_W = 1536
LO_W = 1024


# ---------------------------------------------------------------------------- helpers

def interp(pts, x):
    xs, ys = zip(*pts)
    return np.interp(x, xs, ys)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


class Grid:
    """Data-map pixels with their position in source-photo coordinates (x right, y down, 0..1)."""

    def __init__(self, crop, w, h):
        self.crop, self.w, self.h = crop, w, h
        x0, y0, x1, y1 = crop
        px = (np.arange(w) + 0.5) / w
        py = (np.arange(h) + 0.5) / h
        self.X = np.broadcast_to(x0 + px[None, :] * (x1 - x0), (h, w)).copy()
        self.Y = np.broadcast_to(y0 + py[:, None] * (y1 - y0), (h, w)).copy()

    def to_px(self, x, y):
        x0, y0, x1, y1 = self.crop
        return ((x - x0) / (x1 - x0) * self.w, (y - y0) / (y1 - y0) * self.h)

    def polygon(self, pts, ss=4):
        """Anti-aliased polygon coverage (0..1), points in source coordinates."""
        im = Image.new('L', (self.w * ss, self.h * ss), 0)
        d = ImageDraw.Draw(im)
        d.polygon([tuple(v * ss for v in self.to_px(x, y)) for x, y in pts], fill=255)
        im = im.resize((self.w, self.h), Image.BOX)
        return np.asarray(im, dtype=np.float32) / 255.0


def blur(a, sigma):
    """Separable Gaussian blur (edges clamped)."""
    rad = max(1, int(3 * sigma + 0.5))
    k = np.exp(-0.5 * (np.arange(-rad, rad + 1) / sigma) ** 2)
    k /= k.sum()
    out = a.astype(np.float32)
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (rad, rad)
        p = np.pad(out, pad, mode='edge')
        acc = np.zeros_like(out)
        n = out.shape[axis]
        for i, w in enumerate(k):
            acc += w * (p[i:i + n, :] if axis == 0 else p[:, i:i + n])
        out = acc
    return out


def _rank(a, size, fn):
    rad = size // 2
    p = np.pad(a.astype(np.float32), rad, mode='edge')
    h, w = a.shape
    out = None
    for dy in range(size):
        for dx in range(size):
            v = p[dy:dy + h, dx:dx + w]
            out = v.copy() if out is None else fn(out, v)
    return out


def maxf(a, size):
    return _rank(a, size, np.maximum)


def minf(a, size):
    return _rank(a, size, np.minimum)


def hue_sat(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    c = np.maximum(mx - mn, 1e-6)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / c) % 6, np.where(mx == g, (b - r) / c + 2, (r - g) / c + 4)) * 60
    return h, (mx - mn) / np.maximum(mx, 1e-6)




def lum_of(rgb):
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def load_plate(name, crop):
    im = Image.open(os.path.join(SRC, name)).convert('RGB')
    W, H = im.size
    x0, y0, x1, y1 = crop
    box = (round(x0 * W), round(y0 * H), round(x1 * W), round(y1 * H))
    return im.crop(box), (W, H)


def paint_over(plate, crop, src_size, region, shift):
    """Clone-stamp: replace `region` (polygon, source coords) with the pixels `shift` away."""
    W, H = src_size
    x0, y0, x1, y1 = crop
    pw, ph = plate.size
    to = lambda x, y: ((x - x0) / (x1 - x0) * pw, (y - y0) / (y1 - y0) * ph)
    mask = Image.new('L', plate.size, 0)
    ImageDraw.Draw(mask).polygon([to(x, y) for x, y in region], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.6))
    dx = round(shift[0] / (x1 - x0) * pw)
    dy = round(shift[1] / (y1 - y0) * ph)
    moved = Image.new('RGB', plate.size)
    moved.paste(plate, (-dx, -dy))
    return Image.composite(moved, plate, mask)


# ---------------------------------------------------------------------------- evening

NIGHT = {
    'file': 'chain-bridge-night.jpg',
    'crop': (0.0, 0.0, 1.0, 1.0),
    'fpx': 6800.0,          # Nikon D300 at 38 mm, in source pixels
    'horizon': 0.21,
    'height': 55.0,         # metres above the river (Castle Hill)
    'foreground': 40.0,     # metres to the trees and roofs below the terrace
    # the Pest bank: where the water meets the quay wall
    'bank': [(0.0, 0.398), (0.17, 0.42), (0.31, 0.44), (0.5, 0.458), (0.7, 0.465), (0.88, 0.47), (1.0, 0.475)],
    # road level on the bridge, Buda end (left, near) to Pest end (right, far)
    'deck': [(0.06, 0.73), (0.10, 0.71), (0.20, 0.68), (0.31, 0.665), (0.44, 0.635), (0.6, 0.575), (0.79, 0.515), (0.88, 0.495), (1.0, 0.485)],
    'chain': [(0.06, 0.74), (0.15, 0.655), (0.22, 0.59), (0.30, 0.515), (0.33, 0.50), (0.42, 0.50), (0.5, 0.525), (0.6, 0.548), (0.7, 0.53), (0.8, 0.47), (0.88, 0.405), (0.92, 0.385), (0.98, 0.39), (1.0, 0.42)],
    'deck_low': [(0.06, 0.785), (0.15, 0.758), (0.22, 0.733), (0.31, 0.705), (0.44, 0.66), (0.6, 0.598), (0.79, 0.533), (0.88, 0.512), (1.0, 0.5)],
    'tower_a': [(0.315, 0.415), (0.425, 0.415), (0.425, 0.70), (0.442, 0.70), (0.442, 0.79), (0.298, 0.79), (0.298, 0.70), (0.315, 0.70)],
    'tower_b': [(0.873, 0.34), (0.968, 0.34), (0.968, 0.52), (0.982, 0.52), (0.982, 0.585), (0.868, 0.585), (0.868, 0.52), (0.873, 0.52)],
    # dark trees and roofs below the terrace (only their dark pixels count)
    'fore': [
        [(0.0, 0.58), (0.06, 0.58), (0.11, 0.62), (0.2, 0.7), (0.205, 0.86), (0.39, 0.86), (0.39, 1.0), (0.0, 1.0)],
        [(0.38, 0.83), (0.495, 0.83), (0.495, 1.0), (0.38, 1.0)],
        [(0.495, 0.9), (0.83, 0.9), (0.83, 1.0), (0.495, 1.0)],
        [(0.83, 0.925), (1.0, 0.925), (1.0, 1.0), (0.83, 1.0)],
    ],
    # tree crowns that sway: polygon, crown top y, crown base y
    'trees': [
        ([(0.0, 0.57), (0.07, 0.57), (0.13, 0.63), (0.21, 0.7), (0.21, 0.86), (0.0, 0.86)], 0.58, 0.86),
        ([(0.38, 0.82), (0.5, 0.82), (0.5, 1.0), (0.38, 1.0)], 0.83, 1.0),
        ([(0.5, 0.89), (1.0, 0.89), (1.0, 1.0), (0.5, 1.0)], 0.9, 1.0),
    ],
}


def evening_maps(rgb, g: Grid):
    c = NIGHT
    X, Y = g.X, g.Y
    lum = lum_of(rgb)
    K = c['height'] * c['fpx'] / 2000.0          # river plane: depth = K / (y - horizon)
    Kd = (c['height'] - 10.0) * c['fpx'] / 2000.0  # bridge road ~10 m above the water
    yh = c['horizon']
    bank = interp(c['bank'], X)
    d_bank = K / (bank - yh)

    # city: building fronts stand on the quay, then the roofs recede towards the skyline
    up = np.clip(bank - Y, 0, None)
    depth = d_bank * (1.0 + np.clip(up - 0.06, 0, None) * 40.0)
    # river
    river = smoothstep(bank - 0.002, bank + 0.006, Y)
    d_river = K / np.maximum(Y - yh, 1e-3)
    depth = depth * (1 - river) + d_river * river
    water = river.copy()

    # bridge: chains and deck between the chain line and the deck's underside, plus the towers
    chain = interp(c['chain'], X) - 0.012
    low = interp(c['deck_low'], X) + 0.006
    band = smoothstep(chain - 0.004, chain + 0.004, Y) * (1 - smoothstep(low - 0.004, low + 0.004, Y))
    band *= smoothstep(0.04, 0.06, X)
    d_deck = Kd / np.maximum(interp(c['deck'], X) - yh, 1e-3)
    ta = g.polygon(c['tower_a'])
    tb = g.polygon(c['tower_b'])
    bridge = np.maximum(band, np.maximum(ta, tb))
    d_bridge = d_deck
    d_bridge = d_bridge * (1 - ta) + (K / (0.79 - yh)) * ta
    d_bridge = d_bridge * (1 - tb) + (K / (0.585 - yh)) * tb
    depth = depth * (1 - bridge) + d_bridge * bridge
    water *= 1 - bridge

    # the moored cruise boat on the Pest side should not ripple with the river
    water *= 1 - g.polygon([(0.612, 0.452), (0.812, 0.452), (0.812, 0.509), (0.612, 0.509)])

    # foreground: the dark trees and roofs right below the terrace
    region = np.zeros_like(lum)
    for poly in c['fore']:
        region = np.maximum(region, g.polygon(poly))
    dark = (lum < 0.12).astype(np.float32)
    fore = region * dark
    fore = minf(maxf(fore, 5), 5)            # close small holes
    fore = maxf(minf(fore, 3), 3)            # drop thin dark lines (the deck's shadows)
    fore = np.clip(blur(fore, 1.0), 0, 1) * region
    water *= 1 - fore

    # crowns that sway, more towards the top
    sway = np.zeros_like(lum)
    for poly, top, base in c['trees']:
        w = g.polygon(poly) * (0.25 + 0.75 * np.clip((base - Y) / (base - top), 0, 1))
        sway = np.maximum(sway, w)
    sway *= fore

    # point lights: bright and brighter than their surroundings (not their reflections)
    local = lum - blur(lum, 3.0)
    lights = np.clip(local * 5.0, 0, 1) * smoothstep(0.32, 0.6, lum) * (1 - water) * (1 - fore)
    lights = np.maximum(lights, smoothstep(0.75, 0.95, lum) * (1 - water))
    return depth, water, lights, fore, sway


# ---------------------------------------------------------------------------- day

DAY = {
    'file': 'view-from-buda-castle.jpg',
    'crop': (0.0, 0.0, 1.0, 0.85),
    'fpx': 2795.0,          # ~69° across 3840 px (phone main camera)
    'horizon': 0.42,
    'height': 60.0,         # the palace terrace
    'foreground': 24.0,     # the big tree in front
    'bank': [(0.0, 0.452), (0.02, 0.468), (0.048, 0.48), (0.1, 0.489), (0.174, 0.513), (0.25, 0.522), (0.315, 0.528), (0.45, 0.537), (0.6, 0.548), (0.73, 0.556), (0.85, 0.559), (1.0, 0.562)],
    # road centre on the bridge, Buda end (bottom) to Pest end
    'deck': [(0.598, 0.735), (0.612, 0.708), (0.627, 0.682), (0.643, 0.656), (0.656, 0.632), (0.668, 0.61), (0.68, 0.588), (0.693, 0.565), (0.705, 0.543), (0.716, 0.523), (0.722, 0.515)],
    'tower_a': [(0.629, 0.533), (0.679, 0.533), (0.679, 0.62), (0.693, 0.62), (0.693, 0.702), (0.644, 0.702), (0.644, 0.62), (0.629, 0.62)],
    'tower_b': [(0.687, 0.487), (0.721, 0.487), (0.721, 0.589), (0.687, 0.589)],
    # the near shore on the left: roofs of Víziváros below the castle
    'shore': [(0.0, 0.573), (0.1, 0.578), (0.2, 0.591), (0.3, 0.604), (0.37, 0.608), (0.42, 0.615)],
    # the big tree in the middle, right in front of the terrace
    'big_tree': [(0.25, 0.85), (0.27, 0.74), (0.3, 0.68), (0.34, 0.63), (0.39, 0.592), (0.43, 0.565), (0.47, 0.546), (0.52, 0.547), (0.57, 0.56), (0.605, 0.6), (0.615, 0.65), (0.6, 0.71), (0.6, 0.78), (0.63, 0.85)],
    # a parked tram 2 on the Pest embankment (our own tram runs on that track)
    'tram_patch': [(0.908, 0.531), (0.953, 0.531), (0.953, 0.5462), (0.92, 0.5462), (0.92, 0.5405), (0.908, 0.5405)],
}


def day_bridge_band(g: Grid):
    # girders and chains around the road, wider at the near end (the bridge is seen almost end-on)
    pts = DAY['deck']
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        t = i / (len(pts) - 1)
        left.append((x - 0.03 * (1 - t) - 0.012 * t, y))
        right.append((x + 0.026 * (1 - t) + 0.01 * t, y))
    return g.polygon([(0.585, 0.76)] + left + right[::-1] + [(0.625, 0.76)])


def day_maps(rgb, g: Grid):
    c = DAY
    X, Y = g.X, g.Y
    r, gg, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = lum_of(rgb)
    H = 2162.0
    K = c['height'] * c['fpx'] / H
    Kd = (c['height'] - 10.0) * c['fpx'] / H
    yh = c['horizon']
    bank = interp(c['bank'], X)
    d_bank = K / (bank - yh)

    up = np.clip(bank - Y, 0, None)
    depth = d_bank * (1.0 + np.clip(up - 0.05, 0, None) * 60.0)
    # sky: blue and above the skyline
    sky = ((b > r + 0.12) & (b > 0.45) & (Y < 0.47)).astype(np.float32)
    sky = minf(maxf(sky, 3), 3) * (Y < 0.47)
    depth = np.where(sky > 0.5, 1e5, depth)

    river = smoothstep(bank - 0.002, bank + 0.005, Y)
    d_river = K / np.maximum(Y - yh, 1e-3)
    depth = depth * (1 - river) + d_river * river
    water = river * ((b > r + 0.03) | (lum < 0.35)).astype(np.float32)

    # near shore on the left: roofs on the slope below the castle
    shore = smoothstep(interp(c['shore'], X) - 0.002, interp(c['shore'], X) + 0.004, Y) * (X < 0.42)
    d_shore = 50.0 / np.maximum(Y - yh, 1e-3)
    depth = depth * (1 - shore) + d_shore * shore
    water *= 1 - shore

    # the bridge
    band = day_bridge_band(g)
    ta = g.polygon(c['tower_a'])
    tb = g.polygon(c['tower_b'])
    bridge = np.maximum(band, np.maximum(ta, tb))
    # seen almost end-on: distance along the bridge shows up as height in the picture
    d_bridge = Kd / (np.clip(Y, 0.515, 0.735) - yh)
    d_bridge = d_bridge * (1 - ta) + 285.0 * ta
    d_bridge = d_bridge * (1 - tb) + 500.0 * tb
    depth = depth * (1 - bridge) + d_bridge * bridge
    water *= 1 - bridge

    # trees: yellow-green to green (beige facades sit below 50° hue), or the shade inside a crown
    hue, sat = hue_sat(rgb)
    veg = ((hue > 52) & (hue < 135) & (sat > 0.28)) | ((lum < 0.13) & (gg > b * 1.03))
    veg = veg.astype(np.float32) * (Y > 0.545)
    veg = minf(maxf(veg, 5), 5)
    veg = maxf(minf(veg, 3), 3)
    veg = np.clip(blur(veg, 1.0), 0, 1)
    water *= 1 - veg

    sway = veg * (0.3 + 0.7 * np.clip((0.85 - Y) / 0.27, 0, 1))
    # sun glints: bright specks on the river
    glints = water * np.clip((lum - blur(lum, 2.0)) * 6.0 + 0.25, 0, 1)
    return depth, water, glints, veg, sway


# ---------------------------------------------------------------------------- paths

def path(points, depth_fn, plate_crop):
    """Polyline in source coords -> plate coords (x right, y down) with depth (m) per vertex."""
    x0, y0, x1, y1 = plate_crop
    out = []
    for x, y in points:
        out.append([round((x - x0) / (x1 - x0), 5), round((y - y0) / (y1 - y0), 5), round(float(depth_fn(x, y)), 1)])
    return out


def evening_paths():
    c = NIGHT
    K = c['height'] * c['fpx'] / 2000.0
    Kd = (c['height'] - 10.0) * c['fpx'] / 2000.0
    yh = c['horizon']
    river = lambda x, y: K / max(y - yh, 1e-3)
    road = lambda x, y: Kd / max(y - yh, 1e-3)
    bank = lambda x: float(interp(c['bank'], x))
    quay = [(x, bank(x) - 0.007) for x in np.linspace(-0.05, 1.05, 12)]
    upper = [(x, bank(x) - 0.019) for x in np.linspace(-0.05, 1.05, 12)]
    crop = c['crop']
    return {
        'deck': path(c['deck'], road, crop),
        'quay': path(quay, lambda x, y: K / (bank(x) - yh), crop),
        'upper': path(upper, lambda x, y: K / (bank(x) - yh), crop),
        'river': [
            path([(x, bank(x) + 0.03) for x in np.linspace(-0.15, 1.15, 12)], river, crop),
            path([(x, bank(x) + 0.12) for x in np.linspace(-0.2, 1.2, 12)], river, crop),
        ],
        'sky': path([(-0.08, 0.11), (0.5, 0.075), (1.08, 0.045)], lambda x, y: 9000.0, crop),
    }


def day_paths():
    c = DAY
    H = 2162.0
    K = c['height'] * c['fpx'] / H
    Kd = (c['height'] - 10.0) * c['fpx'] / H
    yh = c['horizon']
    crop = c['crop']
    river = lambda x, y: K / max(y - yh, 1e-3)
    road = lambda x, y: Kd / max(y - yh, 1e-3)
    bank = lambda x: float(interp(c['bank'], x))
    tram = [(0.0, 0.452), (0.05, 0.4715), (0.1, 0.481), (0.17, 0.4985), (0.25, 0.508), (0.315, 0.514), (0.45, 0.522), (0.6, 0.53), (0.72, 0.5355), (0.85, 0.5375), (1.0, 0.539), (1.05, 0.5395)]
    return {
        'deck': path(c['deck'], road, crop),
        'tram': path(tram, lambda x, y: K / (bank(min(max(x, 0.0), 1.0)) - yh), crop),
        'upper': path([(x, y + 0.0035) for x, y in tram], lambda x, y: K / (bank(min(max(x, 0.0), 1.0)) - yh), crop),
        'quay': path([(0.72, 0.5505), (0.85, 0.551), (1.0, 0.5515), (1.05, 0.552)], lambda x, y: K / (bank(min(x, 1.0)) - yh) - 8, crop),
        'river': [
            path([(-0.1, 0.49), (0.1, 0.5), (0.3, 0.522), (0.5, 0.545), (0.7, 0.567), (0.9, 0.585), (1.1, 0.6)], river, crop),
            path([(-0.1, 0.505), (0.1, 0.515), (0.3, 0.535), (0.45, 0.56), (0.6, 0.59), (0.75, 0.62), (0.9, 0.645), (1.1, 0.67)], river, crop),
        ],
        'sky': path([(1.06, 0.07), (0.5, 0.1), (-0.06, 0.13)], lambda x, y: 9000.0, crop),
        'birds': path([(-0.06, 0.36), (0.3, 0.33), (0.7, 0.35), (1.06, 0.31)], lambda x, y: 140.0, crop),
    }


# ---------------------------------------------------------------------------- output

def encode_data(depth, water, lights, fore, sway):
    """RGB data map. Background depth in R; G and B are shared between the two layers:
    G = river (background) or sway (foreground); B = 0.45 * lights (background) or 0.5 + 0.5 * cover."""
    r = np.sqrt(10.0 / np.clip(depth, 10.0, None))
    r = np.where(depth >= 5e4, 0.0, r)
    r = blur(r, 0.8)
    fg = np.clip(fore, 0, 1)
    gch = fg * sway + (1 - fg) * water
    bch = np.where(fg > 0.02, 0.5 + 0.5 * fg, 0.45 * np.clip(lights, 0, 1))
    rgb = np.stack([r, gch, bch], axis=-1)
    return Image.fromarray(np.round(np.clip(rgb, 0, 1) * 255).astype(np.uint8), mode='RGB')


def push_pull(img, known):
    """Fill unknown pixels from their surroundings (multi-scale average). img (h,w,3), known (h,w)."""
    levels = [(img * known[..., None], known.copy())]
    while min(levels[-1][1].shape) > 2:
        c, k = levels[-1]
        h, w = k.shape
        h2, w2 = h - h % 2, w - w % 2
        cs = c[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2, 3).sum((1, 3))
        ks = k[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2).sum((1, 3))
        levels.append((cs / 4, np.minimum(ks / 4 * 2, 1.0)))
    out = levels[-1][0] / np.maximum(levels[-1][1], 1e-6)[..., None]
    for c, k in reversed(levels[:-1]):
        h, w = k.shape
        up = np.repeat(np.repeat(out, 2, 0), 2, 1)
        up = np.pad(up, ((0, max(0, h - up.shape[0])), (0, max(0, w - up.shape[1])), (0, 0)), mode='edge')[:h, :w]
        for ch in range(3):
            up[..., ch] = blur(up[..., ch], 1.0)
        mean = c / np.maximum(k, 1e-6)[..., None]
        out = mean * k[..., None] + up * (1 - k[..., None])
    return out


def fill_layer(plate, fore, size):
    """The background behind the foreground layer, guessed from its surroundings. Behind the trees
    there is mostly river and embankment, which run across the picture, so each row is bridged
    from its nearest visible pixels left and right, then softened. Only thin slivers of it ever
    show (where the foreground slides aside), so a soft fill reads as depth of field."""
    w, h = size
    rgb = np.asarray(plate.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255.0
    hole = maxf(np.clip(fore, 0, 1), 7)
    known = hole < 0.2
    out = rgb.copy()
    xs = np.arange(w)
    for y in range(h):
        k = known[y]
        if k.all() or not k.any():
            continue
        for c in range(3):
            out[y, ~k, c] = np.interp(xs[~k], xs[k], rgb[y, k, c])
    # rows with nothing visible, and vertical smoothness: blend with a multi-scale fill
    pp = push_pull(rgb, known.astype(np.float32))
    none = ~known.any(axis=1)
    out[none] = pp[none]
    soft = np.stack([blur(out[..., c], 2.5) for c in range(3)], -1)
    m = np.clip(blur((~known).astype(np.float32), 2.0) * 1.5, 0, 1)[..., None]
    out = rgb * (1 - m) + soft * m
    return Image.fromarray(np.round(np.clip(out, 0, 1) * 255).astype(np.uint8), mode='RGB')


def qa_views(name, plate, depth, water, lights, fore, sway, fill):
    os.makedirs(QA, exist_ok=True)
    w, h = depth.shape[1], depth.shape[0]
    small = np.asarray(plate.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255
    inv = np.sqrt(10.0 / np.clip(depth, 10.0, None))
    t = np.clip(np.where(depth >= 5e4, 0, inv), 0, 1)
    turbo = np.stack([np.clip(1.5 - abs(4 * t - 3), 0, 1), np.clip(1.5 - abs(4 * t - 2), 0, 1), np.clip(1.5 - abs(4 * t - 1), 0, 1)], -1)
    Image.fromarray((turbo * 255).astype(np.uint8)).save(os.path.join(QA, f'{name}_depth.png'))
    over = small * 0.45 + np.stack([fore * (0.4 + 0.6 * sway), water, lights], -1) * 0.75
    Image.fromarray((np.clip(over, 0, 1) * 255).astype(np.uint8)).save(os.path.join(QA, f'{name}_masks.png'))
    fill.save(os.path.join(QA, f'{name}_fill.png'))


def process(state, cfg, maps_fn, paths_fn, fix=None):
    plate, src_size = load_plate(cfg['file'], cfg['crop'])
    if fix:
        plate = fix(plate, src_size)
    pw, ph = plate.size
    dh = round(DATA_W * ph / pw)
    g = Grid(cfg['crop'], DATA_W, dh)
    rgb = np.asarray(plate.resize((DATA_W, dh), Image.LANCZOS), dtype=np.float32) / 255.0
    depth, water, lights, fore, sway = maps_fn(rgb, g)
    fill = fill_layer(plate, fore, (DATA_W, dh))
    os.makedirs(TEX, exist_ok=True)
    plate.save(os.path.join(TEX, f'window_{state}.webp'), 'WEBP', quality=84, method=6)
    lo = plate.resize((LO_W, round(LO_W * ph / pw)), Image.LANCZOS)
    lo.save(os.path.join(TEX, f'window_{state}_lo.webp'), 'WEBP', quality=80, method=6)
    encode_data(depth, water, lights, fore, sway).save(os.path.join(TEX, f'window_{state}_data.png'), optimize=True)
    fill.save(os.path.join(TEX, f'window_{state}_fill.webp'), 'WEBP', quality=82, method=6)
    qa_views(state, plate, depth, water, lights, fore, sway, fill)
    x0, y0, x1, y1 = cfg['crop']
    W, H = src_size
    crop_w, crop_h = (x1 - x0) * W, (y1 - y0) * H
    info = {
        'size': [pw, ph],
        # focal length in plate widths / heights: a thing L metres wide at depth d spans L*fx/d
        'fx': round(cfg['fpx'] / crop_w, 5),
        'fy': round(cfg['fpx'] / crop_h, 5),
        'horizon': round((cfg['horizon'] - y0) / (y1 - y0), 5),
        # the foreground layer (trees and roofs below the terrace) sits at one distance
        'foreground': cfg['foreground'],
        'paths': paths_fn(),
    }
    print(f'[window] {state}: plate {pw}x{ph}, data {DATA_W}x{dh}, '
          f'{os.path.getsize(os.path.join(TEX, f"window_{state}.webp")) / 1e6:.2f} MB')
    return info


def fix_day(plate, src_size):
    return paint_over(plate, DAY['crop'], src_size, DAY['tram_patch'], (0.044, 0.0))


def main():
    out = {
        'credits': {
            'evening': {'title': 'Széchenyi Chain Bridge in Budapest at night', 'author': 'Wilfredor', 'license': 'CC0 1.0',
                        'url': 'https://commons.wikimedia.org/wiki/File:Sz%C3%A9chenyi_Chain_Bridge_in_Budapest_at_night.jpg'},
            'day': {'title': 'View from Buda Castle', 'author': 'Yair-haklai', 'license': 'CC BY-SA 4.0',
                    'url': 'https://commons.wikimedia.org/wiki/File:View_from_Buda_Castle.jpg',
                    'changes': 'cropped, a parked tram painted out'},
        },
        'evening': process('evening', NIGHT, evening_maps, evening_paths),
        'day': process('day', DAY, day_maps, day_paths, fix_day),
    }
    path_json = os.path.join(ROOT, 'public', 'models', 'window.json')
    with open(path_json, 'w') as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False)
    print(f'[window] wrote {path_json}')


if __name__ == '__main__':
    main()
