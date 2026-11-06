"""Download the two Budapest photographs the window is made from (into blender/assets/photos/).

  python blender/fetch_photos.py

Both come from Wikimedia Commons. Commons asks automated clients to use its standard thumbnail
sizes, so the day photo is fetched as its 3840 px rendition; the night photo is smaller than that
and is fetched as the original.

  evening  "Széchenyi Chain Bridge in Budapest at night" by Wilfredor, CC0
           https://commons.wikimedia.org/wiki/File:Széchenyi_Chain_Bridge_in_Budapest_at_night.jpg
  day      "View from Buda Castle" by Yair-haklai, CC BY-SA 4.0
           https://commons.wikimedia.org/wiki/File:View_from_Buda_Castle.jpg
"""

from __future__ import annotations

import hashlib
import os
import sys
import time
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DEST = os.path.join(ROOT, 'blender', 'assets', 'photos')
UA = 'GaborBeleczkiStudioBuild/1.0 (https://gabor-beleczki-studio.vercel.app; one-off asset download)'

PHOTOS = {
    'chain-bridge-night.jpg': (
        'https://upload.wikimedia.org/wikipedia/commons/f/fd/Sz%C3%A9chenyi_Chain_Bridge_in_Budapest_at_night.jpg',
        '19c249e87754da1256e33e2b1ce37ee615f379e9da4ff9b36469e5837736904d',
    ),
    'view-from-buda-castle.jpg': (
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/View_from_Buda_Castle.jpg/3840px-View_from_Buda_Castle.jpg',
        'e7e582cb315b5d0ffe226abd8426452bc7c63c3e01e2cb7af9319d43029c83fc',
    ),
}


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    os.makedirs(DEST, exist_ok=True)
    failed = 0
    for name, (url, digest) in PHOTOS.items():
        path = os.path.join(DEST, name)
        if os.path.exists(path) and sha256(path) == digest:
            print(f'[photos] {name} ok')
            continue
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=60) as r, open(path, 'wb') as fh:
                    fh.write(r.read())
                break
            except Exception as exc:  # 429 from Commons: back off and retry
                print(f'[photos] {name}: {exc}; retrying', file=sys.stderr)
                time.sleep(15 * (attempt + 1))
        if not os.path.exists(path) or sha256(path) != digest:
            print(f'[photos] {name}: download failed or checksum differs', file=sys.stderr)
            failed += 1
        else:
            print(f'[photos] {name} downloaded')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
