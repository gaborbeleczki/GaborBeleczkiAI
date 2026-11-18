---
title: Side quests and a legend
date: 2026-11-16
summary: The studio got warmer and less serious — a throw draped by a cloth simulation, rain on the window, a cork board of side quests, a marathon plan run like a programme, and a one-minute film about a quest.
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

*A day later:* the rain made the window too busy, so the glass now stays dry unless you ask for it with `?rain`. The view holds still too, and only tram 2 and the boats on the river move through it, slowly. The picture above was taken with the rain on.

## Side quests

Turn around (press Q, or use *Side quests* in the toolbar) and there is a cork board. None of it was on the roadmap; all of it shipped: a city break with a KPI (dwarfs found), kitchen-table maths puzzles, a scorekeeper for card night, an oven door repaired with a home-written guide, a family travel desk, home-made learning games. Most were built with an AI on a weekend, for an audience of one family. Pick a card and it opens with a sketch of the project's screen, what it does and what it is made of. The policy is pinned to the board: it must ship; see rule one.

![The side-quest wall: a cork board, a poster, a bench](/img/studio-quests.jpg)

## Project Sub-2:55

The marathon gets its own corner: racing shoes under the window, a race number that is really a target, a medal on the window handle, and a training log on the sill. The log opens like the dossiers do, and it is written the way I would write up any programme, kept short: a baseline (Milan, 3:10, lost at the start line), the plan in four phases, and a status report with eighteen weeks of distance from Strava.

![The training log, open at the status report](/img/studio-runlog.jpg)

## The legend

Sit at the desk for the first time and the display plays a one-minute film, *The Quest*. A gust of wind tears a page from an old tome. It sails into a scriptorium just as a tower of scrolls collapses, and the hero catches it. He wakes a sleeping council by slamming it on the table, where it turns out to be a map; heads down from a hilltop at dawn towards Budapest; plants a flag that sorts a mountain of scrolls into ordered stacks; lights three rings over a hall of students; and watches a dragon seal the deal with a wax stamp, in a burst of sparks. At night by the Danube he drops the cloak and runs, in black kit, the Chain Bridge behind him.

<video controls preload="none" poster="/media/legend-poster.jpg" style="width:100%;height:auto;border-radius:14px;background:#000">
  <source src="/media/legend.mp4" type="video/mp4">
  <track kind="captions" src="/media/legend.vtt" srclang="en" label="Sounds and scenes">
</video>

It has no dialogue: wind, paper, fire and footsteps over a low string-and-drum score, levelled to −16 LUFS. One hero carries it from the first shot to the last: a reference sheet of him came first, and every shot was made from it, so his face, cloak and staff stay the same. Things happen in every shot, and the shots flow into each other: the page carries from scene to scene, and the map on the council table dissolves into the map on the hilltop. The site plays the master as it is, without re-encoding it. (An earlier cut, narrated by a wise old storyteller over eight separate scenes, is kept in the repository with the script that assembled it.)

## What was generated, and by what

Worth being exact about, on a site about applied AI:

- **The film**, *The Quest* (through Higgsfield): a reference sheet of the hero, then every shot generated from it with a video model.
- **Image model** (GPT Image, through Higgsfield): eight stills for the film's first cut (one of them, cropped, is the portrait in the Hello dossier), the poster on the wall, the crayon drawing, two photo prints on the cork board, three fabric and rug textures, and the restyled weather in the two window photos.
- **Code**: everything else. The room, the cloth, the light, the rain, the pages, the music in the room, and the jokes.

## Adoption

The studio also measures its own adoption, because of course it does: a small meter in the toolbar counts the things you have tried, and remembers them in your browser only. It is at zero until you sit down.
