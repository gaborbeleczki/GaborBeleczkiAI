import { achievements, type Achievement } from '../../../content/gags.ts';

// The studio measures its own adoption (of course it does): a dozen small firsts, remembered
// in this browser only. Nothing is sent anywhere.

const KEY = 'gb.studio.adoption.v1';
const SEEN = 'gb.studio.legend.v1';

export class Adoption {
  private readonly done = new Set<string>();
  private readonly cards = new Set<string>();

  constructor(private readonly onEarn: (a: Achievement, percent: number, complete: boolean) => void) {
    try {
      for (const id of JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]) if (achievements.some((a) => a.id === id)) this.done.add(id);
    } catch {
      /* private mode: the meter simply starts at zero every time */
    }
  }

  get percent(): number {
    return Math.round((this.done.size / achievements.length) * 100);
  }

  get count(): number {
    return this.done.size;
  }

  list(): { a: Achievement; done: boolean }[] {
    return achievements.map((a) => ({ a, done: this.done.has(a.id) }));
  }

  /** A first: counted once, announced once. */
  mark(id: string): void {
    const a = achievements.find((x) => x.id === id);
    if (!a || this.done.has(id)) return;
    this.done.add(id);
    try {
      localStorage.setItem(KEY, JSON.stringify([...this.done]));
    } catch {
      /* nothing to do */
    }
    this.onEarn(a, this.percent, this.done.size === achievements.length);
  }

  /** A card on the cork board was read; five of them make an achievement. */
  card(key: string): void {
    this.cards.add(key);
    if (this.cards.size >= 5) this.mark('cards');
  }

  /** Has the intro film been offered in this browser before? */
  static legendSeen(): boolean {
    try {
      return localStorage.getItem(SEEN) === '1';
    } catch {
      return false;
    }
  }

  static setLegendSeen(): void {
    try {
      localStorage.setItem(SEEN, '1');
    } catch {
      /* nothing to do */
    }
  }
}
