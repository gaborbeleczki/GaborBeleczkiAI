# Gábor Béleczki · Studio

A personal site in two layers:

- **The studio** — a small, focused Nordic study in Budapest, modeled in Blender with Python, lit and baked with Cycles, and rendered live in the browser with Three.js. Chapter dossiers on the shelf open in your hands as typeset A4 pages that turn; the desk display shows the chapters as interactive modules; the things on the desk (business cards, the printed CV, a phone, the notebook, a brass armillary sphere, coffee) are ways into the portfolio, each marked with a dot; the window looks out on real photographs of Budapest rebuilt in depth, with Blender-modelled traffic, tram 2 and river boats; lamps switch between day and evening; a record player plays generated lounge deep house.
- **The page** — the original portfolio, served untouched at `/page/` (with the original one-page and long CVs at `/page/cv/` and `/page/cv-long/`). Phones, reduced-motion users, browsers without WebGL 2 and anyone who presses *Page* get it. Crawlers and no-JS visitors read a static HTML version of the same content at `/` (also at `/?static`).

```
content/            profile.ts (single source of content) · notes/*.md (blog posts)
src/site/           static page: build-time HTML, styles, mode switching
src/studio/         Three.js studio
  core/             baked materials, window shader + traffic, camera rig, dossiers (book.ts, shelf.ts),
                    things you hold (held.ts, desk.ts), turntable
  print/            typesetting the chapters onto A4 pages for the dossiers and the notebook
  screen/           display canvas + one module per chapter (hello … contact)
  ui/  audio/       frosted HUD, generative Web Audio soundtrack
blender/            Python pipeline that builds, bakes, renders and exports the scene
scripts/            asset optimisation, QA (Playwright) and video capture
public/             baked atlases, window photos and data maps, glTF, stills, video
```

## Develop

```bash
npm install
npm run dev
```

Open `http://localhost:5173/` (add `?studio` or `?page` to force a mode; `?day` / `?evening` for the light).

```bash
npm run build      # dist/: page, studio chunk, notes, CV, RSS, sitemap
npm run preview
npm run typecheck
```

## The Blender pipeline

Blender 5.2 runs headless as a Python module (`pip install bpy==5.2.3`). One command regenerates every asset:

```bash
BLENDER_PY=/path/to/venv/bin/python npm run blender
```

| Step | Script | Output |
| --- | --- | --- |
| Window | `blender/fetch_photos.py` + `blender/window_photos.py` | two Budapest photos (evening, day) → colour plates, a depth/river/lights/foreground data map, a fill for what the trees hide, and paths for traffic, tram 2, boats, a plane and birds (`public/models/window.json`) |
| Vehicles | `blender/vehicles.py` | cars, a taxi, a van, a city bus, the line 2 tram and two river boats modelled in Blender, rendered as side views by day and by night into sprite atlases (`public/textures/vehicles_*.webp`, layout in `public/models/vehicles.json`) |
| Scene | `blender/build_scene.py` | the room from primitives + procedural materials, merged into four bake groups with packed UV atlases; camera poses and click targets in `public/models/studio.json` |
| Bake | `blender/bake.py` | per group: albedo (up to 4096²) and light (2048², evening + day, denoised with OpenImageDenoise); `_lo` previews load first, then the full set on desktops or the 2K `_md` set on tablets and low-memory devices |
| Env maps | `blender/envmap.py` | small HDR panoramas that light the moving objects |
| Stills | `blender/render_stills.py` | Cycles references of the main view (pixel diff, build notes) |
| Export | `blender/export.py` + `scripts/optimize-assets.mjs` | glTF → meshopt-compressed `public/models/studio.glb`, WebP textures |
| Package | `blender/package_blend.py` | `blender/studio.blend` with its images packed in |

Open `blender/studio.blend` to look at or restyle the room in Blender; rerun the pipeline to bake the changes.

The browser recombines the bake as `albedo × light` and cross-fades the two light maps, so day and evening share one colour atlas. Moving or glowing things (display, dossiers, the things you can pick up, record, tonearm, bulbs, candle) are lit live from the HDR panoramas. The things you can lift are left out of the light bake (no dark patch where they stood); the browser draws their contact shadows.

The window is a photograph turned into a small 3D scene: every pixel of the glass follows the viewer's ray into the photo's depth (the city and river by fixed-point parallax, the trees below the terrace as a plane in front, with a guessed background behind them). On top runs a little world simulated in `src/studio/core/window.ts`: cars and buses on the Chain Bridge and the embankment, tram 2, river boats with reflections, a plane at night, birds by day, ripples drifting downstream, twinkling lights, wind in the trees.

Motion runs on a fixed 120 Hz physics step (`src/studio/core/physics.ts`): the camera glides on critically damped springs, holds still at the desk and leans at the window, dossiers slide out of the shelf and open on a sprung hinge with curling page turns, the armillary sphere coasts on its bearings, window traffic follows a car-following model (tram 2 stops at its stops, boats bob with wakes), the record player has inertia and a cueing tonearm, the pendant swings as a pendulum, curtains and leaves move in the vertex shader from per-vertex data written in Blender, and dust drifts in the light.

The case studies carry the motion figures of the original portfolio (`src/shared/figures.ts`), drawn once and rendered twice: on the display's canvas and as animated SVG on the page. The Role chapter includes the original platformer, playable on the display.

## Content

Edit `content/profile.ts` — both the page and the studio's display read from it. Notes are Markdown files in `content/notes/` with a small front-matter block (`title`, `date`, `summary`); they become `/notes/…` pages and items in `/rss.xml`.

## QA

```bash
npm run build && npm run qa        # report in renders/qa/report.md
node scripts/qa/posters.mjs        # hero images + social card captured from the live studio
node scripts/qa/video.mjs          # re-record public/media/studio-loop.mp4
node scripts/qa/window.mjs         # the window up close: evening/day, leaning left/right, a few seconds apart
```

Headless Chromium (software WebGL) takes screenshots of every view, chapter, dossier and desk object, measures load and frame times, compares the WebGL render with the Cycles reference from the same camera, and runs hostile checks: no WebGL, software-only WebGL, a missing model, a lost graphics context, reduced motion, keyboard-only use and rapid input. Each must end somewhere sensible, usually the original portfolio at `/page/`. It also opens a dossier and turns its pages both ways, picks up every desk object, counts the hotspot dots, plays the role game with the keyboard, renders the soundtrack offline to check it neither clips nor goes silent, and checks that the static page's seven case figures are animated.

## Deploy

Vercel builds it as a Vite static site (`vercel.json`): `npm run build`, output `dist/`, clean URLs, long-lived caching for hashed assets. Set `SITE_URL` in the project's environment variables to the final domain so canonical links, the sitemap and RSS use it.

## Credits

Everything in the room — geometry, materials, the print, the record sleeves and the vehicles outside — is generated by the scripts in `blender/`. The printed CV on the desk and the page view are the author's original portfolio. The soundtrack ("Budapest sessions", lounge deep house) is synthesised live with the Web Audio API: no samples, no recordings.

Window photos, via Wikimedia Commons:
- [Széchenyi Chain Bridge in Budapest at night](https://commons.wikimedia.org/wiki/File:Sz%C3%A9chenyi_Chain_Bridge_in_Budapest_at_night.jpg) by Wilfredor — CC0 1.0.
- [View from Buda Castle](https://commons.wikimedia.org/wiki/File:View_from_Buda_Castle.jpg) by Yair-haklai — [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Cropped, a parked tram painted out, depth and masks derived; `public/textures/window_day*` are shared under the same licence.

The motion figures and the platformer come from the author's original portfolio. Type: the system font on Apple devices, otherwise [Inter](https://rsms.me/inter/) (SIL OFL). Rendering: [three.js](https://threejs.org) (MIT).
