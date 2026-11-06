// Screenshots of the static page (desktop, phone, dark) and of the studio (every folio,
// window, day/evening). Usage: node scripts/qa/screenshots.mjs
import path from 'node:path';
import { OUT, browser, devices, serve, waitForStudio, watch, writeJson } from './lib.mjs';

export async function screenshots(base) {
  const errors = [];
  const shots = [];
  const b = await browser();
  const shot = async (page, name, opts = {}) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, ...opts });
    shots.push(name);
  };

  // --- static page
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?page`, { waitUntil: 'networkidle' });
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
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in')));
    await shot(page, 'page-phone-top');
    await shot(page, 'page-phone-full', { fullPage: true });
    await ctx.close();
  }
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?page`, { waitUntil: 'networkidle' });
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
      const ids = ['hello', 'approach', 'role', 'work', 'career', 'toolkit', 'faq', 'contact'];
      for (const id of ids) {
        await page.evaluate((x) => window.__studio.open(x), id);
        await page.evaluate(() => window.__studio.step(1 / 30, 75));
        await shot(page, `studio-folio-${id}`);
      }
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
