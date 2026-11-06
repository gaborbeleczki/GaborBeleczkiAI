// The window up close: evening and day, the head leaning left and right (parallax), and a few
// seconds apart (traffic, boats, wind). Writes renders/qa/window-*.png
//   npm run build && node scripts/qa/window.mjs

import path from 'node:path';
import { OUT, browser, serve, waitForStudio, watch, writeJson } from './lib.mjs';

const server = await serve(4327);
const b = await browser();
const errors = [];
const shots = [];
try {
  for (const state of ['evening', 'day']) {
    const page = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    watch(page, errors);
    await page.goto(`${server.url}/?studio&capture&${state}`);
    await waitForStudio(page);
    await page.evaluate(() => window.__studio.focus('window'));
    await page.evaluate(() => window.__studio.step(1 / 30, 90));
    for (const [name, x, y] of [['left', -1, 0], ['center', 0, 0], ['right', 1, 0], ['up', 0, 1]]) {
      await page.evaluate(([lx, ly]) => {
        window.__studio.lookAt(lx, ly);
        window.__studio.step(1 / 30, 60);
      }, [x, y]);
      const file = path.join(OUT, `window-${state}-${name}.png`);
      await page.screenshot({ path: file });
      shots.push(file);
    }
    // the same view a few seconds later: things should have moved
    await page.evaluate(() => {
      window.__studio.lookAt(0, 0);
      window.__studio.step(1 / 30, 150);
    });
    const later = path.join(OUT, `window-${state}-later.png`);
    await page.screenshot({ path: later });
    shots.push(later);
    // and from the room
    await page.evaluate(() => {
      window.__studio.focus('home');
      window.__studio.step(1 / 30, 90);
    });
    const home = path.join(OUT, `window-${state}-home.png`);
    await page.screenshot({ path: home });
    shots.push(home);
    await page.close();
  }
} finally {
  await b.close();
  server.close();
}
writeJson('window.json', { shots: shots.map((s) => path.basename(s)), errors });
console.log(`[window] ${shots.length} shots, ${errors.length} errors`);
if (errors.length) console.log(errors.join('\n'));
