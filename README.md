# Gábor Béleczki · Studio

A personal site in two layers:

- **The studio** — a small, cozy Nordic study in Budapest, modeled in Blender with Python, lit and baked with Cycles, and rendered live in the browser with Three.js. Chapter dossiers on the shelf come to lie open on the desk as typeset A4 pages, read from above and turned like a book's pages; the desk display shows the chapters as interactive modules; the things on the desk (business cards, the printed CV, a phone, the notebook, a brass armillary sphere, coffee) are ways into the portfolio, each marked with a dot; the window looks out on real photographs of Budapest rebuilt in depth, with tram 2 and the river boats, modelled in Blender, moving slowly through them; lamps and fairy lights switch between day and evening; a record player plays generated lounge deep house.
- **The lighter layer** — the first time you sit at the desk, the display plays a one-minute film, *The Legend of the AI Program Manager*. Behind you is a cork board of side quests (press Q, or *Side quests* in the toolbar): each card opens with a sketch of the project's screen, what it does and what is in it, and the same button takes you back to the desk; under the window, a runner's corner with a training log (*Project Sub-2:55*) that opens like the dossiers; every dossier has a sticky note in it; and a small meter in the toolbar counts the studio's own adoption. The jokes live in `content/gags.ts` and follow one rule: kind, true to the work, nothing about colleagues or an employer.
- **The page** — the original portfolio, served untouched at `/page/` (with the original one-page and long CVs at `/page/cv/` and `/page/cv-long/`). Phones, reduced-motion users, browsers without WebGL 2 and anyone who presses *Page* get it. Crawlers and no-JS visitors read a static HTML version of the same content at `/` (also at `/?static`).

```
content/            profile.ts (single source of content) · gags.ts (captions, sticky notes, achievements)
                    running.ts (the training log's numbers) · notes/*.md (blog posts)
media/legend/       sources of the intro film: stills, video clips and their prompts, narration, word timings
src/site/           static page: build-time HTML, styles, mode switching
src/studio/         Three.js studio
  core/             baked materials, window shader + traffic + rain, camera rig, dossiers (book.ts, shelf.ts),
                    things you hold (held.ts, desk.ts), turntable, the glow pass (post.ts)
  print/            typesetting the chapters onto A4 pages for the dossiers and the notebook
  screen/           display canvas + one module per chapter (hello … contact)
  ui/  audio/       frosted HUD, hotspots, the adoption meter, generative Web Audio soundtrack
blender/            Python pipeline that builds, bakes, renders and exports the scene
scripts/            asset optimisation, the intro film (legend-video.py), QA (Playwright) and video capture
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
| Window | `blender/fetch_photos.py` + `blender/window_photos.py` | two Budapest photos (evening, day) → colour plates, a depth/river/lights/foreground data map, a fill for what the trees hide, and paths for tram 2 and the boats (`public/models/window.json`; the paths for road traffic, a plane and birds are still written but no longer used). If `blender/assets/looks/` holds a restyled version of a photo (same file name, registered onto the original), it becomes the colour plate; the geometry still comes from the photograph |
| Vehicles | `blender/vehicles.py` | cars, a taxi, a van, a city bus, the line 2 tram and two river boats modelled in Blender, rendered as side views by day and by night into sprite atlases (`public/textures/vehicles_*.webp`, layout in `public/models/vehicles.json`) |
| Scene | `blender/build_scene.py` | the room from primitives + procedural materials, merged into six bake groups (floor, walls, furniture, props, quests, shoes) with packed UV atlases; camera poses and click targets in `public/models/studio.json`. `blender/lib/cozy.py` adds the warm layer and the side quests: a throw draped over the chair by a cloth simulation, a pouf, fairy lights, a medal, the cork board (its cards are drawn by `blender/lib/cards.py`). `blender/lib/shoes.py` models the running shoes after the ASICS Megablast in its Ekiden colourway (a rockered max-stack sole, a woven upper, the crossing stripes); they bake as a group of their own |
| Bake | `blender/bake.py` | per group: albedo (up to 4096²) and light (2048², evening + day, denoised with OpenImageDenoise); `_lo` previews load first, then the full set on desktops or the 2K `_md` set on tablets and low-memory devices |
| Env maps | `blender/envmap.py` | small HDR panoramas that light the moving objects |
| Stills | `blender/render_stills.py` | Cycles references of the main view (pixel diff, build notes) |
| Export | `blender/export.py` + `scripts/optimize-assets.mjs` | glTF → meshopt-compressed `public/models/studio.glb`, WebP textures |
| Package | `blender/package_blend.py` | `blender/studio.blend` with its images packed in |

Open `blender/studio.blend` to look at or restyle the room in Blender; rerun the pipeline to bake the changes.

The browser recombines the bake as `albedo × light` and cross-fades the two light maps, so day and evening share one colour atlas. Moving or glowing things (display, dossiers, the things you can pick up, record, tonearm, bulbs, candle) are lit live from the HDR panoramas. The things you can lift are left out of the light bake (no dark patch where they stood); the browser draws their contact shadows.

The window is a photograph turned into a small 3D scene: every pixel of the glass follows the viewer's ray into the photo's depth (the city and river by fixed-point parallax, the trees below the terrace as a plane in front, with a guessed background behind them). On top runs a little world simulated in `src/studio/core/window.ts`, kept deliberately calm: tram 2 along the embankment and the river boats with their reflections, at a walking pace, ripples drifting slowly downstream and a little wind in the trees. Each vehicle is hidden, pixel by pixel, behind whatever stands in front of it in the photo, and the boat lanes keep clear of the moored ships. Rain on the pane is still there, behind `?rain`.

Motion runs on a fixed 120 Hz physics step (`src/studio/core/physics.ts`): the camera glides on critically damped springs, holds still at the desk and leans at the window, dossiers slide out of the shelf, settle flat on the desk and open on a sprung hinge with curling page turns, the armillary sphere coasts on its bearings, window traffic follows a car-following model (tram 2 stops at its stops, boats bob with wakes), and the record player has inertia and a cueing tonearm. Everything else holds still: the pendant, the curtains and the leaves keep the sway data written in Blender, but nothing in the room moves on its own any more, and there is no dust in the light and no flicker in the candle (all of it read as flicker on screen).

The case studies carry the motion figures of the original portfolio (`src/shared/figures.ts`), drawn once and rendered twice: on the display's canvas and as animated SVG on the page. The Role chapter includes the original platformer, playable on the display.

Light that spills: lamps, fairy lights, the candle and the brightest city lights live on their own layer; `src/studio/core/post.ts` draws them once more at a third of the size (over a black copy of the room, so a lamp behind the plant stays behind it), blurs that twice and lays it over the frame, with a slight vignette. That small copy is multisampled, so a fairy bulb smaller than a pixel does not blink as the view moves; on a standard-density screen a fast GPU also draws the room at up to 1.5x and lets the browser scale it down, which keeps thin edges from crawling. It is the first thing dropped on a slow device, and `?nopost` turns it off.

## The intro film

```bash
python3 scripts/legend-video.py     # -> public/media/legend.mp4, legend-poster.jpg, legend.vtt
```

Needs `numpy`, `Pillow` and `ffmpeg`. The film is cut from snippets, the way footage is edited: a quick dissolve between scenes, hard cuts to a closer framing within one. A shot is a video clip when `media/legend/` has one (`NN_name.mp4`, made with an image-to-video model from the still of the same name; the prompts and settings are in `media/legend/clips.json`), and otherwise its still, with a slow camera move and punch-in cuts. Nothing is painted on that changes from frame to frame (no candle flicker, dust or rain: on the display it read as flicker). The last shot is the studio's own recording (`public/media/studio-loop.mp4`), so run `node scripts/qa/video.mjs` first when the room has changed. The script sets the captions from the narration's word timings (`words.json`, from a forced alignment), synthesises a small score, and pipes the frames into FFmpeg.

## Content

Edit `content/profile.ts` — both the page and the studio's display read from it. Notes are Markdown files in `content/notes/` with a small front-matter block (`title`, `date`, `summary`); they become `/notes/…` pages and items in `/rss.xml`.

## QA

```bash
npm run build && npm run qa        # report in renders/qa/report.md
node scripts/qa/posters.mjs        # hero images, social card and the notes' illustrations, captured from the live studio
node scripts/qa/video.mjs          # re-record public/media/studio-loop.mp4
node scripts/qa/window.mjs         # the window up close: evening/day, leaning left/right, a few seconds apart
```

Headless Chromium (software WebGL) takes screenshots of every view, chapter, dossier and desk object, measures load and frame times, compares the WebGL render with the Cycles reference from the same camera, and runs hostile checks: no WebGL, software-only WebGL, a missing model, a lost graphics context, reduced motion, keyboard-only use and rapid input. Each must end somewhere sensible, usually the original portfolio at `/page/`. It also opens a dossier and turns its pages both ways, picks up every desk object, counts the hotspot dots, walks to the side-quest wall and back with Escape, opens the training log, plays and skips the film, checks that the adoption meter counts each first once and remembers it, plays the role game with the keyboard, renders the soundtrack offline to check it neither clips nor goes silent, and checks that the static page's seven case figures are animated.

## Deploy

Vercel builds it as a Vite static site (`vercel.json`): `npm run build`, output `dist/`, clean URLs, long-lived caching for hashed assets. Set `SITE_URL` in the project's environment variables to the final domain so canonical links, the sitemap and RSS use it.

## Credits

The room's geometry, its procedural materials, the print, the record sleeves, the cards on the cork board and the vehicles outside are generated by the scripts in `blender/`. The printed CV on the desk and the page view are the author's original portfolio. The soundtrack ("Budapest sessions", lounge deep house) is synthesised live with the Web Audio API, and the film's score with numpy: no samples, no recordings.

Made with generative models (through Higgsfield), and labelled as such on the site:
- **Image model (GPT Image):** the film's eight stills (`media/legend/`; one of them, cropped, is the portrait in the Hello dossier), the poster of the dragon, the crayon drawing, the two photo prints on the cork board, the knit, boucle and rug textures (`blender/assets/gen/`), and the restyled weather in the two window photos (`blender/assets/looks/`).
- **Video model (Seedance 2.0 Mini, image-to-video):** the film's dragon shot (`media/legend/07_dragon.mp4`), from its still. The other shots' prompts are in `media/legend/clips.json`.
- **Text-to-speech (a preset voice):** the film's narration (`media/legend/narration.mp3`). The script is the author's.

Window photos, via Wikimedia Commons:
- [Széchenyi Chain Bridge in Budapest at night](https://commons.wikimedia.org/wiki/File:Sz%C3%A9chenyi_Chain_Bridge_in_Budapest_at_night.jpg) by Wilfredor — CC0 1.0. Weather and light restyled with an image model (a misty evening after rain).
- [View from Buda Castle](https://commons.wikimedia.org/wiki/File:View_from_Buda_Castle.jpg) by Yair-haklai — [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Cropped, a parked tram painted out, season and light restyled with an image model (a golden autumn afternoon), depth and masks derived; `blender/assets/looks/view-from-buda-castle.jpg` and `public/textures/window_day*` are shared under the same licence.

The training log's numbers are the author's own, from Strava. The motion figures and the platformer come from the author's original portfolio. Type: the system font on Apple devices, otherwise [Inter](https://rsms.me/inter/) (SIL OFL); the handwriting on sticky notes is [Caveat](https://github.com/googlefonts/caveat) (SIL OFL). Rendering: [three.js](https://threejs.org) (MIT).
