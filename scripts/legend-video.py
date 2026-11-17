#!/usr/bin/env python3
"""Assemble the intro film, "The Legend of the AI Program Manager".

  python3 scripts/legend-video.py            ->  public/media/legend.mp4 (+ poster, captions)

Sources (media/legend/): eight stills made with an image model, the narration (a preset
text-to-speech voice) and its word timings (forced alignment). The ninth shot is the studio
itself: media/legend/09_studio.jpg if present, else the page's evening poster.

Everything else is made here: slow camera moves over the stills, cross-dissolves, captions set
from the word timings, a vignette, and a small score (a drone, four chords, a plucked
string) synthesised with numpy. Frames are piped straight into FFmpeg.

Needs: python3 with numpy and Pillow, ffmpeg.
"""

from __future__ import annotations

import json
import math
import os
import re
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'media', 'legend')
OUT = os.path.join(ROOT, 'public', 'media')
TMP = os.path.join(ROOT, 'renders', 'legend')

W, H, FPS = 1600, 900, 24
LEAD = 2.2            # seconds of picture before the first word
TAIL = 3.8            # seconds after the last word
XFADE = 0.9

# shot, the narration time (s) at which it takes over, camera move (zoom from, zoom to, pan x, pan y)
SHOTS = [
    ('01_tome.jpg', -LEAD, (1.10, 1.02, 0.25, -0.1)),
    ('02_scriptorium.jpg', 3.45, (1.03, 1.12, -0.3, 0.1)),
    ('03_traveller.jpg', 14.35, (1.12, 1.03, 0.2, -0.3)),
    ('04_council.jpg', 23.3, (1.04, 1.12, 0.35, 0.0)),
    ('05_mountain.jpg', 30.0, (1.12, 1.04, -0.2, 0.3)),
    ('06_hall.jpg', 35.9, (1.03, 1.10, 0.1, -0.2)),
    ('07_dragon.jpg', 39.3, (1.02, 1.12, 0.3, -0.1)),
    ('08_runner.jpg', 43.45, (1.12, 1.03, -0.15, 0.1)),
    ('09_studio.jpg', 52.6, (1.08, 1.0, -0.2, 0.0)),
]

# captions, in order; each takes as many words of the narration as it has
CAPTIONS = [
    'Gather round, travellers… and mind the cables.',
    'Long ago, in the year twenty twenty-five,',
    'the kingdom of Finance was ruled by spreadsheets.',
    'Mighty ones! With tabs beyond counting.',
    'Then, from Budapest, came a program manager.',
    'He carried no sword. He carried… a roadmap.',
    'And he asked what no one had dared to ask:',
    'could this meeting… have been a prompt?',
    'A thousand use cases rose before him.',
    'He prioritised every single one.',
    'He trained two and a half thousand brave souls…',
    'and taught the dragon of Risk to love a good governance framework.',
    'And when the work was done, did he rest?',
    'No! He ran.',
    'Thirty kilometres. At night. On purpose.',
    'His study stands by the Danube to this day.',
    'So sit down, traveller. Open a dossier.',
    'The legend… is open to new quests.',
]


def cue_spans(words):
    """(first word, last word, text) for each caption, checked against the aligned words."""
    out, i = [], 0
    for text in CAPTIONS:
        said = re.sub(r'[^a-z ]', '', text.lower().replace('-', ' ').replace('…', ' ')).split()
        got = [w[0] for w in words[i:i + len(said)]]
        if got != said:
            raise SystemExit(f'[legend] caption does not match the narration: {text!r} vs {" ".join(got)!r}')
        out.append((i, i + len(said) - 1, text))
        i += len(said)
    if i != len(words):
        raise SystemExit(f'[legend] {len(words) - i} words of narration have no caption')
    return out


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for p in (f'/usr/share/fonts/truetype/crosextra/{name}.ttf', f'/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def load_words():
    with open(os.path.join(SRC, 'words.json')) as fh:
        return json.load(fh)


# ---------------------------------------------------------------------------- the score

def pluck(freq: float, dur: float, sr: int, rng) -> np.ndarray:
    """A plucked string (Karplus-Strong), computed a period at a time."""
    n = max(2, int(sr / freq))
    buf = rng.uniform(-1, 1, n)
    buf = np.convolve(buf, np.ones(5) / 5, mode='same')     # a softer pluck
    out = np.empty(int(dur * sr))
    pos = 0
    while pos < len(out):
        take = min(n, len(out) - pos)
        out[pos:pos + take] = buf[:take]
        buf = 0.498 * (buf + np.roll(buf, 1))
        pos += take
    return out * np.exp(-np.linspace(0, 3.2, len(out)))


def score(total: float, sr: int = 44100) -> np.ndarray:
    rng = np.random.default_rng(7)
    n = int(total * sr)
    t = np.arange(n) / sr
    mix = np.zeros((n, 2))
    # D minor, VI, III, VII: eight seconds each
    chords = [(146.83, 174.61, 220.0), (116.54, 146.83, 174.61), (87.31, 130.81, 174.61), (130.81, 164.81, 196.0)]
    bar = 8.0
    for ci in range(int(total / bar) + 1):
        tones = chords[ci % len(chords)]
        t0 = ci * bar
        env = np.clip((t - t0 + 1.2) / 2.4, 0, 1) * np.clip((t0 + bar + 1.2 - t) / 2.4, 0, 1)
        env = env * env * (3 - 2 * env)
        for j, f in enumerate(tones):
            for det, pan in ((0.997, 0.3), (1.003, 0.7)):
                ph = 2 * math.pi * f * det * t + j
                tone = np.sin(ph) + 0.28 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)
                slow = 0.75 + 0.25 * np.sin(2 * math.pi * 0.07 * t + j * 1.7 + det * 40)
                mix[:, 0] += tone * env * slow * (1 - pan) * 0.05
                mix[:, 1] += tone * env * slow * pan * 0.05
        # a plucked figure over the chord, sparse
        beat = bar / 8
        pattern = [0, None, 1, 2, None, 1, None, 2]
        for k, idx in enumerate(pattern):
            if idx is None or rng.random() < 0.12:
                continue
            start = t0 + k * beat + rng.uniform(-0.01, 0.01)
            if start < 0.6 or start > total - 2.5:
                continue
            note = pluck(tones[idx] * 2, 2.2, sr, rng) * 0.2
            a = int(start * sr)
            b = min(n, a + len(note))
            pan = 0.35 + 0.3 * rng.random()
            mix[a:b, 0] += note[:b - a] * (1 - pan)
            mix[a:b, 1] += note[:b - a] * pan
    drone = (np.sin(2 * math.pi * 73.42 * t) + 0.5 * np.sin(2 * math.pi * 110.0 * t)) * 0.035
    mix += drone[:, None]
    # room: two short echoes
    for delay, gain in ((0.19, 0.22), (0.37, 0.12)):
        d = int(delay * sr)
        mix[d:] += mix[:-d] * gain
    fade = np.clip(t / 1.6, 0, 1) * np.clip((total - t) / 3.0, 0, 1)
    mix *= fade[:, None]
    mix /= max(1e-6, np.abs(mix).max()) / 0.6
    return mix


def write_wav(path: str, data: np.ndarray, sr: int = 44100) -> None:
    pcm = (np.clip(data, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(pcm.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


# ---------------------------------------------------------------------------- the picture

def cover(im: Image.Image) -> Image.Image:
    """Scale and crop a still to the frame, with room to move."""
    s = max(W * 1.16 / im.width, H * 1.16 / im.height)
    return im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)


def frame_of(im: Image.Image, move, u: float) -> Image.Image:
    """The camera on a still at progress u (0..1): zoom and drift, sub-pixel smooth."""
    z0, z1, px, py = move
    e = u * u * (3 - 2 * u) * 0.35 + u * 0.65
    zoom = z0 + (z1 - z0) * e
    vw, vh = W * 1.16 / zoom, H * 1.16 / zoom
    max_x, max_y = (im.width - vw) / 2, (im.height - vh) / 2
    cx = im.width / 2 + px * max_x * (2 * e - 1)
    cy = im.height / 2 + py * max_y * (2 * e - 1)
    sx, sy = vw / W, vh / H
    return im.transform((W, H), Image.AFFINE, (sx, 0, cx - vw / 2, 0, sy, cy - vh / 2), resample=Image.BICUBIC)


def vignette() -> Image.Image:
    y, x = np.mgrid[0:H, 0:W]
    d = np.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2))
    v = 1 - 0.42 * np.clip(d - 0.35, 0, 1) ** 1.6
    # a darker foot so the captions sit on something
    v *= 1 - 0.38 * np.clip((y - H * 0.7) / (H * 0.3), 0, 1) ** 1.4
    return Image.fromarray((np.clip(v, 0, 1) * 255).astype(np.uint8), 'L')


def text_layer(lines, fonts, y, fill=(250, 244, 230, 255), tracking=0, shadow=10) -> Image.Image:
    """Centred lines of text with a soft shadow, as an RGBA layer the size of the frame."""
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for d, col in ((ImageDraw.Draw(sh), (0, 0, 0, 235)), (ImageDraw.Draw(layer), fill)):
        yy = y
        for text, f in zip(lines, fonts):
            if tracking:
                widths = [d.textlength(ch, font=f) + tracking for ch in text]
                x = (W - sum(widths) + tracking) / 2
                for ch, wd in zip(text, widths):
                    d.text((x, yy), ch, font=f, fill=col)
                    x += wd
            else:
                d.text(((W - d.textlength(text, font=f)) / 2, yy), text, font=f, fill=col)
            yy += int(f.size * 1.22)
    sh = sh.filter(ImageFilter.GaussianBlur(shadow))
    return Image.alpha_composite(Image.alpha_composite(sh, sh), layer)


def wrap(text: str, f: ImageFont.FreeTypeFont, max_w: float):
    d = ImageDraw.Draw(Image.new('L', (8, 8)))
    if d.textlength(text, font=f) <= max_w:
        return [text]
    words = text.split(' ')
    best = None
    for i in range(1, len(words)):
        a, b = ' '.join(words[:i]), ' '.join(words[i:])
        cost = abs(d.textlength(a, font=f) - d.textlength(b, font=f))
        if best is None or cost < best[0]:
            best = (cost, [a, b])
    return best[1]


def fade(t, a, b, fin=0.35, fout=0.35):
    return max(0.0, min(1.0, (t - a) / fin, (b - t) / fout))


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    words = load_words()
    CUES = cue_spans(words)
    end_voice = words[-1][2]
    total = LEAD + end_voice + TAIL
    nframes = int(round(total * FPS))

    studio = os.path.join(SRC, '09_studio.jpg')
    if not os.path.exists(studio):
        studio = os.path.join(ROOT, 'public', 'img', 'studio-evening.jpg')
    stills = []
    for name, start, move in SHOTS:
        path = studio if name == '09_studio.jpg' else os.path.join(SRC, name)
        stills.append((cover(Image.open(path).convert('RGB')), LEAD + start, move))
    starts = [s for _, s, _ in stills] + [total]

    # captions and titles as layers
    cap_font = font('Caladea-Italic', 46)
    cues = []
    vtt = ['WEBVTT', '']
    for a, b, text in CUES:
        t0, t1 = LEAD + words[a][1] - 0.12, LEAD + words[b][2] + 0.28
        lines = wrap(text, cap_font, W * 0.74)
        y = H - 92 - int(cap_font.size * 1.22) * len(lines)
        cues.append((t0, t1, text_layer(lines, [cap_font] * len(lines), y)))
        ts = lambda v: f'{int(v // 60):02d}:{v % 60:06.3f}'
        vtt += [f'{ts(t0)} --> {ts(t1)}', text, '']
    with open(os.path.join(OUT, 'legend.vtt'), 'w') as fh:
        fh.write('\n'.join(vtt))
    title = text_layer(['THE LEGEND OF THE', 'AI Program Manager'], [font('Caladea-Regular', 30), font('Caladea-BoldItalic', 96)], 150, tracking=0)
    title_small = text_layer(['THE LEGEND OF THE'], [font('Caladea-Regular', 30)], 150, tracking=9)
    title_big = text_layer(['AI Program Manager'], [font('Caladea-BoldItalic', 96)], 150 + 52)
    del title
    end1 = text_layer(['GÁBOR BÉLECZKI'], [font('Caladea-Regular', 34)], 330, tracking=11)
    end2 = text_layer(['AI Program Manager · Budapest'], [font('Caladea-BoldItalic', 72)], 330 + 62)
    end3 = text_layer(['gabor-beleczki-studio.vercel.app'], [font('Caladea-Italic', 38)], 330 + 62 + 118)

    vig = vignette()
    # the closing card needs a darker picture behind it
    dusk = Image.new('RGBA', (W, H), (8, 8, 10, 255))

    # audio: narration (warmed, a little room) under a quiet score
    music = os.path.join(TMP, 'score.wav')
    write_wav(music, score(total))
    audio = os.path.join(TMP, 'audio.m4a')
    voice_delay = int(LEAD * 1000)
    subprocess.run([
        'ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(SRC, 'narration.mp3'), '-i', music, '-filter_complex',
        f'[0:a]aresample=44100,highpass=f=70,equalizer=f=140:t=q:w=0.9:g=2.5,equalizer=f=3200:t=q:w=1.2:g=1.5,'
        f'aecho=0.85:0.5:55|110:0.16|0.09,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=44100,aformat=channel_layouts=stereo,'
        f'adelay={voice_delay}|{voice_delay},apad,asplit=2[v1][v2];'
        f'[1:a]volume=0.5[m];[m][v1]sidechaincompress=threshold=0.03:ratio=5:attack=40:release=600[md];'
        f'[v2][md]amix=inputs=2:duration=shortest:normalize=0,alimiter=limit=0.95[a]',
        '-map', '[a]', '-t', f'{total:.3f}', '-c:a', 'aac', '-b:a', '128k', audio,
    ], check=True)

    out = os.path.join(OUT, 'legend.mp4')
    enc = subprocess.Popen([
        'ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
        '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', os.environ.get('X264_PRESET', 'slow'), '-crf', os.environ.get('CRF', '27'),
        '-maxrate', '1500k', '-bufsize', '3000k', '-pix_fmt', 'yuv420p', '-g', str(FPS * 2), '-c:a', 'copy', '-movflags', '+faststart', '-shortest', out,
    ], stdin=subprocess.PIPE)

    poster_at = int(3.0 * FPS)
    for fi in range(nframes):
        t = fi / FPS
        # the shot on screen, and the next one dissolving in
        si = max(i for i in range(len(stills)) if starts[i] <= t + 1e-6)
        im, s0, move = stills[si]
        s1 = starts[si + 1]
        span = (s1 + XFADE) - (s0 if si else 0.0)
        img = frame_of(im, move, min(1.0, max(0.0, (t - (s0 if si else 0.0)) / span)))
        if si > 0 and t < s0 + XFADE:
            pim, ps0, pmove = stills[si - 1]
            pspan = (s0 + XFADE) - (ps0 if si - 1 else 0.0)
            prev = frame_of(pim, pmove, min(1.0, (t - (ps0 if si - 1 else 0.0)) / pspan))
            k = (t - s0) / XFADE
            img = Image.blend(prev, img, k * k * (3 - 2 * k))
        img = ImageChops.multiply(img, Image.merge('RGB', (vig, vig, vig)))
        rgba = img.convert('RGBA')
        for t0, t1, layer in cues:
            a = fade(t, t0, t1, 0.25, 0.3)
            if a > 0:
                rgba = Image.alpha_composite(rgba, layer if a >= 1 else Image.composite(layer, Image.new('RGBA', (W, H), (0, 0, 0, 0)), layer.getchannel('A').point(lambda v, a=a: int(v * a))))
        a = fade(t, total - 3.5, total + 1.0, 0.9, 0.9)
        if a > 0:
            rgba = Image.blend(rgba, dusk, 0.6 * a)
        for layer, t0, t1 in ((title_small, 0.5, 4.6), (title_big, 0.9, 4.6), (end1, total - 3.3, total), (end2, total - 3.0, total), (end3, total - 2.6, total)):
            a = fade(t, t0, t1 + 1.0, 0.9, 0.9)
            if a > 0:
                rgba = Image.alpha_composite(rgba, layer if a >= 1 else Image.composite(layer, Image.new('RGBA', (W, H), (0, 0, 0, 0)), layer.getchannel('A').point(lambda v, a=a: int(v * a))))
        arr = np.asarray(rgba.convert('RGB'), dtype=np.float32)
        # in from black, out to black
        arr *= min(1.0, t / 1.0, (total - t) / 0.7 if t > total - 0.7 else 1.0)
        frame = np.clip(arr, 0, 255).astype(np.uint8)
        enc.stdin.write(frame.tobytes())
        if fi == poster_at:
            Image.fromarray(frame).save(os.path.join(OUT, 'legend-poster.jpg'), quality=86)
        if fi % (FPS * 10) == 0:
            print(f'[legend] {t:5.1f}s / {total:.1f}s', flush=True)
    enc.stdin.close()
    enc.wait()
    cues_json = [{'t0': round(LEAD + words[a][1] - 0.12, 2), 't1': round(LEAD + words[b][2] + 0.28, 2), 'text': text} for a, b, text in CUES]
    with open(os.path.join(OUT, 'legend.json'), 'w') as fh:
        json.dump({'duration': round(total, 2), 'size': [W, H], 'cues': cues_json}, fh, indent=1, ensure_ascii=False)
    print(f'[legend] wrote {out}: {os.path.getsize(out) / 1e6:.2f} MB, {total:.1f}s')
    return enc.returncode


if __name__ == '__main__':
    sys.exit(main())
