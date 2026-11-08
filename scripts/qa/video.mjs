// Record a short looping clip of the studio for the static page's hero (and as a demo):
// frames are stepped deterministically through window.__studio, then encoded with FFmpeg.
//   node scripts/qa/video.mjs   ->  public/media/studio-loop.mp4
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, browser, serve, waitForStudio } from './lib.mjs';

const W = Number(process.env.VIDEO_W || 1280);
const H = Number(process.env.VIDEO_H || 720);
const FPS = 24;
const SECONDS = Number(process.env.VIDEO_SECONDS || 12);

export async function video(base) {
  const frames = path.join(ROOT, 'renders', 'frames');
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${base}/?studio&capture&evening`, { waitUntil: 'load' });
  await waitForStudio(page);
  // hide the HUD for the clip, settle the intro, then glance slowly around the room
  await page.addStyleTag({ content: '.hud,.spots{display:none!important}' });
  await page.evaluate(() => {
    window.__studio.step(1 / 30, 120);
    window.__studio.drift(true);
    window.__studio.step(1 / 30, 30);
  });
  const total = FPS * SECONDS;
  const canvas = page.locator('canvas.studio__gl');
  for (let i = 0; i < total; i++) {
    await page.evaluate((dt) => window.__studio.step(dt, 1), 1 / FPS);
    await canvas.screenshot({ path: path.join(frames, `f${String(i).padStart(4, '0')}.png`) });
  }
  await b.close();
  const out = path.join(ROOT, 'public', 'media');
  fs.mkdirSync(out, { recursive: true });
  const input = ['-y', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.png')];
  execFileSync('ffmpeg', [...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', '-an', path.join(out, 'studio-loop.mp4')], { stdio: 'ignore' });
  // H.264 plays everywhere and came out smaller than VP9 for this clip, so it is the only source
  const size = (f) => Math.round(fs.statSync(path.join(out, f)).size / 1024);
  return { frames: total, mp4KB: size('studio-loop.mp4') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const srv = await serve(4325);
  const res = await video(srv.url);
  srv.close();
  console.log('[video]', res);
}
