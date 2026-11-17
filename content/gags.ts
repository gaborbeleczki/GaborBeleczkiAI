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
    title: 'Racing shoes, parked',
    text: 'They have opinions about the plan. The plan is sub-2:55 in Rotterdam in spring 2027, three running days a week, with a governance gate at every test race.',
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

/** The cards on the cork board. */
export const questCards: Record<string, Caption> = {
  banner: { title: 'Side quests', text: 'None of these were on the roadmap. All of them shipped. Most were built with Claude on a weekend, for an audience of one family.' },
  dwarf: {
    title: 'City break, with a KPI',
    text: 'Wrocław hides hundreds of bronze dwarfs. The junior team set the target (find more than last time) and audited the count. The itinerary was planned with an AI; the dwarfs were found on foot.',
  },
  maths: {
    title: 'Kitchen-table maths olympiad',
    text: 'Nine sticks, how many triangles? I turn competition puzzles into small interactive explainers, then get corrected by someone much shorter than me.',
  },
  score: {
    title: 'Card night',
    text: 'A home-built scorekeeper, so nobody argues about the adding up. Requirements changed mid-sprint: “add a button for when I win”. Shipped the same evening.',
  },
  padel: { title: 'Padel', text: 'Like a stakeholder meeting, except the walls are in play and everybody leaves happy. Thursdays, usually.' },
  oven: {
    title: 'Home repairs',
    text: 'The oven door glass: replaced, following a step-by-step guide written for exactly one reader. Two screws remain unallocated. No incidents since go-live.',
  },
  travel: {
    title: 'Family travel desk',
    text: 'Flights, seats and connections, compared and stress-tested so that everyone sits together. Acceptance criterion: nobody cries before take-off. Including me.',
  },
  games: {
    title: 'Home-made learning games',
    text: 'Letters, numbers and traffic rules, as small games. The toughest user panel I know: feedback is instant, honest, and arrives without slides.',
  },
  snow: { title: 'Snow trip', text: 'Lifts, lessons and the hot-chocolate budget on one board. Packing list v7 is final. So was v6.' },
  policy: { title: 'The side-quest policy', text: '1. It must ship. 2. See rule 1. The same policy applies at work, with more approvals and better documentation.' },
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
  { id: 'legend', title: 'Heard the legend', line: 'You watched the film on the display.', hint: 'Watch the film on the display.' },
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
