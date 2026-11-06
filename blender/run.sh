#!/usr/bin/env bash
# Full asset pipeline: window photos -> scene -> bake -> env maps -> stills -> export -> web optimisation.
# Needs Blender 5.2 as a Python module:  python3 -m venv .venv && .venv/bin/pip install bpy==5.2.3 numpy pillow
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${BLENDER_PY:-/opt/blender-env/venv/bin/python}"

step() { echo; echo "==> $*"; }

step "Window: Budapest photos -> plates, depth and paths"
"$PY" blender/fetch_photos.py
"$PY" -I blender/window_photos.py

step "Studio scene"
"$PY" blender/build_scene.py

step "Bake albedo + lighting (evening, day)"
"$PY" blender/bake.py

step "Environment maps for live-lit objects"
"$PY" blender/envmap.py

step "Hero stills"
"$PY" blender/render_stills.py --preset hero --samples "${STILL_SAMPLES:-160}"

step "Export glTF"
"$PY" blender/export.py

step "Optimise for the web"
node scripts/optimize-assets.mjs

step "Self-contained .blend for opening in Blender"
"$PY" blender/package_blend.py

echo
echo "Done. For the page's hero image and video (needs a build): npm run build && node scripts/qa/posters.mjs && node scripts/qa/video.mjs"
