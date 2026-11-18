// The lighter layer of the studio: what the room says back when you touch things.
// House rules for everything in this file: kind, true to the work, no names, nothing an HR
// partner would have to forward to anyone. The jokes are about spreadsheets, meetings and
// running, never about colleagues or an employer.

import type { FolioId } from './profile.ts';

/** Lines under the loader while the studio arrives. */
export const loadingLines = [
  'Converting meetings into prompts…',
  'Prioritising a thousand use cases…',
  'Asking Risk nicely…',
  'Aligning stakeholders (and lightmaps)…',
  'Lighting the candle…',
  'Tying the running shoes…',
  'Counting dwarfs…',
  'Rounding to two decimals…',
];

/** While a dossier flies off the shelf. */
export const openingLines = [
  'Opening… no approval needed',
  'Opening… this one is not a PDF',
  'Opening… zero dependencies',
  'Opening… already through governance',
  'Opening… mind the cables',
  'Opening… pages turn like pages',
];

/** A handwritten note stuck into each dossier (and the notebook). */
export const stickies: Record<FolioId | 'notebook', { lines: string[]; color?: string; tilt?: number }[]> = {
  hello: [{ lines: ['Yes, this is a dossier', 'inside a room inside a browser.', 'The roadmap got out of hand.'], tilt: -2.5 }],
  approach: [
    { lines: ['Step 0: ask if it needs', 'AI at all. Sometimes it', 'needs a better spreadsheet.'], tilt: 2 },
    { lines: ['Adoption, honest version:', 'flat, flat, flat,', '“who approved this?”, hockey stick.'], color: '#F6BEC4', tilt: -2 },
  ],
  role: [{ lines: ['Job, translated:', '“Can AI do this?” becomes', '“What are we solving?”'], tilt: -2 }],
  work: [
    { lines: ['Chart options considered:', 'pie (rejected), 3D pie', '(rejected with prejudice).'], tilt: 2.5 },
    { lines: ['No use case was harmed', 'in the making of', 'this portfolio.'], color: '#CFE3C6', tilt: -1.5 },
  ],
  career: [{ lines: ['15 years in finance.', 'I have seen circular references', 'you people would not believe.'], tilt: -2 }],
  toolkit: [{ lines: ['Most used tool, still:', '“Have you tried asking it', 'more clearly?”'], tilt: 2 }],
  faq: [{ lines: ['Question zero:', '“Will AI take my job?”', 'Today it takes the minutes.'], tilt: -2.5 }],
  contact: [{ lines: ['Response time: faster than', 'a steering committee, slower', 'than autocomplete.'], tilt: 2 }],
  notebook: [{ lines: ['If you read build notes', 'for fun, you are', 'my kind of person.'], color: '#F6BEC4', tilt: -2 }],
};

export interface Caption {
  title: string;
  text: string;
}

/** Things in the room that answer when used. */
export const captions = {
  globe: {
    title: 'A global network',
    text: 'The Global AI Innovator programme: 80+ innovators and ambassadors, a hub-and-spoke network of AI champions across regions. Give the sphere a spin: the only global roll-out with no time-zone conflicts.',
  },
  coffee: {
    title: 'Coffee in Budapest?',
    text: 'Fuel for a thousand use cases. Always up for a conversation about applied AI, enablement and adoption, over coffee in Budapest or on a call. Decaf is handled as a policy exception.',
  },
  musicOn: { title: 'Budapest sessions', text: 'Lounge deep house, generated live in your browser. No playlist was harmed. Now playing.' },
  musicOff: { title: 'Budapest sessions', text: 'Lounge deep house, generated live in your browser. Stopped. The silence is also original.' },
  print: { title: '“Duna”', text: 'A print drawn for the studio in the site’s palette: a low sun, layered hills, the river. The Danube is the one stakeholder that never asks for a status update.' },
  throw: { title: 'Status: cozy', text: 'A cable-knit throw, draped by an actual cloth simulation. The most successful change-management tool in the room: nobody has ever resisted it.' },
  pouf: { title: 'Stakeholder seating', text: 'Low, soft, and close to the plant. Ideal for conversations that start with “quick question”.' },
  drawing: {
    title: 'Commissioned artwork',
    text: '“Robot helps the runner finish.” Crayon on paper, taped at the artist’s eye level. The artist was paid in pancakes and keeps all rights.',
  },
  shoes: {
    title: 'Megablasts, parked',
    text: 'ASICS Megablast, in the green of the Ekiden colourway: the tallest stack in the shoe cupboard. They have opinions about the plan: sub-2:55 in Rotterdam in spring 2027, three runs a week.',
  },
  bib: {
    title: '255',
    text: 'A target, not a bib number: two hours fifty-five. The forecast says “possible, not probable”. The steering committee (me) approved the stretch goal anyway.',
  },
  medal: {
    title: 'Finisher, Milan',
    text: 'April 2026, 3:10. The first half went by at half-marathon pace; the second half was the invoice. The lessons learned are in the training log.',
  },
  quests: { title: 'Side quests', text: 'None of these were on the roadmap. All of them shipped.' },
  poster: {
    title: '“The Dragon of Risk reviews the checklist”',
    text: 'Oil on GPU, 2026. It read the whole governance framework. It had comments. They were good comments.',
  },
  kettlebell: { title: 'Strength work', text: 'Twice a week, so the marathon does not get all the attention. It also holds the door open during deep work.' },
  padel: { title: 'Padel', text: 'Like a stakeholder meeting, except the walls are in play and everybody leaves happy.' },
  bench: { title: 'The bench', text: 'Card night lives here. So does anyone who came with a quick question and stayed for the roadmap.' },
} satisfies Record<string, Caption>;

/** A card on the cork board: the joke, and (for a closer look) what the thing does, what is in
 *  it, and how it was made. Written from the projects themselves, without names, ages or dates. */
export interface QuestCard extends Caption {
  what?: string;
  parts?: string[];
  built?: string;
}

/** The cards on the cork board. */
export const questCards: Record<string, QuestCard> = {
  banner: {
    title: 'Side quests',
    text: 'None of these were on the roadmap. All of them shipped. Most were built with Claude on a weekend, for an audience of one family.',
    what: 'Pick a card: each one says what the thing does, what is in it, and how it was made.',
  },
  dwarf: {
    title: 'City break, with a KPI',
    text: 'Wrocław hides hundreds of bronze dwarfs. The junior team set the target (find more than last time) and audited the count.',
    what: 'A planner for a long family weekend in Wrocław: every day on a map, the weather, what things cost in forints, and a hunt for the bronze dwarfs, with a short story for each one.',
    parts: ['A map of the day’s stops, and the dwarfs nearby', 'A day-by-day plan you can reshuffle', 'The dwarf hunt: a checklist and a story per dwarf', 'Menus and prices in forints, a running budget', 'Getting around, flights and the hotel, in one place'],
    built: 'One web page with a live map, built with Claude. The plan saves itself; the dwarfs were found on foot.',
  },
  maths: {
    title: 'Kitchen-table maths olympiad',
    text: 'Nine sticks, how many triangles? Competition puzzles, turned into small interactive explainers, then corrected by someone much shorter than me.',
    what: 'Photograph a competition puzzle, and get back a small page that explains it: the answer checked by counting every case, and a way through it that a young solver can poke at.',
    parts: ['The puzzle redrawn, with pieces you can move', 'Hints that open one at a time', 'An answer checked by brute force, not by confidence', 'A second way to see it, for when the first one does not land'],
    built: 'A reusable Claude skill: photo in, verified explainer out. A dozen puzzles so far, in Hungarian.',
  },
  score: {
    title: 'Card night',
    text: 'A home-built scorekeeper, so nobody argues about the adding up. Requirements changed mid-sprint: “add a button for when I win”.',
    what: 'A scorekeeper for Flip 7: tap the cards each player kept and the modifiers, and it does the adding up, the doubling, the busts and the bonus for seven cards.',
    parts: ['A grid of number cards and modifiers for each player', 'Bust and the seven-card bonus built in', 'Running totals with a bar to the finish line', 'Round history, undo, and a new game', 'It remembers the game if the phone locks'],
    built: 'One page, no install, built with Claude in an evening. The “I win” button is still under review.',
  },
  padel: {
    title: 'Padel',
    text: 'Like a stakeholder meeting, except the walls are in play and everybody leaves happy. Thursdays, usually.',
    what: 'Not software. An hour a week where the walls are in play and nobody brings a status update.',
    parts: ['Doubles: shared ownership, by design', 'A racket that has seen things', 'Thursdays, usually'],
    built: 'Built with legs. No AI involved, apart from finding a court.',
  },
  oven: {
    title: 'Home repairs',
    text: 'The oven door glass: replaced, following a step-by-step guide written for exactly one reader. Two screws remain unallocated. No incidents since go-live.',
    what: 'An interactive service guide for replacing a cracked oven-door glass, with a straight answer to the real question first: do it yourself, or call the service?',
    parts: ['An exploded diagram of the door that lights up the parts for each step', 'Eleven steps with tick-boxes the browser remembers', 'Do it yourself against the fixed-price repair, compared', 'Every step marked: from the manual, or worked out from the diagram', 'Safety notes where the glass can bite'],
    built: 'Built with Claude from the manual of a sister model and the parts diagram, in Hungarian.',
  },
  travel: {
    title: 'Family travel desk',
    text: 'Flights, seats and connections, compared and stress-tested so that everyone sits together. Acceptance criterion: nobody cries before take-off. Including me.',
    what: 'A flight planner for a family that travels together: routes priced for the whole group, seats together and bags included, ranked by what matters with children on board.',
    parts: ['A map of destinations, with a price for everyone', 'Return, one-way and multi-city trips', 'Best for a family, cheapest, fastest, kindest departure times', 'Sitting together and the bags, in the price', 'A shortlist from a fare model, then a link to the live search'],
    built: 'One web page with its own world map and fare model, built with Claude. The booking happens elsewhere.',
  },
  games: {
    title: 'Home-made learning games',
    text: 'Letters, numbers and traffic rules, as small games. The toughest user panel I know: feedback is instant, honest, and arrives without slides.',
    what: 'Small games for letters and traffic rules, and a floodlit football match for after the homework.',
    parts: ['Letter champion: letters and first words, as a game', 'City traffic rules: signs and right of way, as a game', 'Floodlight Cup: eleven-a-side football in 3D, with a crowd that cheers', 'Big buttons, no accounts, no ads'],
    built: 'HTML and JavaScript (three.js for the stadium), built with Claude, tested by the most honest panel in the house.',
  },
  snow: {
    title: 'Snow trip',
    text: 'Lifts, lessons and the hot-chocolate budget on one board. Packing list v7 is final. So was v6.',
    what: 'A planner for a family ski trip: who skis when, which lessons, which lifts, what to pack and what it all costs.',
    parts: ['A day plan: lessons, lifts and breaks', 'A packing list, on its seventh version', 'A budget, with a line for hot chocolate', 'Snow and weather, checked once too often'],
    built: 'One page, built with Claude. Version eight of the packing list is in review.',
  },
  policy: {
    title: 'The side-quest policy',
    text: '1. It must ship. 2. See rule 1. The same policy applies at work, with more approvals and better documentation.',
    what: 'The only governance on this wall.',
    parts: ['1. It must ship.', '2. See rule 1.'],
    built: 'Applied at work too, with more approvals and better documentation.',
  },
};

/** Notifications on the phone's lock screen; two show at a time. */
export const phoneNotes = [
  { app: 'Calendar', text: 'Steering committee moved. It is now a prompt.' },
  { app: 'Strava', text: '30 km done. Your legs have filed a ticket.' },
  { app: 'Dashboard', text: 'Which chart shows this best? Never the pie.' },
  { app: 'Reminders', text: 'Oven screws: 2 left over. Investigate?' },
  { app: 'Messages', text: '“Can the robot do my homework?” It can explain it.' },
  { app: 'Padel', text: 'Thursday. The glass is in play.' },
];

export const cardBackLine = 'Could this meeting have been a prompt?';

/** The studio measures its own adoption, of course. */
export interface Achievement {
  id: string;
  title: string;
  /** shown once it is earned */
  line: string;
  /** shown before it is earned */
  hint: string;
}

export const achievements: Achievement[] = [
  { id: 'desk', title: 'Stakeholder seated', line: 'You sat down at the desk.', hint: 'Sit at the desk.' },
  { id: 'dossier', title: 'Voluntary reading', line: 'You opened a dossier without being asked.', hint: 'Take a dossier from the shelf.' },
  { id: 'finisher', title: 'Read to the end', line: 'You reached the last page of something. Rare.', hint: 'Turn to the last page of a dossier.' },
  { id: 'legend', title: 'Saw the quest', line: 'You watched the film on the display.', hint: 'Watch the film on the display.' },
  { id: 'window', title: 'Touched grass, visually', line: 'You looked out at Budapest.', hint: 'Look out of the window.' },
  { id: 'lights', title: 'Changed the weather', line: 'You switched between day and evening.', hint: 'Switch the light.' },
  { id: 'music', title: 'Focus time', line: 'You put a record on.', hint: 'Put a record on.' },
  { id: 'hands', title: 'Hands-on', line: 'You picked something up from the desk.', hint: 'Pick something up from the desk.' },
  { id: 'sphere', title: 'Global roll-out', line: 'You spun the sphere.', hint: 'Spin the brass sphere.' },
  { id: 'quests', title: 'Scope creep', line: 'You found the side-quest wall.', hint: 'Turn around.' },
  { id: 'cards', title: 'Due diligence', line: 'You read five cards on the cork board.', hint: 'Read five cards on the cork board.' },
  { id: 'runlog', title: 'Went the distance', line: 'You opened the training log.', hint: 'Open the training log on the window sill.' },
];

export const adoptionDone = 'Adoption 100%. You are now an AI Champion of this studio. Certificate: none. Bragging rights: unlimited.';
