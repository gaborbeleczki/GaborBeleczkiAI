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
  lead: 'A marathon goal, run like a programme: under two hours fifty-five, in Rotterdam in spring 2027.',
  kpis: [
    { value: '3:10', label: 'Marathon best, Milan, April 2026: the baseline' },
    { value: '2:55', label: 'The goal, Rotterdam, spring 2027' },
  ],
  lesson: 'Milan didn’t fail at km 26. It failed at the start line.',
  lessonText: 'The first half went out at half-marathon pace and the second half sent the invoice. The fix is the same as in any programme: set the target from measured capacity, not from the date on the poster.',
  plan: 'Three runs a week, because the rest of the week belongs to work and family: one hard, one steady, one long. A test race closes each phase and sets the pace for the next.',
  phases: [
    { n: '01', title: 'Rebuild', text: 'Volume back, legs reintroduced to the idea.' },
    { n: '02', title: 'Threshold', text: 'More time at the pace that is hard but repeatable.' },
    { n: '03', title: 'Specific', text: 'Marathon pace inside the long runs.' },
    { n: '04', title: 'Taper', text: 'Less running, more waiting. Change management for the legs.' },
  ],
  status: `On track: ${total} km since mid-July, and eighteen weeks without a missed one.`,
  teaches: [
    '**Start slower than the plan lets you.** The first half is where projects and marathons are lost.',
    '**Consistency beats heroics.** Eighteen ordinary weeks outperform one legendary one.',
    '**A taper is not laziness.** Doing less, on purpose, is how the work shows up on the day.',
  ],
  weeks,
  /** where the plan begins on the chart */
  planFrom: 10,
  chartAlt: `Eighteen weeks of running: from 14 km in the first week back to 68 km in the week of 9 November, with long runs growing from 7 km to 30.7 km. The plan starts in week 11.`,
};
