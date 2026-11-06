"""Generated artwork for the room: a framed print and three record sleeves.
Plain Pillow drawings in the site's palette, so every image in the scene is original.
"""

from __future__ import annotations

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

PAPER = (244, 240, 232)
NAVY = (29, 45, 61)
FJORD = (65, 97, 128)
SKY = (148, 188, 227)
SAGE = (169, 184, 164)
OAK = (201, 162, 124)
LINGON = (200, 67, 43)
SAND = (217, 201, 174)


def _font(size: int):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def _grain(img: Image.Image, amount: int = 10, seed: int = 3) -> Image.Image:
    rnd = random.Random(seed)
    noise = Image.effect_noise(img.size, amount).convert('L')
    noise = noise.point(lambda v: 128 + (v - 128) // 2)
    base = img.convert('RGB')
    return Image.blend(base, Image.merge('RGB', (noise, noise, noise)), 0.06 + rnd.random() * 0.0)


def danube_print(path: str, w: int = 900, h: int = 1200) -> str:
    """'Duna' — low sun, layered hills, a river line. Risograph-like flat shapes."""
    img = Image.new('RGB', (w, h), PAPER)
    d = ImageDraw.Draw(img)
    # sun
    r = int(w * 0.24)
    cx, cy = int(w * 0.58), int(h * 0.42)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=OAK)
    # hills (back to front)
    def hill(y0, amp, freq, phase, color):
        pts = [(0, h)]
        for x in range(0, w + 1, 6):
            y = y0 + amp * math.sin(x / w * math.pi * freq + phase) + amp * 0.35 * math.sin(x / w * math.pi * freq * 2.7 + phase * 1.7)
            pts.append((x, int(y)))
        pts.append((w, h))
        d.polygon(pts, fill=color)
    hill(h * 0.55, 34, 1.4, 0.6, SAGE)
    hill(h * 0.62, 26, 2.2, 2.1, FJORD)
    # river
    d.rectangle((0, int(h * 0.7), w, int(h * 0.78)), fill=SKY)
    for i in range(7):
        y = int(h * 0.705 + i * h * 0.011)
        x0 = int(w * (0.08 + 0.11 * (i % 3)))
        d.line((x0, y, x0 + int(w * 0.18), y), fill=PAPER, width=3)
    hill(h * 0.8, 10, 1.0, 1.3, NAVY)
    # caption
    f = _font(int(w * 0.03))
    d.text((int(w * 0.08), int(h * 0.9)), 'DUNA  ·  47.50° N  19.04° E', fill=NAVY, font=f)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    img.save(path, quality=92)
    return path


def sleeve(path: str, kind: str, s: int = 600) -> str:
    img = Image.new('RGB', (s, s), PAPER)
    d = ImageDraw.Draw(img)
    if kind == 'a':
        img.paste(NAVY, (0, 0, s, s))
        for i in range(9, 0, -1):
            rr = int(s * 0.05 * i)
            col = SKY if i % 2 else NAVY
            d.ellipse((s // 2 - rr, s // 2 - rr, s // 2 + rr, s // 2 + rr), outline=col, width=6)
    elif kind == 'b':
        img.paste(SAND, (0, 0, s, s))
        for i in range(8):
            col = (OAK, SAGE, PAPER, FJORD)[i % 4]
            d.rectangle((0, int(s * i / 8), s, int(s * (i + 0.6) / 8)), fill=col)
        d.ellipse((int(s * 0.62), int(s * 0.12), int(s * 0.88), int(s * 0.38)), fill=LINGON)
    else:
        img.paste(PAPER, (0, 0, s, s))
        for gy in range(6):
            for gx in range(6):
                rr = 14 + (gx + gy) % 3 * 6
                x, y = int(s * (gx + 0.5) / 6), int(s * (gy + 0.5) / 6)
                d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=LINGON if (gx * gy) % 4 == 1 else NAVY)
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    img.save(path, quality=92)
    return path


def make_all(out_dir: str) -> dict:
    os.makedirs(out_dir, exist_ok=True)
    return {
        'print': danube_print(os.path.join(out_dir, 'print_duna.jpg')),
        'sleeve_a': sleeve(os.path.join(out_dir, 'sleeve_a.jpg'), 'a'),
        'sleeve_b': sleeve(os.path.join(out_dir, 'sleeve_b.jpg'), 'b'),
        'sleeve_c': sleeve(os.path.join(out_dir, 'sleeve_c.jpg'), 'c'),
    }
