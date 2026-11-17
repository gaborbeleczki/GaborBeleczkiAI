// Side quest no. 1: a marathon plan, written up the way a programme manager would.
// The numbers are a snapshot (16 Nov 2026) of my own training: race results and weekly
// distances from Strava, the plan from my training notes. No heart rate, no health data,
// no clock times: just distance, pace and intent.

export interface RunWeek {
  /** the Monday the week starts on, for the axis */
  label: string;
  /** kilometres run that week */
  km: number;
  /** the longest run of the week, km */
  long: number;
  note?: string;
}

/** Eighteen weeks, Monday to Sunday, 13 July to 15 November 2026. */
const weeks: RunWeek[] = [
  { label: '13 Jul', km: 14.0, long: 7.0, note: 'back to running' },
  { label: '20 Jul', km: 39.6, long: 24.0 },
  { label: '27 Jul', km: 35.5, long: 16.7 },
  { label: '3 Aug', km: 42.3, long: 26.4 },
  { label: '10 Aug', km: 25.9, long: 10.0 },
  { label: '17 Aug', km: 8.3, long: 8.3, note: 'the week the dashboard does not mention' },
  { label: '24 Aug', km: 28.0, long: 18.2 },
  { label: '31 Aug', km: 31.9, long: 21.2 },
  { label: '7 Sep', km: 45.3, long: 22.2 },
  { label: '14 Sep', km: 41.0, long: 21.5 },
  { label: '21 Sep', km: 47.3, long: 23.9, note: 'the plan starts' },
  { label: '28 Sep', km: 32.0, long: 21.3 },
  { label: '5 Oct', km: 55.8, long: 22.7, note: 'relay: 22.7 km at 4:24/km' },
  { label: '12 Oct', km: 48.3, long: 25.2 },
  { label: '19 Oct', km: 63.8, long: 28.5 },
  { label: '26 Oct', km: 29.6, long: 20.1, note: 'travel week' },
  { label: '2 Nov', km: 66.4, long: 30.0, note: '30 km' },
  { label: '9 Nov', km: 68.0, long: 30.7, note: '30 km, at night, on purpose' },
];

const total = Math.round(weeks.reduce((a, w) => a + w.km, 0));

export const run = {
  title: 'Project Sub-2:55',
  goal: '2:55',
  race: 'Rotterdam, spring 2027',
  lead: 'A marathon plan run like a programme: a baseline, an honest forecast, stage gates, a RAID log and a go-live date in Rotterdam in spring 2027.',
  kpis: [
    { value: '3:10:28', label: 'Marathon best, Milan, April 2026: the baseline' },
    { value: '1:28:19', label: 'Half marathon best, March 2026' },
    { value: '20:00', label: '5K best, May 2026' },
    { value: '2:54:59', label: 'Target, Rotterdam, spring 2027' },
  ],
  lesson: 'Milan didn’t fail at km 26. It failed at the start line.',
  lessonText: [
    'I ran the first 21 km at the pace of my half-marathon race three weeks earlier. The second half sent the invoice: about thirteen minutes slower than the first.',
    'Root cause: optimism, presented as a pacing plan. The fix is the same as in any programme: set the target from measured capacity, not from the date on the poster.',
  ],
  forecast: 'Sub-2:55 in spring is possible, not probable.',
  forecastText: [
    'Fitness today reads VDOT 49. A 2:55 marathon needs 55: about six points in thirty weeks, on three running days. If the block goes well, the realistic range is 2:57 to 3:03.',
    'The steering committee (me) has approved the stretch target anyway, on one condition: the test races decide the race pace, not the poster.',
  ],
  plan: 'Thirty weeks from 21 September. Three running days, because the rest of the week belongs to work and family. Volume is the lever with the strongest link to marathon time, so the long run does the heavy lifting.',
  week: [
    { n: 'TUE', title: 'Threshold, twice', text: 'Repetitions at threshold pace in the morning, an easy run at night. The session progress is measured on.' },
    { n: 'FRI', title: 'Steady', text: 'A medium run, now finishing with a few kilometres at marathon pace.' },
    { n: 'SUN', title: 'Long', text: '20 to 35 km, easy, with a steady finish. Pace is allowed to come; it is not fetched.' },
  ],
  phases: [
    { n: '01', title: 'Rebuild', text: 'Volume back, legs reintroduced to the idea.' },
    { n: '02', title: 'Threshold', text: 'More time at the pace that is hard but repeatable.' },
    { n: '03', title: 'Specific', text: 'Marathon pace inside long runs. Dress rehearsals.' },
    { n: '04', title: 'Taper', text: 'Less running, more waiting. Change management for the legs.' },
  ],
  governance: 'Every test is a stage gate. A 10K in December sets the paces for the winter; the spring half marathon sets the race tier; two long rehearsals confirm it. Miss a gate and the goal drops a tier, without a meeting.',
  tiers: [
    ['A', '1:24:15 or faster', '2:54:30 to 2:55:59', '4:08 to 4:10'],
    ['B', 'to 1:25:40', '2:56 to 2:59', '4:11 to 4:14'],
    ['C', 'to 1:27:05', '2:59 to 3:02', '4:15 to 4:18'],
    ['D', 'to 1:29:00', '3:02 to 3:07', '4:19 to 4:25'],
  ],
  gates: [
    '**10K test, December.** Decides the training paces for weeks 11 to 18.',
    '**Half marathon, March.** Sets the tier. The table above is the whole negotiation.',
    '**35 km durability run.** Marathon pace late in the run, or more easy volume first.',
    '**Dress rehearsal, two weeks out.** The last 5 km at tier pace feel controlled, or the goal drops one tier.',
  ],
  status: `On track. ${total} km since mid-July, eighteen weeks without a missed one, and two 30 km runs in the last fortnight: one of them at night, on purpose.`,
  totals: [
    { value: `${total} km`, label: 'Run in the 18 weeks to 15 November' },
    { value: '68 km', label: 'Biggest week so far' },
    { value: '30.7 km', label: 'Longest run, at 5:10/km' },
    { value: '4:24/km', label: 'Relay leg, 22.7 km, Budapest Marathon Relay (team: 10th)' },
  ],
  teaches: [
    '**Start slower than the plan lets you.** The first half is where projects and marathons are lost.',
    '**Measure before you believe.** A forecast is a number with its error bars, not a wish.',
    '**Consistency beats heroics.** Eighteen ordinary weeks outperform one legendary one.',
    '**A taper is not laziness.** Doing less, on purpose, is how the work shows up on the day.',
  ],
  weeks,
  /** where the 30-week plan begins on the chart */
  planFrom: 10,
  chartAlt: `Eighteen weeks of running: from 14 km in the first week back to 68 km in the week of 9 November, with long runs growing from 7 km to 30.7 km. The plan starts in week 11.`,
};

/** Risks, assumptions, issues, dependencies. */
export const raid: string[][] = [
  ['Risk', 'Winter. Also December.', 'Run anyway. Gloves are in the budget.'],
  ['Assumption', 'That a 30 km run can start after dinner.', 'Validated twice. Sleep disagrees.'],
  ['Issue', 'Sunday long runs compete with Sunday.', 'Negotiated weekly, at breakfast.'],
  ['Dependency', 'Dry socks, a charged watch, a forgiving family.', 'Two of three are under my control.'],
];
