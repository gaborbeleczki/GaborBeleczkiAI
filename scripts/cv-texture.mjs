// The printed CV on the desk: render the original one-page CV (public/page/cv/) to an A4 image
// that Blender maps onto the top sheet (blender/out/art/cv_page.png, 1540 × 2150).
// Usage: node scripts/cv-texture.mjs   (before blender/build_scene.py)
import fs from 'node:fs';
import path from 'node:path';
import { browser, ROOT } from './qa/lib.mjs';

const SRC = path.join(ROOT, 'public', 'page', 'cv', 'index.html');
const OUT = path.join(ROOT, 'blender', 'out', 'art', 'cv_page.png');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const b = await browser();
const page = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
await page.goto('file://' + SRC, { waitUntil: 'load' });
// the bundled page unpacks itself after load
await page.waitForTimeout(2500);
const box = await page.evaluate(() => {
  const pg = document.querySelector('section.page') || document.body;
  const r = pg.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
await page.screenshot({ path: OUT, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(794, box.w || 794), height: Math.min(1123, box.h || 1123) } });
await b.close();
console.log('[cv] written', path.relative(ROOT, OUT));
