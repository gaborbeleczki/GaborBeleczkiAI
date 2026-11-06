---
title: Building the studio
date: 2026-11-05
summary: How this site's 3D room was made — modeled with Python in Blender, lit and baked with Cycles, and rendered live in the browser with Three.js.
---

This site has two faces. On a desktop browser it opens as a small Nordic studio in Budapest: an oak desk under a wide window, folios on a shelf, a record player, the Danube outside. Everywhere else it is a plain, single-column page with the same content. Both read from one content file, so they never drift apart.

## Modeled in code

Nothing in the room was placed by hand. A set of Python scripts drive Blender 5.2 headlessly and build the scene from primitives: the plank floor, the plaster walls with a deep window reveal, the fluted sideboard, the chairs, the lamps, the plants, even the books on the shelves. Materials are procedural too — oak rings and grain, wool weave, speckled ceramics — so the whole room can be rebuilt, restyled and re-baked with a single command.

The view out of the window is real: two photographs of Budapest from the Castle District, the Chain Bridge at night and the Parliament and the river by day. A script draws a handful of lines on each photo (the far bank, the bridge deck, the towers, the trees in front) and works out depth from the geometry of a camera standing above the Danube.

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

The window is a single quad with a shader. For every pixel of the glass it follows your viewing ray into the photo's depth: the city and the river settle by fixed-point parallax, and the trees right below the terrace are a separate plane in front, with a guessed background behind them for the slivers they uncover. Lean in at the window and the bridge slides against the far bank. Then the small things: cars and buses cross the bridge, tram 2 runs along the embankment, boats drift downstream with their lights reflected in the water, a plane blinks across the evening sky, birds cross by day, the crowns sway and the current carries the ripples.

Everything that moves on its own runs on a fixed 120 Hz physics step: the camera on critically damped springs, the folios with a little rock when they land, the record player's platter with real inertia and a tonearm that lifts while it travels, the pendant lamp as a pendulum, curtains and leaves in a breeze.

Photos: [Széchenyi Chain Bridge in Budapest at night](https://commons.wikimedia.org/wiki/File:Sz%C3%A9chenyi_Chain_Bridge_in_Budapest_at_night.jpg) by Wilfredor (CC0) and [View from Buda Castle](https://commons.wikimedia.org/wiki/File:View_from_Buda_Castle.jpg) by Yair-haklai ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); cropped, a parked tram painted out, depth added — the edited image is shared under the same licence).

## The display

Each folio on the shelf is a chapter: approach, role, work, career, toolkit, questions and contact. Each one is a self-contained module that draws onto the display's canvas, handles its own clicks and keys, and cleans up after itself. The display's dock switches between them, and the arrow keys work too.

The case files open on the motion figures from the original portfolio — the governed route, the use-case funnel, adoption week by week, hub and spoke — plus three new ones drawn in the same style. Each figure is described once and drawn twice: on the display's canvas and as animated SVG on this page. The Role chapter has "A day in the role", the platformer from the original site, playable on the display.

## Music

Click the record player for "Budapest sessions": lounge deep house at 118 BPM, generated live in the browser. A soft four-on-the-floor kick pumps the pads and bass, hats and a shaker swing, an FM electric piano plays jazzy stabs over Dm9, Gm9, Cmaj9 and Am9, and plucks bounce through a ping-pong delay. The arrangement moves through an intro, grooves, a lift and a breakdown with small random variations, so it never repeats note for note. There are no samples: every sound is built from oscillators and noise.

## Checked by machines

The build is tested in a headless browser: screenshots of every chapter, frame-time measurements, a pixel-difference check of the WebGL render against a Cycles reference from the same camera, and a set of hostile checks — no WebGL, a lost graphics context, keyboard-only use, reduced motion — which must all land somewhere sensible, usually this page.

The design takes its calm from Nordic interiors and its clarity from Apple's interfaces: warm paper whites, oak, a fjord blue, one lingonberry accent, system type with tight tracking, frosted glass where controls float above content.
