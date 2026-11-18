#!/usr/bin/env python3
"""Assemble the first, narrated cut of the intro film, "The Legend of the AI Program Manager".

  python3 scripts/legend-video.py            ->  renders/legend-narrated/legend.mp4 (+ poster, captions)

The site now shows "The Quest" instead (scripts/the-quest.py); this cut is kept, with its sources,
and LEGEND_OUT=public/media would publish it again.

The film is cut together from snippets, the way footage is edited: a quick dissolve between
scenes, hard cuts to a closer framing within one. A snippet's source is a video clip when there
is one and a still when there is not:

- media/legend/NN_name.mp4: a live-action clip made with an image-to-video model (Seedance 2.5)
  from the still of the same name (prompts and settings in media/legend/clips.json). Played as
  filmed, slowed a little if it is shorter than its place in the cut; a closer shot within the
  scene is a gentle punch-in on the same take (at most CLIP_PUNCH, so 720p footage stays sharp).
- media/legend/NN_name.jpg: a still made with an image model. It gets a slow camera move and a
  punch-in for a closer shot. Nothing in a frame flickers: no candlelight, dust or rain is
  painted on (they read as flicker on the display).
- The last shot is the studio itself: the page's own recording of the room
  (public/media/studio-loop.mp4), else its evening poster.

The narration is a preset text-to-speech voice with word timings from a forced alignment; the
captions are set from those timings, and the score (a drone, four chords, a plucked string) is
synthesised with numpy. Frames are piped straight into FFmpeg.

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
OUT = os.environ.get('LEGEND_OUT') or os.path.join(ROOT, 'renders', 'legend-narrated')   # LEGEND_OUT=public/media to publish
TMP = os.path.join(ROOT, 'renders', 'legend')

W, H, FPS = 1600, 900, 24
LEAD = 2.2            # seconds of picture before the first word
TAIL = 3.8            # seconds after the last word
XFADE = 0.5           # the dissolve between scenes; within a scene the cut is hard
CLIP_PUNCH = 1.18     # the closest a punch-in goes on a video clip (a still may go closer)

# the snippets in order: source (media/legend/<name>.mp4 or .jpg), the narration time (s) at
# which it takes over, the camera move on a still (zoom from, zoom to, drift x, drift y, and
# optionally where the frame sits: -1..1 of the room the zoom leaves), and how it comes in
SHOTS = [
    ('01_tome', -LEAD, (1.10, 1.02, 0.25, -0.1)),
    ('02_scriptorium', 3.45, (1.03, 1.10, -0.3, 0.1)),
    ('02_scriptorium', 10.6, (1.40, 1.47, 0.12, -0.05, -0.95, -0.1), 'cut'),     # mighty ones
    ('03_traveller', 14.35, (1.12, 1.04, 0.2, -0.3)),
    ('03_traveller', 20.8, (1.38, 1.46, 0.12, 0.0, 0.2, -0.95), 'cut'),          # a roadmap
    ('04_council', 23.3, (1.04, 1.10, 0.35, 0.0)),
    ('04_council', 27.0, (1.38, 1.45, 0.08, 0.05, -0.95, 0.05), 'cut'),          # could this meeting
    ('05_mountain', 30.0, (1.12, 1.05, -0.2, 0.3)),
    ('05_mountain', 33.3, (1.36, 1.43, -0.1, 0.0, -0.45, 0.85), 'cut'),          # every single one
    ('06_hall', 35.9, (1.03, 1.10, 0.1, -0.2)),
    ('07_dragon', 39.3, (1.02, 1.10, 0.3, -0.1)),
    ('08_runner', 43.45, (1.10, 1.03, -0.15, 0.1)),
    ('08_runner', 46.6, (1.42, 1.50, 0.06, 0.0, -0.25, 0.35), 'cut'),            # no! he ran
    ('08_runner', 49.0, (1.30, 1.37, 0.12, 0.0, 0.95, -0.2), 'cut'),             # at night
    ('09_studio', 52.6, (1.08, 1.0, -0.2, 0.0)),
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
    z0, z1, px, py = move[:4]
    ox, oy = move[4:6] if len(move) > 4 else (0.0, 0.0)
    e = u * u * (3 - 2 * u) * 0.35 + u * 0.65
    zoom = z0 + (z1 - z0) * e
    vw, vh = W * 1.16 / zoom, H * 1.16 / zoom
    max_x, max_y = (im.width - vw) / 2, (im.height - vh) / 2
    cx = im.width / 2 + max_x * max(-1.0, min(1.0, ox + px * (2 * e - 1) * (0.3 if len(move) > 4 else 1.0)))
    cy = im.height / 2 + max_y * max(-1.0, min(1.0, oy + py * (2 * e - 1) * (0.3 if len(move) > 4 else 1.0)))
    sx, sy = vw / W, vh / H
    return im.transform((W, H), Image.AFFINE, (sx, 0, cx - vw / 2, 0, sy, cy - vh / 2), resample=Image.BICUBIC)


def probe(path: str) -> float:
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


class Clip:
    """A video snippet, read frame by frame as the film reaches it (time only moves forward)."""

    def __init__(self, path: str):
        self.path = path
        self.duration = probe(path)
        self.n = max(1, int(self.duration * FPS))
        self.proc = None
        self.read = 0
        self.cache: dict[int, np.ndarray] = {}

    def _next(self):
        if self.proc is None:
            self.proc = subprocess.Popen([
                'ffmpeg', '-loglevel', 'error', '-i', self.path, '-an', '-vf',
                f'fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},unsharp=5:5:0.45:5:5:0',
                '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        buf = self.proc.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            return None
        return np.frombuffer(buf, dtype=np.uint8).reshape(H, W, 3)

    def get(self, k: int) -> np.ndarray:
        k = max(0, min(k, self.n - 1))
        while self.read <= k:
            f = self._next()
            if f is None:
                self.n = self.read
                k = min(k, self.n - 1)
                break
            self.cache[self.read] = f
            self.read += 1
            for old in [i for i in self.cache if i < self.read - 3]:
                del self.cache[old]
        return self.cache[k]

    def at(self, seconds: float) -> Image.Image:
        f = max(0.0, seconds) * FPS
        k = int(f)
        a = f - k
        A = self.get(k)
        if a < 0.02 or k + 1 >= self.n:
            return Image.fromarray(A)
        B = self.get(k + 1)
        return Image.fromarray((A.astype(np.float32) * (1 - a) + B.astype(np.float32) * a).astype(np.uint8))

    def close(self):
        # the cut may not use the whole clip: stop the decoder rather than drain it
        if self.proc:
            self.proc.kill()
            self.proc.stdout.close()
            self.proc.wait()


class Snippet:
    def __init__(self, name: str, t0: float, move, mode: str, sources: dict):
        self.name, self.t0, self.move, self.mode = name, t0, move, mode
        self.src = sources[name]

    # set for clips once the cut is known: where the clip starts, how fast it plays, the punch-in
    clip_a = 0.0
    clip_speed = 1.0
    punch = 1.0

    def frame(self, t: float, a: float, b: float) -> Image.Image:
        """This snippet at film time t; it is on screen from a to b."""
        if isinstance(self.src, Clip):
            img = self.src.at((t - self.clip_a) * self.clip_speed)
            if self.punch > 1.001:
                ox, oy = self.move[4:6] if len(self.move) > 4 else (0.0, 0.0)
                vw, vh = W / self.punch, H / self.punch
                cx, cy = W / 2 + ox * (W - vw) / 2, H / 2 + oy * (H - vh) / 2
                img = img.transform((W, H), Image.AFFINE, (vw / W, 0, cx - vw / 2, 0, vh / H, cy - vh / 2), resample=Image.BICUBIC)
            return img
        u = min(1.0, max(0.0, (t - a) / max(b - a, 1e-3)))
        return frame_of(self.src, self.move, u)


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

    # each source once: a clip if there is one, else the still
    sources = {}
    for name, *_ in SHOTS:
        if name in sources:
            continue
        clip = os.path.join(SRC, name + '.mp4')
        if name == '09_studio' and not os.path.exists(clip):
            clip = os.path.join(ROOT, 'public', 'media', 'studio-loop.mp4')
        if os.path.exists(clip) and not os.environ.get('LEGEND_STILLS'):
            sources[name] = Clip(clip)
            print(f'[legend] {name}: clip {os.path.relpath(clip, ROOT)} ({sources[name].duration:.1f}s)', flush=True)
            continue
        still = os.path.join(SRC, name + '.jpg')
        if name == '09_studio' and not os.path.exists(still):
            still = os.path.join(ROOT, 'public', 'img', 'studio-evening.jpg')
        sources[name] = cover(Image.open(still).convert('RGB'))
        print(f'[legend] {name}: still', flush=True)
    snippets = []
    for shot in SHOTS:
        name, start, move = shot[:3]
        mode = shot[3] if len(shot) > 3 else 'dissolve'
        snippets.append(Snippet(name, LEAD + start, move, mode, sources))
    starts = [sn.t0 for sn in snippets] + [total]

    def on_screen(i):
        """When snippet i is on screen: from its start (or 0) to the next start, plus the dissolve."""
        a = snippets[i].t0 if i else 0.0
        b = starts[i + 1]
        if i + 1 < len(snippets) and snippets[i + 1].mode != 'cut':
            b += XFADE
        return a, b

    # a clip runs on through all the snippets cut from it (a punch-in is a crop of the same take),
    # slowed by up to a quarter if it is shorter than its place in the cut
    for name, src in sources.items():
        if not isinstance(src, Clip):
            continue
        idx = [i for i, sn in enumerate(snippets) if sn.name == name]
        a0, b1 = on_screen(idx[0])[0], on_screen(idx[-1])[1]
        speed = max(0.75, min(1.0, src.duration / max(b1 - a0, 1e-3)))
        for j, i in enumerate(idx):
            snippets[i].clip_a, snippets[i].clip_speed = a0, speed
            if j:
                snippets[i].punch = min(CLIP_PUNCH, max(1.0, snippets[i].move[0] / snippets[idx[0]].move[0]))
        if src.duration < (b1 - a0) * 0.75:
            print(f'[legend] {name}: the clip is {src.duration:.1f}s for {b1 - a0:.1f}s of film; it will hold its last frame', flush=True)

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
        # the snippet on screen, and the one before it while it dissolves away
        si = max(i for i in range(len(snippets)) if starts[i] <= t + 1e-6)
        a, b = on_screen(si)
        img = snippets[si].frame(t, a, b)
        sn = snippets[si]
        if si > 0 and sn.mode != 'cut' and t < sn.t0 + XFADE:
            pa, pb = on_screen(si - 1)
            prev = snippets[si - 1].frame(t, pa, pb)
            k = (t - sn.t0) / XFADE
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
    for src in sources.values():
        if isinstance(src, Clip):
            src.close()
    cues_json = [{'t0': round(LEAD + words[a][1] - 0.12, 2), 't1': round(LEAD + words[b][2] + 0.28, 2), 'text': text} for a, b, text in CUES]
    with open(os.path.join(OUT, 'legend.json'), 'w') as fh:
        json.dump({'duration': round(total, 2), 'size': [W, H], 'cues': cues_json}, fh, indent=1, ensure_ascii=False)
    print(f'[legend] wrote {out}: {os.path.getsize(out) / 1e6:.2f} MB, {total:.1f}s')
    return enc.returncode


if __name__ == '__main__':
    sys.exit(main())
