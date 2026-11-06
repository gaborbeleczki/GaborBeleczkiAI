export interface GameDuty {
  n: string;
  t: string;
  d: string;
  s: 'circle' | 'diamond' | 'hex' | 'square' | 'tri';
  x: number;
  y: number;
}

export type GamePhase = 'ready' | 'playing' | 'paused' | 'flag' | 'walk' | 'won' | 'over';

export interface GameStats {
  got: number;
  coins: number;
  stomps: number;
  time: string;
}

export interface GameApi {
  start(): void;
  resume(): void;
  pause(): void;
  restart(): void;
  press(k: 'left' | 'right' | 'jump' | 'run', down: boolean): void;
  reveal(): void;
  tick(dt: number): void;
  key(e: { code: string; preventDefault(): void }, down: boolean): boolean;
  readonly phase: GamePhase;
  player(): { x: number; y: number; lvl: number };
  stats(): GameStats;
  destroy(): void;
}

export function mount(
  host: HTMLElement | null,
  opts: {
    duties: GameDuty[];
    reduce?: boolean;
    keyTarget?: HTMLElement;
    hudRoot?: HTMLElement;
    canvas?: HTMLCanvasElement;
    size?: { w: number; h: number };
    manual?: boolean;
    onCollect?(i: number): void;
    onPhase?(phase: GamePhase, stats: GameStats): void;
  },
): GameApi;
