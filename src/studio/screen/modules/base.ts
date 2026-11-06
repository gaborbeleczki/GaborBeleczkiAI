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

  /** Entrance progress 0..1 over `dur` seconds (1 immediately with reduced motion). */
  protected enter(delay = 0, dur = 0.6): number {
    if (!this.animating) return 1;
    return Math.max(0, Math.min(1, (this.age - delay) / dur));
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
