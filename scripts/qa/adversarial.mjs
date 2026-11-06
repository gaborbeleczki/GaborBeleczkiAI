// Adversarial checks: every hostile situation must land somewhere sensible (usually the page).
import { browser, serve, waitForStudio, watch, writeJson } from './lib.mjs';

const MODE = () => document.documentElement.getAttribute('data-mode');

export async function adversarial(base) {
  const checks = [];
  const run = async (name, fn) => {
    const errors = [];
    try {
      const detail = await fn(errors);
      checks.push({ name, pass: true, detail, errors });
    } catch (e) {
      checks.push({ name, pass: false, detail: String(e && e.message ? e.message : e), errors });
    }
  };

  // 1. No WebGL at all: auto-detection picks the page, and forcing the studio falls back.
  {
    const b = await browser(['--disable-webgl', '--disable-3d-apis']);
    await run('no WebGL → page by default', async (errors) => {
      const page = await b.newPage();
      watch(page, errors);
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      const mode = await page.evaluate(MODE);
      const why = await page.evaluate(() => document.documentElement.getAttribute('data-studio-why'));
      if (mode !== 'page') throw new Error(`mode=${mode}`);
      return { mode, why };
    });
    await run('no WebGL + ?studio → falls back to page with a notice', async (errors) => {
      const page = await b.newPage();
      watch(page, errors);
      await page.goto(`${base}/?studio`, { waitUntil: 'load' });
      await page.waitForFunction(() => document.documentElement.getAttribute('data-mode') === 'page', null, { timeout: 30000 });
      const toast = await page.locator('.toast').textContent().catch(() => '');
      // the WebGL failure is expected here; keep only unexpected errors
      errors.splice(0, errors.length, ...errors.filter((e) => !/WebGL|webgl|context/i.test(e)));
      return { toast };
    });
    await b.close();
  }

  const b = await browser();
  // 2. Reduced motion preference → page by default.
  await run('prefers-reduced-motion → page by default', async (errors) => {
    const ctx = await b.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    const mode = await page.evaluate(MODE);
    await ctx.close();
    if (mode !== 'page') throw new Error(`mode=${mode}`);
    return { mode };
  });

  // 3. Missing model → fall back to the page with a notice, no crash.
  await run('studio.glb missing → page with notice', async (errors) => {
    const ctx = await b.newContext();
    const page = await ctx.newPage();
    watch(page, errors);
    await page.route('**/models/studio.glb', (r) => r.fulfill({ status: 404, body: 'gone' }));
    await page.goto(`${base}/?studio`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-mode') === 'page', null, { timeout: 60000 });
    const toast = await page.locator('.toast').textContent().catch(() => '');
    await ctx.close();
    errors.splice(0, errors.length, ...errors.filter((e) => !/studio\.glb|404|assets failed|Failed to load/i.test(e)));
    return { toast };
  });

  // 4. Hammering: rapid chapter switching, keys, resizes.
  await run('rapid input: keys 0-7, clicks, resizes', async (errors) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?studio&capture`, { waitUntil: 'load' });
    await waitForStudio(page);
    await page.evaluate(() => window.__studio.step(1 / 30, 30));
    for (let round = 0; round < 3; round++) {
      for (const k of ['3', '0', '7', '1', '6', '2', '5', '4']) {
        await page.keyboard.press(k);
        await page.evaluate(() => window.__studio.step(1 / 60, 2));
      }
    }
    for (const [w, h] of [[800, 600], [1920, 1080], [390, 844], [1280, 720]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate(() => window.__studio.step(1 / 30, 3));
    }
    await page.keyboard.press('Escape');
    await page.keyboard.press('l');
    await page.keyboard.press('l');
    await page.evaluate(() => window.__studio.step(1 / 30, 90));
    const info = await page.evaluate(() => window.__studio.info());
    await ctx.close();
    // the last key pressed was 4 → folio 04 (Career)
    if (info.module !== 'career') throw new Error(`expected the last chapter pressed (career), got ${info.module}`);
    return info;
  });

  // 5. Losing the WebGL context → back to the page within a few seconds.
  await run('WebGL context lost → page', async (errors) => {
    const ctx = await b.newContext();
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?studio`, { waitUntil: 'load' });
    await waitForStudio(page);
    await page.evaluate(() => window.__studio.loseContext());
    await page.waitForFunction(() => document.documentElement.getAttribute('data-mode') === 'page', null, { timeout: 15000 });
    await ctx.close();
    errors.splice(0, errors.length, ...errors.filter((e) => !/context/i.test(e)));
    return { mode: 'page' };
  });

  // 6. Keyboard only on the page: skip link and visible focus on the first controls.
  await run('keyboard: skip link + focus order on the page', async (errors) => {
    const ctx = await b.newContext();
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?page`, { waitUntil: 'networkidle' });
    const seen = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      seen.push(await page.evaluate(() => (document.activeElement?.textContent || document.activeElement?.getAttribute('aria-label') || '').trim().slice(0, 40)));
    }
    await ctx.close();
    if (!/skip/i.test(seen[0])) throw new Error(`first tab stop was "${seen[0]}"`);
    return { tabStops: seen };
  });

  // 7. Studio HUD reachable by keyboard; Chapters menu opens a chapter.
  await run('keyboard: studio chapters menu', async (errors) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?studio&capture`, { waitUntil: 'load' });
    await waitForStudio(page);
    await page.locator('[data-act="menu"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-open="career"]').focus();
    await page.keyboard.press('Enter');
    await page.evaluate(() => window.__studio.step(1 / 30, 40));
    const info = await page.evaluate(() => window.__studio.info());
    await ctx.close();
    if (info.module !== 'career') throw new Error(`module=${info.module}`);
    return info;
  });

  // 8. Every generated page and feed responds.
  await run('routes: /, /cv/, /notes/, note, rss, sitemap, robots', async () => {
    const out = {};
    for (const p of ['/', '/cv/', '/notes/', '/notes/building-the-studio/', '/rss.xml', '/sitemap.xml', '/robots.txt', '/models/studio.json']) {
      const r = await fetch(base + p);
      out[p] = r.status;
      if (r.status !== 200) throw new Error(`${p} → ${r.status}`);
    }
    return out;
  });
  await b.close();
  const failed = checks.filter((c) => !c.pass || c.errors.length);
  return { passed: checks.length - failed.length, total: checks.length, checks };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const srv = await serve(4324);
  const res = await adversarial(srv.url);
  srv.close();
  writeJson('adversarial.json', res);
  for (const c of res.checks) console.log(`${c.pass && !c.errors.length ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : ' — ' + c.detail}${c.errors.length ? ' — errors: ' + c.errors.join(' | ') : ''}`);
  console.log(`[qa] adversarial ${res.passed}/${res.total}`);
}
