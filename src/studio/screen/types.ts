import type { FolioId } from '../../../content/profile.ts';
import type { Rect, Regions } from './kit.ts';

export interface ModuleContext {
  regions: Regions;
  hover: string | null;
  reduceMotion: boolean;
  photo: HTMLImageElement | null;
  open(id: FolioId): void;
  link(url: string, newTab?: boolean): void;
  copy(text: string): void;
  pageView(): void;
  announce(text: string): void;
}

/**
 * One chapter on the display. Each module owns its state, draws into the shared canvas,
 * takes pointer and keyboard input, and cleans up after itself on unmount.
 */
export interface ScreenModule {
  readonly id: FolioId;
  readonly title: string;
  mount(ctx: ModuleContext): void;
  unmount(): void;
  /** Advance animations; return true when the screen needs a redraw. */
  update(dt: number, t: number): boolean;
  draw(g: CanvasRenderingContext2D, area: Rect, ctx: ModuleContext): void;
  key?(e: KeyboardEvent): boolean;
  /** Plain-text summary for screen readers. */
  describe(): string;
}
