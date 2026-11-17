"""Paper things for the side-quest board, drawn with Pillow: index cards, sticky notes, a boarding
pass, two photo prints, a score pad. Everything on them is original; the two photographs and the
child's drawing come from blender/assets/gen (made with an image model for this room).
"""

from __future__ import annotations

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
GEN = os.path.join(ROOT, 'blender', 'assets', 'gen')

PAPER = (248, 245, 238)
INK = (29, 29, 31)
NAVY = (29, 45, 61)
FJORD = (65, 97, 128)
SAGE = (169, 184, 164)
OAK = (201, 162, 124)
LINGON = (200, 67, 43)
SUN = (244, 200, 74)

_INTER = '/usr/share/fonts/opentype/inter'
_CAVEAT = os.path.join(ROOT, 'node_modules', '@fontsource', 'caveat', 'files')
_FALLBACK = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def font(size: int, weight: str = 'Bold') -> ImageFont.FreeTypeFont:
    for p in (os.path.join(_INTER, f'Inter-{weight}.otf'), _FALLBACK):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def hand(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    p = os.path.join(_CAVEAT, f'caveat-latin-{700 if bold else 500}-normal.woff')
    if os.path.exists(p):
        return ImageFont.truetype(p, size)
    return font(int(size * 0.72), 'Medium')


def _paper(size, color=PAPER, seed=1) -> Image.Image:
    """A sheet with a little tooth and uneven light, so it does not read as a flat fill."""
    w, h = size
    img = Image.new('RGB', size, color)
    noise = Image.effect_noise(size, 14).convert('L').filter(ImageFilter.GaussianBlur(0.6))
    noise = noise.point(lambda v: 128 + (v - 128) // 3)
    img = Image.blend(img, Image.merge('RGB', (noise, noise, noise)), 0.05)
    # a soft gradient, as if the sheet curls away from the light
    grad = Image.linear_gradient('L').resize(size).rotate(random.Random(seed).choice((0, 90, 180)), expand=False)
    shade = Image.merge('RGB', (grad, grad, grad))
    return Image.blend(img, Image.composite(img, shade, Image.new('L', size, 236)), 0.5)


def _lines(d, xy, lines, f, fill=INK, gap=1.12):
    x, y = xy
    for line in lines:
        d.text((x, y), line, font=f, fill=fill)
        y += int(f.size * gap)
    return y


def _save(img: Image.Image, path: str) -> str:
    img.convert('RGB').save(path, quality=93)
    return path


def banner(path: str) -> str:
    img = _paper((1360, 300), (250, 247, 240), 2)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 1359, 299), outline=(214, 208, 196), width=4)
    d.text((70, 44), 'SIDE QUESTS', font=font(150, 'ExtraBold'), fill=NAVY)
    d.text((80, 204), 'none of these were on the roadmap', font=hand(74), fill=LINGON)
    return _save(img, path)


def maths(path: str) -> str:
    """Squared paper, nine sticks, one question."""
    s = 640
    img = _paper((s, s), (250, 249, 244), 3)
    d = ImageDraw.Draw(img)
    for i in range(0, s, 32):
        d.line((i, 0, i, s), fill=(205, 219, 232), width=2)
        d.line((0, i, s, i), fill=(205, 219, 232), width=2)
    # a triangle of four small triangles: nine sticks
    ax, ay, side = 320, 96, 150
    hgt = side * math.sin(math.radians(60))
    pts = {
        'a': (ax, ay), 'b': (ax - side / 2, ay + hgt), 'c': (ax + side / 2, ay + hgt),
        'd': (ax - side, ay + 2 * hgt), 'e': (ax, ay + 2 * hgt), 'f': (ax + side, ay + 2 * hgt),
    }
    sticks = ['ab', 'ac', 'bc', 'bd', 'be', 'ce', 'cf', 'de', 'ef']
    for st in sticks:
        (x0, y0), (x1, y1) = pts[st[0]], pts[st[1]]
        # leave the heads apart, like real matches
        dx, dy = x1 - x0, y1 - y0
        n = math.hypot(dx, dy)
        ux, uy = dx / n, dy / n
        p0 = (x0 + ux * 12, y0 + uy * 12)
        p1 = (x1 - ux * 12, y1 - uy * 12)
        d.line((*p0, *p1), fill=(214, 176, 120), width=12)
        d.ellipse((p1[0] - 10, p1[1] - 10, p1[0] + 10, p1[1] + 10), fill=LINGON)
    _lines(d, (40, 396), ['9 sticks.', 'How many triangles?'], hand(76), NAVY, 0.98)
    d.text((44, 556), 'count again.', font=hand(56, False), fill=LINGON)
    return _save(img, path)


def score(path: str) -> str:
    w, h = 480, 720
    img = _paper((w, h), (252, 250, 245), 4)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, w, 96), fill=NAVY)
    d.text((28, 20), 'CARD NIGHT', font=font(54, 'ExtraBold'), fill=PAPER)
    cols = [40, 190, 330]
    for x in cols[1:]:
        d.line((x - 18, 110, x - 18, 560), fill=(196, 190, 178), width=3)
    for i, name in enumerate(('Dad', 'Kids', 'House')):
        d.text((cols[i], 112), name, font=hand(60), fill=INK)
    d.line((24, 182, w - 24, 182), fill=(196, 190, 178), width=3)
    rnd = random.Random(5)

    def tally(x, y, n):
        for k in range(n):
            if k % 5 == 4:
                d.line((x - 4, y + 34, x + 46, y + 6), fill=INK, width=4)
                x += 62
            else:
                jit = rnd.randint(-2, 2)
                d.line((x + (k % 5) * 12, y + jit, x + (k % 5) * 12 + 2, y + 40), fill=INK, width=4)
    for i, n in enumerate((7, 13, 12)):
        for row in range((n + 9) // 10):
            tally(cols[i], 204 + row * 60, min(10, n - row * 10))
    d.text((40, 372), '7', font=hand(96), fill=(150, 150, 150))
    d.text((190, 372), '13', font=hand(96), fill=LINGON)
    d.text((330, 372), '12', font=hand(96), fill=INK)
    d.ellipse((176, 380, 286, 470), outline=LINGON, width=5)
    _lines(d, (30, 574), ['new rule: Dad keeps', 'score, not points'], hand(52, False), FJORD, 1.0)
    return _save(img, path)


def sticky(path: str, color, lines, seed=6, size=420, ink=INK, big=64) -> str:
    img = _paper((size, size), color, seed)
    d = ImageDraw.Draw(img)
    # the gummed strip at the top is a touch darker
    d.rectangle((0, 0, size, 46), fill=tuple(int(c * 0.94) for c in color))
    y = 70
    for i, line in enumerate(lines):
        f = hand(big if i == 0 else int(big * 0.84), i == 0)
        d.text((30, y), line, font=f, fill=ink if i == 0 else (60, 60, 64))
        y += int(f.size * 1.02)
    return _save(img, path)


def boarding(path: str) -> str:
    w, h = 800, 340
    img = _paper((w, h), (252, 251, 247), 7)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, w, 70), fill=FJORD)
    d.text((26, 14), 'FAMILY AIR', font=font(40, 'ExtraBold'), fill=PAPER)
    d.text((w - 250, 22), 'BOARDING PASS', font=font(24, 'SemiBold'), fill=PAPER)
    d.text((28, 92), 'BUD', font=font(92, 'ExtraBold'), fill=NAVY)
    d.line((250, 146, 330, 146), fill=NAVY, width=6)
    d.polygon([(330, 130), (360, 146), (330, 162)], fill=NAVY)
    _lines(d, (376, 88), ['anywhere with', 'a playground'], hand(54), LINGON, 0.9)
    d.text((28, 222), 'SEATS', font=font(22, 'SemiBold'), fill=(120, 120, 124))
    d.text((28, 250), 'together, please', font=font(40, 'Bold'), fill=INK)
    d.text((440, 222), 'SNACKS', font=font(22, 'SemiBold'), fill=(120, 120, 124))
    d.text((440, 250), 'yes', font=font(40, 'Bold'), fill=INK)
    # tear-off stub with a barcode
    for y in range(0, h, 16):
        d.line((640, y, 640, y + 8), fill=(180, 176, 168), width=3)
    rnd = random.Random(8)
    x = 664
    while x < w - 26:
        bw = rnd.choice((3, 3, 5, 8))
        d.rectangle((x, 96, x + bw, 300), fill=INK)
        x += bw + rnd.choice((3, 4, 6))
    return _save(img, path)


def games(path: str) -> str:
    s = 560
    img = _paper((s, s), (252, 250, 244), 9)
    d = ImageDraw.Draw(img)
    cols = [LINGON, SUN, FJORD]
    for i, ch in enumerate('ABC'):
        x = 44 + i * 164
        d.rounded_rectangle((x, 40, x + 140, 180), 22, fill=cols[i])
        f = font(108, 'ExtraBold')
        tw = d.textlength(ch, font=f)
        d.text((x + 70 - tw / 2, 44), ch, font=f, fill=PAPER if i != 1 else INK)
    # a traffic light and a zebra crossing
    d.rounded_rectangle((60, 220, 150, 440), 26, fill=(42, 44, 48))
    for k, c in enumerate(((214, 69, 61), SUN, (74, 170, 104))):
        d.ellipse((78, 236 + k * 66, 132, 290 + k * 66), fill=c)
    for k in range(5):
        d.rectangle((196 + k * 66, 336, 236 + k * 66, 440), fill=(42, 44, 48))
    _lines(d, (190, 204), ['home-made', 'learning games'], hand(58), NAVY, 0.92)
    d.text((46, 468), 'toughest user panel I know', font=hand(50, False), fill=LINGON)
    return _save(img, path)


def snow(path: str) -> str:
    s = 520
    img = Image.new('RGB', (s, s), (214, 229, 242))
    d = ImageDraw.Draw(img)
    d.polygon([(0, s), (150, 250), (250, 360), (360, 200), (s, 400), (s, s)], fill=(248, 250, 252))
    d.polygon([(360, 200), (330, 250), (372, 240), (396, 262)], fill=(214, 229, 242))
    # one snowflake
    cx, cy, r = 120, 110, 70
    for k in range(6):
        a = math.radians(60 * k)
        x1, y1 = cx + r * math.cos(a), cy + r * math.sin(a)
        d.line((cx, cy, x1, y1), fill=FJORD, width=9)
        for sgn in (-1, 1):
            b = a + sgn * math.radians(40)
            mx, my = cx + r * 0.6 * math.cos(a), cy + r * 0.6 * math.sin(a)
            d.line((mx, my, mx + 26 * math.cos(b), my + 26 * math.sin(b)), fill=FJORD, width=7)
    d.text((224, 36), 'SNOW TRIP', font=font(50, 'ExtraBold'), fill=NAVY)
    _lines(d, (226, 100), ['packing list', 'v7 final_final'], hand(50), LINGON, 0.92)
    img = img.filter(ImageFilter.GaussianBlur(0.4))
    return _save(img, path)


def photo_print(path: str, src: str, caption: str, w=760) -> str:
    """A photo print with a white border and a handwritten line underneath."""
    ph = Image.open(src).convert('RGB')
    border = 34
    pw = w - 2 * border
    phh = round(pw * ph.height / ph.width)
    img = _paper((w, phh + border + 118), (252, 251, 248), 11)
    img.paste(ph.resize((pw, phh), Image.LANCZOS), (border, border))
    d = ImageDraw.Draw(img)
    d.text((border + 6, phh + border + 16), caption, font=hand(64, False), fill=(50, 50, 56))
    return _save(img, path)


def ribbon(path: str) -> str:
    """A medal ribbon: red, white, green."""
    img = Image.new('RGB', (96, 256), (245, 243, 238))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 31, 255), fill=(196, 52, 46))
    d.rectangle((64, 0, 95, 255), fill=(62, 128, 84))
    for y in range(0, 256, 4):
        d.line((0, y, 95, y), fill=(0, 0, 0), width=1)
    img = Image.blend(Image.new('RGB', (96, 256), (245, 243, 238)).copy(), img, 0.92)
    return _save(img, path)


def racket(path: str) -> str:
    """The face of a padel racket: carbon weave, the hole pattern, a coloured rim."""
    w, h = 520, 620
    img = Image.new('RGB', (w, h), (30, 32, 36))
    d = ImageDraw.Draw(img)
    for i in range(-h, w, 9):
        d.line((i, 0, i + h, h), fill=(38, 40, 45), width=3)
    cx, cy = w / 2, h / 2
    for gy in range(-7, 8):
        for gx in range(-6, 7):
            x = cx + gx * 34 + (17 if gy % 2 else 0)
            y = cy + gy * 30
            if ((x - cx) / (w * 0.4)) ** 2 + ((y - cy) / (h * 0.4)) ** 2 < 1:
                d.ellipse((x - 9, y - 9, x + 9, y + 9), fill=(168, 160, 148))
    d.ellipse((6, 6, w - 6, h - 6), outline=LINGON, width=16)
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    return _save(img, path)


def bib(path: str) -> str:
    """A race number, for the wall by the shoes."""
    w, h = 640, 480
    img = _paper((w, h), (252, 251, 247), 13)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, w, 96), fill=LINGON)
    d.text((24, 22), 'ROTTERDAM  ·  SPRING 2027', font=font(34, 'ExtraBold'), fill=PAPER)
    f = font(230, 'ExtraBold')
    tw = d.textlength('255', font=f)
    d.text(((w - tw) / 2, 92), '255', font=f, fill=NAVY)
    d.text((26, 392), 'target, not bib number', font=hand(56, False), fill=LINGON)
    for x, y in ((22, 114), (w - 46, 114), (22, h - 44), (w - 46, h - 44)):
        d.ellipse((x, y, x + 22, y + 22), fill=(190, 186, 178))
    return _save(img, path)


def make_all(out_dir: str) -> dict:
    os.makedirs(out_dir, exist_ok=True)
    p = lambda n: os.path.join(out_dir, n)
    g = lambda n: os.path.join(GEN, n)
    out = {
        'banner': banner(p('q_banner.jpg')),
        'maths': maths(p('q_maths.jpg')),
        'score': score(p('q_score.jpg')),
        'oven': sticky(p('q_oven.jpg'), (250, 226, 122), ['Oven door glass:', 'FIXED', 'screws left over: 2', "(it's fine)"], 6),
        'policy': sticky(p('q_policy.jpg'), (246, 190, 196), ['Side-quest policy', '1. It must ship.', '2. See rule 1.'], 12),
        'travel': boarding(p('q_travel.jpg')),
        'games': games(p('q_games.jpg')),
        'snow': snow(p('q_snow.jpg')),
        'ribbon': ribbon(p('ribbon.jpg')),
        'racket': racket(p('racket.jpg')),
        'bib': bib(p('bib.jpg')),
    }
    if os.path.exists(g('dwarf.jpg')):
        out['dwarf'] = photo_print(p('q_dwarf.jpg'), g('dwarf.jpg'), 'Wroclaw. We counted dwarfs.')
    if os.path.exists(g('padel.jpg')):
        out['padel'] = photo_print(p('q_padel.jpg'), g('padel.jpg'), 'Padel. The glass is in play.')
    for key in ('crayon', 'dragon', 'rug', 'knit', 'boucle'):
        if os.path.exists(g(f'{key}.jpg')):
            out[key] = g(f'{key}.jpg')
    return out
