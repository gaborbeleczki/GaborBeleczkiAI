// Capture the page's hero images and social card from the live WebGL studio, so they match
// the hero video: public/img/studio-{evening,day}.{webp,jpg} and public/img/og.jpg
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, browser, serve, waitForStudio } from './lib.mjs';

export async function posters(base) {
  const b = await browser();
  const img = (f) => path.join(ROOT, 'public', 'img', f);
  for (const state of ['evening', 'day']) {
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${base}/?studio&capture&${state}`, { waitUntil: 'load' });
    await waitForStudio(page);
    await page.addStyleTag({ content: '.hud,.spots{display:none!important}' });
    await page.evaluate(() => {
      window.__studio.lookAt(0, 0);
      window.__studio.step(1 / 30, 150);
    });
    const buf = await page.locator('canvas.studio__gl').screenshot({ timeout: 120000 });
    await ctx.close();
    await sharp(buf).resize(1600, 900).webp({ quality: 84, effort: 6 }).toFile(img(`studio-${state}.webp`));
    await sharp(buf).resize(1600, 900).jpeg({ quality: 82, mozjpeg: true }).toFile(img(`studio-${state}.jpg`));
    if (state === 'evening') await sharp(buf).resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 84, mozjpeg: true }).toFile(img('og.jpg'));
  }
  await b.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const srv = await serve(4327);
  await posters(srv.url);
  srv.close();
  console.log('[posters] written');
}
