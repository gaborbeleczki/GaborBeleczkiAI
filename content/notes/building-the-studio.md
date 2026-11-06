---
title: Building the studio
date: 2026-11-05
summary: How this site's 3D room was made — modeled with Python in Blender, lit and baked with Cycles, and rendered live in the browser with Three.js.
---

This site has two faces. On a desktop browser it opens as a small Nordic studio in Budapest: an oak desk under a wide window, folios on a shelf, a record player, the Danube outside. Everywhere else it is a plain, single-column page with the same content. Both read from one content file, so they never drift apart.

## Modeled in code

Nothing in the room was placed by hand. A set of Python scripts drive Blender 5.2 headlessly and build the scene from primitives: the plank floor, the plaster walls with a deep window reveal, the fluted sideboard, the chairs, the lamps, the plants, even the books on the shelves. Materials are procedural too — oak rings and grain, wool weave, speckled ceramics — so the whole room can be rebuilt, restyled and re-baked with a single command.

The view out of the window is its own small scene: a stylised Budapest across the river, with a domed palace on the hill, a church spire, a suspension bridge and lamps along both embankments. It is rendered once for the evening and once for the day.

## Baked light

Real-time global illumination is expensive, so the room's lighting is computed ahead of time. For every surface, Cycles bakes two things into texture atlases:

- **Albedo**, the surface colour, at high resolution, once.
- **Light**, how much light arrives there, at lower resolution, once per lighting state (evening and day), cleaned up with OpenImageDenoise.

In the browser a tiny shader multiplies them back together and cross-fades between the two lighting states when you click a lamp. Because albedo and light are stored separately, the day and evening versions share the same colour atlas and the download stays small.

![The studio rendered offline with Cycles: the reference for the bake](/img/cycles-evening.jpg)

![The same view in the browser: baked atlases, a live display and the window shader](/img/studio-evening.jpg)

The first image is a full path-traced Cycles render; the second is the browser. The differences are mostly in the window, which is live, and in the glossy highlights, which the bake leaves out on purpose.

## Live where it matters

Some things cannot be baked because they move or glow: the display, the folios, the record and its tonearm, the lamp bulbs, the candle. Those are lit live in WebGL, using small panoramas rendered from inside the room so they sit in the same light as the baked surfaces.

The window is a single quad with a shader. It reads the city render and a small depth map, and traces your viewing ray into that depth for every pixel, so the embankment shifts against the castle as you move. Lights twinkle, the river shimmers, and every so often a tram glides along the embankment.

## The display

Each folio on the shelf is a chapter: approach, role, work, career, toolkit, questions and contact. Each one is a self-contained module that draws onto the display's canvas, handles its own clicks and keys, and cleans up after itself. The display's dock switches between them, and the arrow keys work too.

## Checked by machines

The build is tested in a headless browser: screenshots of every chapter, frame-time measurements, a pixel-difference check of the WebGL render against a Cycles reference from the same camera, and a set of hostile checks — no WebGL, a lost graphics context, keyboard-only use, reduced motion — which must all land somewhere sensible, usually this page.

The design takes its calm from Nordic interiors and its clarity from Apple's interfaces: warm paper whites, oak, a fjord blue, one lingonberry accent, system type with tight tracking, frosted glass where controls float above content.
