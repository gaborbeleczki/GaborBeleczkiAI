// Screenshots of the page view (the original portfolio), the static page (what crawlers read),
// and the studio: the display's chapters, the dossiers, the desk objects, the window by day and
// by evening. Usage: node scripts/qa/screenshots.mjs
import path from 'node:path';
import { OUT, browser, devices, serve, waitForStudio, watch, writeJson } from './lib.mjs';

export async function screenshots(base) {
  const errors = [];
  const shots = [];
  const b = await browser();
  const shot = async (page, name, opts = {}) => {
    const file = path.join(OUT, `${name}.png`);
    // let the HUD's fades finish (frames are stepped by hand, CSS runs in real time)
    await page.waitForTimeout(450);
    await page.screenshot({ path: file, ...opts });
    shots.push(name);
  };

  // --- static page
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/page/`, { waitUntil: 'load' });
    await page.frameLocator('iframe.original').locator('text=Béleczki').first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    await shot(page, 'page-original-desktop');
    await page.goto(`${base}/?static`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in')));
    await shot(page, 'page-desktop-top');
    await shot(page, 'page-desktop-full', { fullPage: true });
    await page.goto(`${base}/cv/`, { waitUntil: 'networkidle' });
    await shot(page, 'cv-desktop', { fullPage: true });
    await page.goto(`${base}/notes/building-the-studio/`, { waitUntil: 'networkidle' });
    await shot(page, 'note-desktop', { fullPage: true });
    await ctx.close();
  }
  {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    watch(page, errors);
    // a phone is sent to the original portfolio
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await page.waitForURL((u) => u.pathname === '/page/', { timeout: 30000 });
    await page.frameLocator('iframe.original').locator('text=Béleczki').first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    await shot(page, 'page-phone-original');
    await page.goto(`${base}/?static`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in')));
    await shot(page, 'page-phone-top');
    await shot(page, 'page-phone-full', { fullPage: true });
    await ctx.close();
  }
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?static`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in')));
    await shot(page, 'page-dark-top');
    await ctx.close();
  }

  // --- studio (software WebGL, frames stepped manually)
  for (const state of ['evening', 'day']) {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?studio&capture&${state}`, { waitUntil: 'load' });
    await waitForStudio(page);
    await page.evaluate(() => window.__studio.step(1 / 30, 100));
    await shot(page, `studio-${state}-home`);
    if (state === 'evening') {
      // the display's chapters, switched with its dock (nothing else in the room moves)
      await page.evaluate(() => (window.__studio.focus('desk'), window.__studio.step(1 / 30, 75)));
      for (const id of ['hello', 'approach', 'role', 'work', 'career', 'toolkit', 'faq', 'contact']) {
        await page.evaluate((x) => (window.__studio.showOnScreen(x), window.__studio.step(1 / 30, 20)), id);
        await shot(page, `studio-display-${id}`);
      }
      await page.evaluate(() => (window.__studio.focus('home'), window.__studio.step(1 / 30, 75)));
      // the dossiers, opened in the reader's hands
      for (const id of ['hello', 'role', 'work', 'career', 'contact']) {
        await page.evaluate((x) => (window.__studio.open(x), window.__studio.step(1 / 30, 90)), id);
        await shot(page, `studio-dossier-${id}`);
        if (id === 'work') {
          await page.evaluate(() => (window.__studio.turn(1), window.__studio.step(1 / 30, 40)));
          await shot(page, 'studio-dossier-work-p2');
        }
        await page.evaluate(() => (window.__studio.putDown(), window.__studio.step(1 / 30, 90)));
      }
      // the desk and the things on it
      await page.evaluate(() => (window.__studio.focus('objects'), window.__studio.step(1 / 30, 90)));
      await shot(page, 'studio-objects');
      for (const id of ['cards', 'phone', 'cv', 'notebook']) {
        await page.evaluate((x) => (window.__studio.use(x), window.__studio.step(1 / 30, 80)), id);
        await shot(page, `studio-hold-${id}`);
        await page.evaluate(() => (window.__studio.putDown(), window.__studio.step(1 / 30, 80)));
      }
      await page.evaluate(() => (window.__studio.use('globe'), window.__studio.step(1 / 30, 40)));
      await shot(page, 'studio-globe');
      await page.evaluate(() => window.__studio.focus('shelf'));
      await page.evaluate(() => window.__studio.step(1 / 30, 60));
      await shot(page, 'studio-shelf');
      await page.evaluate(() => window.__studio.focus('record'));
      await page.evaluate(() => window.__studio.step(1 / 30, 60));
      await shot(page, 'studio-record');
    }
    await page.evaluate(() => window.__studio.focus('window'));
    await page.evaluate(() => window.__studio.step(1 / 30, 150));
    await shot(page, `studio-${state}-window`);
    await ctx.close();
  }
  await b.close();
  return { shots, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const srv = await serve();
  const res = await screenshots(srv.url);
  srv.close();
  writeJson('screenshots.json', res);
  console.log(`[qa] ${res.shots.length} screenshots, ${res.errors.length} errors`);
  if (res.errors.length) console.log(res.errors.join('\n'));
}
