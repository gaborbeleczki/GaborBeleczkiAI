---
title: Side quests and a legend
date: 2026-11-16
summary: The studio got warmer and less serious — a throw draped by a cloth simulation, rain on the window, a cork board of side quests, a marathon plan run like a programme, and a one-minute film told by a wise old storyteller.
---

The first version of the studio was tidy. Tidy is not the same as lived in, so this round was about the things a real desk collects: a blanket, bad weather, a child's drawing, running shoes, and a few jokes.

## Warmer

The throw on the chair is not sculpted. It starts as a flat sheet lying across the back of the chair, and Blender's cloth solver lets it fall for five simulated seconds: one half slides down the outside, the other into the seat, and eight stitches stay where the sheet crosses the rim, the way a throw stays where it was put. The result is frozen into the mesh and baked like everything else.

Around it: a knitted pouf, a cream wool rug, a little lamp on a stack of books, a crayon drawing taped to the wall, and two strings of fairy lights. The seventy bulbs are one mesh that glows in the evening; for the light bake, fifteen small lamps stand in for them. A last pass in the browser lets anything that emits light spill softly into what is around it.

![The room in the evening: fairy lights, the throw, rain on the window](/img/studio-evening.jpg)

## Weather

The view is still two real photographs of Budapest, rebuilt in depth. What changed is the season. An image model restyled each photo (a golden autumn afternoon; a misty evening after rain), and a script registers the result back onto the original: matching features between the two, fitting a homography, checking that the bridge still lands within about two pixels of where it was. Depth, the river, the tram's track and the traffic all still come from the photograph itself, so nothing that moves had to learn that the weather changed.

In the evening it rains on the pane. The drops are procedural: they run down the glass, leave a trail that wipes the mist, and each one bends the city behind it like a small lens.

![The window up close: rain on the glass, the Chain Bridge behind it](/img/studio-window-rain.jpg)

## Side quests

Turn around and there is a cork board. None of it was on the roadmap; all of it shipped: a city break with a KPI (dwarfs found), kitchen-table maths puzzles, a scorekeeper for card night, an oven door repaired with a home-written guide, a family travel desk, home-made learning games. Most were built with an AI on a weekend, for an audience of one family. The policy is pinned to the board: it must ship; see rule one.

![The side-quest wall: a cork board, a poster, a bench](/img/studio-quests.jpg)

## Project Sub-2:55

The marathon gets its own corner: racing shoes under the window, a race number that is really a target, a medal on the window handle, and a training log on the sill. The log opens like the dossiers do, and it is written the way I would write up any programme: a baseline (Milan, 3:10, lost at the start line), an honest forecast (possible, not probable), stage gates that decide the race pace, a RAID log, and a status report with eighteen weeks of distance from Strava.

![The training log, open at the status report](/img/studio-runlog.jpg)

## The legend

Sit at the desk for the first time and the display tells a story: *The Legend of the AI Program Manager*, one minute, narrated by a wise old storyteller who has clearly sat through a few steering committees.

<video controls preload="none" poster="/media/legend-poster.jpg" style="width:100%;height:auto;border-radius:14px;background:#000">
  <source src="/media/legend.mp4" type="video/mp4">
  <track kind="captions" src="/media/legend.vtt" srclang="en" label="English" default>
</video>

The script is mine. The voice is a preset text-to-speech voice; the eight pictures were made with an image model; the last shot is the studio itself. Everything else is assembled by a script: slow camera moves over the stills, captions timed from a forced alignment of the narration, and a small score (a drone, four chords and a plucked string) synthesised with numpy.

## What was generated, and by what

Worth being exact about, on a site about applied AI:

- **Image model** (GPT Image, through Higgsfield): the film's eight stills, the poster on the wall, the crayon drawing, two photo prints on the cork board, three fabric and rug textures, and the restyled weather in the two window photos.
- **Text-to-speech** (a preset voice, through Higgsfield): the film's narration.
- **Code**: everything else. The room, the cloth, the light, the rain, the pages, the score, and the jokes.

## Adoption

The studio also measures its own adoption, because of course it does: a small meter in the toolbar counts the things you have tried, and remembers them in your browser only. It is at zero until you sit down.
