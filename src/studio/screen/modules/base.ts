import type { FolioId } from '../../../../content/profile.ts';
import type { Rect } from '../kit.ts';
import type { ModuleContext, ScreenModule } from '../types.ts';

export abstract class BaseModule implements ScreenModule {
  abstract readonly id: FolioId;
  abstract readonly title: string;
  protected ctx!: ModuleContext;
  protected age = 0;
  protected animating = true;

  mount(ctx: ModuleContext): void {
    this.ctx = ctx;
    this.age = 0;
    this.animating = !ctx.reduceMotion;
    this.onMount();
  }

  unmount(): void {
    this.onUnmount();
  }

  update(dt: number, t: number): boolean {
    this.age += dt;
    return this.tick(dt, t);
  }

  /**
   * Entrance progress. Chapters appear at once: the display cross-fades between them and
   * nothing slides in (kept as a hook so modules read the same either way).
   */
  protected enter(_delay = 0, _dur = 0.6): number {
    return 1;
  }

  protected onMount(): void {}
  protected onUnmount(): void {}
  protected tick(_dt: number, _t: number): boolean {
    return this.animating && this.age < 2.5;
  }

  abstract draw(g: CanvasRenderingContext2D, area: Rect, ctx: ModuleContext): void;
  abstract describe(): string;
  key?(e: KeyboardEvent): boolean;
  keyUp?(e: KeyboardEvent): boolean;
  pointer?(x: number, y: number, type: 'move' | 'down' | 'up' | 'leave'): boolean;
  attention?(on: boolean): void;
}
