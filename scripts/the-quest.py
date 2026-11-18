#!/usr/bin/env python3
"""Publish the intro film, "The Quest", to the site.

  python3 scripts/the-quest.py      ->  public/media/legend.mp4, legend-poster.jpg, legend.vtt, legend.json

The film is a finished master (media/legend/the-quest.mp4: 62 s, 1280x720, H.264 + AAC, its own
sound mix levelled to -16 LUFS). It is published bit for bit, never re-encoded; the file already
has its index at the front, so it streams. This script copies it, takes the poster from one of its
frames, and writes a captions track of sounds and scenes (the film has no dialogue).

Needs: python3 with Pillow, ffmpeg.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MASTER = os.path.join(ROOT, 'media', 'legend', 'the-quest.mp4')
OUT = os.path.join(ROOT, 'public', 'media')

TITLE = 'The Quest'
POSTER_AT = 29.5      # the hero on the hilltop at dawn, Budapest below

# what happens, and what you hear: (from s, to s, text)
CUES = [
    (0.4, 7.8, '[Low strings and drums. A window bangs open; the wind tears a page from an old tome.]'),
    (8.2, 12.5, '[The page sails into a scriptorium as a tower of scrolls collapses.]'),
    (12.7, 17.4, '[A hooded hero strides through the falling paper and catches the page.]'),
    (17.8, 23.4, '[He wakes a sleeping council by slamming the page on the table. It is a map.]'),
    (24.0, 31.6, '[Dawn. Map in hand, he heads down a hilltop towards Budapest.]'),
    (32.2, 39.0, '[He plants a flag, and a mountain of scrolls sorts itself into ordered stacks.]'),
    (39.6, 44.8, '[Before rows of students, he lights three rings over the stage.]'),
    (45.2, 51.9, '[The dragon seals the deal with a wax stamp, in a burst of sparks.]'),
    (52.5, 55.8, '[Night by the Danube. He drops the cloak.]'),
    (56.0, 61.5, '[Footsteps on wet stone: he runs in black kit, the Chain Bridge behind him.]'),
]


def probe(path: str) -> dict:
    out = subprocess.run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def ts(v: float) -> str:
    return f'{int(v // 60):02d}:{v % 60:06.3f}'


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    info = probe(MASTER)
    video = next(s for s in info['streams'] if s['codec_type'] == 'video')
    duration = float(info['format']['duration'])

    film = os.path.join(OUT, 'legend.mp4')
    shutil.copyfile(MASTER, film)

    poster = os.path.join(OUT, 'legend-poster.jpg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(POSTER_AT), '-i', MASTER, '-frames:v', '1',
                    '-q:v', '3', poster], check=True)

    vtt = ['WEBVTT', '', 'NOTE The Quest has no dialogue: these captions describe its sounds and scenes.', '']
    for a, b, text in CUES:
        vtt += [f'{ts(a)} --> {ts(b)}', text, '']
    with open(os.path.join(OUT, 'legend.vtt'), 'w') as fh:
        fh.write('\n'.join(vtt))

    with open(os.path.join(OUT, 'legend.json'), 'w') as fh:
        json.dump({'title': TITLE, 'duration': round(duration, 2), 'size': [video['width'], video['height']],
                   'dialogue': False, 'cues': [{'t0': a, 't1': b, 'text': t} for a, b, t in CUES]}, fh, indent=1)

    print(f'[quest] {os.path.relpath(film, ROOT)}: {os.path.getsize(film) / 1e6:.2f} MB, {duration:.1f}s, '
          f'{video["width"]}x{video["height"]}; poster at {POSTER_AT}s; {len(CUES)} captions')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
