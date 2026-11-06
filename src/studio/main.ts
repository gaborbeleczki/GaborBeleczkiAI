import { Studio, type StudioOptions } from './studio.ts';

/** Entry point used by the page: builds the 3D studio inside `host`. */
export async function mountStudio(host: HTMLElement, opts: StudioOptions): Promise<{ dispose(): void }> {
  host.replaceChildren();
  let studio: Studio;
  try {
    studio = new Studio(host, opts);
  } catch (err) {
    console.error('[studio] WebGL unavailable', err);
    throw new Error('webgl');
  }
  try {
    await studio.load();
  } catch (err) {
    console.error('[studio] assets failed', err);
    studio.dispose();
    throw err;
  }
  studio.start();
  return { dispose: () => studio.dispose() };
}
