// Adversarial checks: every hostile situation must land somewhere sensible (usually the original
// portfolio at /page/), and the studio's things must work with the keyboard and in any order.
import { browser, serve, waitForStudio, watch, writeJson } from './lib.mjs';

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

  // Visitors who cannot have the studio read the original portfolio at /page/. (Headless
  // browsers count as crawlers and keep the static HTML, so these checks pose as a desktop.)
  const REAL_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  // the original page asks for an unfilled '{{ cvHref }}' once before it renders (it does on
  // its own site too); that one 404 is expected, any other is not
  const quirk = (u) => /%7B%7B|\{\{/.test(u);
  const onOriginal = async (page, reason, errors) => {
    const missing = [];
    page.on('response', (r) => r.status() === 404 && missing.push(r.url()));
    await page.waitForURL((u) => u.pathname === '/page/' && (!reason || u.search.includes(`reason=${reason}`)), { timeout: 60000 });
    const src = await page.locator('iframe.original').getAttribute('src');
    if (src !== './original/') throw new Error(`iframe src ${src}`);
    await page.frameLocator('iframe.original').locator('text=Béleczki').first().waitFor({ timeout: 60000 });
    const unexpected = missing.filter((u) => !quirk(u));
    if (unexpected.length) throw new Error(`404: ${unexpected.join(', ')}`);
    if (errors) errors.splice(0, errors.length, ...errors.filter((e) => !/status of 404/.test(e) || unexpected.length));
    return page.url().replace(base, '');
  };

  // 1. No WebGL at all: auto-detection sends a visitor to the page; forcing the studio fails over.
  {
    const b = await browser(['--disable-webgl', '--disable-3d-apis']);
    await run('no WebGL → the original page', async (errors) => {
      const ctx = await b.newContext({ userAgent: REAL_UA });
      const page = await ctx.newPage();
      watch(page, errors);
      await page.goto(`${base}/`, { waitUntil: 'load' });
      const at = await onOriginal(page, 'unsupported', errors);
      await ctx.close();
      return { at };
    });
    await run('no WebGL + ?studio → the original page with a note', async (errors) => {
      const ctx = await b.newContext({ userAgent: REAL_UA });
      const page = await ctx.newPage();
      watch(page, errors);
      await page.goto(`${base}/?studio`, { waitUntil: 'load' });
      const at = await onOriginal(page, 'studio-error', errors);
      const note = await page.locator('.note').textContent();
      await ctx.close();
      // the WebGL failure is expected here; keep only unexpected errors
      errors.splice(0, errors.length, ...errors.filter((e) => !/WebGL|webgl|context|stopped|failed to start/i.test(e)));
      return { at, note };
    });
    await b.close();
  }

  const b = await browser();
  // 2. Reduced motion preference → the page.
  await run('prefers-reduced-motion → the original page', async (errors) => {
    const ctx = await b.newContext({ reducedMotion: 'reduce', userAgent: REAL_UA });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/`, { waitUntil: 'load' });
    const at = await onOriginal(page, undefined, errors);
    await ctx.close();
    return { at };
  });

  // 3. Software-only WebGL (this test browser) → the page, with a word on why.
  await run('software WebGL → the original page', async (errors) => {
    const ctx = await b.newContext({ userAgent: REAL_UA });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/`, { waitUntil: 'load' });
    const at = await onOriginal(page, 'unsupported', errors);
    await ctx.close();
    return { at };
  });

  // 4. Missing model → the page, no crash.
  await run('studio.glb missing → the original page', async (errors) => {
    const ctx = await b.newContext({ userAgent: REAL_UA });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.route('**/models/studio.glb*', (r) => r.fulfill({ status: 404, body: 'gone' }));
    await page.goto(`${base}/?studio`, { waitUntil: 'load' });
    const at = await onOriginal(page, 'studio-error', errors);
    await ctx.close();
    errors.splice(0, errors.length, ...errors.filter((e) => !/studio\.glb|404|assets failed|Failed to load|failed to start/i.test(e)));
    return { at };
  });

  // 5. Hammering: rapid dossier picks with the number keys, resizes, light switching.
  await run('rapid input: keys 0-7, Escape, resizes', async (errors) => {
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
    await page.evaluate(() => window.__studio.step(1 / 30, 60));
    const held = await page.evaluate(() => window.__studio.hand());
    await page.keyboard.press('Escape');
    await page.keyboard.press('l');
    await page.keyboard.press('l');
    await page.evaluate(() => window.__studio.step(1 / 30, 90));
    const after = await page.evaluate(() => window.__studio.hand());
    await ctx.close();
    // the last key pressed was 4 → dossier 04 (Career), open in the reader's hands
    if (!held || held.id !== 'career' || held.open < 0.9) throw new Error(`expected the Career dossier open, got ${JSON.stringify(held)}`);
    if (after) throw new Error(`Escape should put it back: ${JSON.stringify(after)}`);
    return { held };
  });

  // 6. Losing the WebGL context → the page within a few seconds.
  await run('WebGL context lost → the original page', async (errors) => {
    const ctx = await b.newContext();
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?studio`, { waitUntil: 'load' });
    await waitForStudio(page);
    await page.evaluate(() => window.__studio.loseContext());
    const at = await onOriginal(page, 'studio-error', errors);
    await ctx.close();
    errors.splice(0, errors.length, ...errors.filter((e) => !/context|stopped/i.test(e)));
    return { at };
  });

  // 7. Keyboard only on the static page (what crawlers and no-JS visitors read).
  await run('keyboard: skip link + focus order on the static page', async (errors) => {
    const ctx = await b.newContext();
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?static`, { waitUntil: 'networkidle' });
    const seen = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      seen.push(await page.evaluate(() => (document.activeElement?.textContent || document.activeElement?.getAttribute('aria-label') || '').trim().slice(0, 40)));
    }
    await ctx.close();
    if (!/skip/i.test(seen[0])) throw new Error(`first tab stop was "${seen[0]}"`);
    return { tabStops: seen };
  });

  // 8. Studio HUD reachable by keyboard; the Chapters menu takes a dossier down.
  await run('keyboard: chapters menu opens a dossier', async (errors) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?studio&capture`, { waitUntil: 'load' });
    await waitForStudio(page);
    await page.locator('[data-act="menu"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-open="career"]').focus();
    await page.keyboard.press('Enter');
    await page.evaluate(() => window.__studio.step(1 / 30, 90));
    const held = await page.evaluate(() => window.__studio.hand());
    await ctx.close();
    if (!held || held.id !== 'career') throw new Error(`in hand: ${JSON.stringify(held)}`);
    return held;
  });

  // 9. Reading a dossier: it opens, pages turn both ways, it goes back on the shelf.
  await run('dossier: opens, turns pages, goes back', async (errors) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?studio&capture`, { waitUntil: 'load' });
    await waitForStudio(page);
    await page.evaluate(() => window.__studio.open('work'));
    await page.evaluate(() => window.__studio.step(1 / 30, 90));
    const opened = await page.evaluate(() => window.__studio.hand());
    for (let i = 0; i < 3; i++) await page.evaluate(() => (window.__studio.turn(1), window.__studio.step(1 / 30, 30)));
    await page.evaluate(() => (window.__studio.turn(-1), window.__studio.step(1 / 30, 30)));
    const turned = await page.evaluate(() => window.__studio.hand());
    await page.evaluate(() => (window.__studio.putDown(), window.__studio.step(1 / 30, 120)));
    const back = await page.evaluate(() => window.__studio.hand());
    await ctx.close();
    if (!opened || opened.open < 0.95 || opened.total < 8) throw new Error(`opened: ${JSON.stringify(opened)}`);
    if (turned.left !== 4 || turned.right !== 5) throw new Error(`after 3 forward, 1 back: ${JSON.stringify(turned)}`);
    if (back) throw new Error(`still in hand: ${JSON.stringify(back)}`);
    return { opened, turned };
  });

  // 10. The desk: every object can be picked up (or used), and the dots show where they are.
  await run('desk: cards, phone, CV, notebook; hotspots', async (errors) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?studio&capture`, { waitUntil: 'load' });
    await waitForStudio(page);
    await page.evaluate(() => window.__studio.step(1 / 30, 90));
    const homeSpots = await page.evaluate(() => window.__studio.spots());
    await page.evaluate(() => (window.__studio.focus('objects'), window.__studio.step(1 / 30, 90)));
    const deskSpots = await page.evaluate(() => window.__studio.spots());
    const held = {};
    for (const id of ['cards', 'phone', 'cv', 'notebook']) {
      await page.evaluate((id) => (window.__studio.use(id), window.__studio.step(1 / 30, 80)), id);
      held[id] = await page.evaluate(() => window.__studio.hand());
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.__studio.step(1 / 30, 80));
    }
    for (const id of ['globe', 'coffee', 'about']) await page.evaluate((id) => (window.__studio.use(id), window.__studio.step(1 / 30, 10)), id);
    const caption = await page.locator('.hud__caption.is-on h3').textContent().catch(() => null);
    await ctx.close();
    for (const id of Object.keys(held)) if (!held[id] || held[id].id !== id || held[id].travel < 0.95) throw new Error(`${id}: ${JSON.stringify(held[id])}`);
    if (homeSpots.length < 4) throw new Error(`home dots: ${homeSpots.join(', ')}`);
    if (deskSpots.length < 6) throw new Error(`desk dots: ${deskSpots.join(', ')}`);
    if (!caption) throw new Error('no caption for the portrait');
    return { homeSpots, deskSpots, caption };
  });

  // 8. The role game: keys reach it at the desk, walking away pauses it.
  await run('game: plays with keys, pauses when you leave the desk', async (errors) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?studio&capture`, { waitUntil: 'load' });
    await waitForStudio(page);
    await page.evaluate(() => (window.__studio.focus('desk'), window.__studio.showOnScreen('role')));
    await page.evaluate(() => window.__studio.step(1 / 60, 30));
    await page.keyboard.press('g');
    await page.keyboard.press('Enter');
    await page.keyboard.down('ArrowRight');
    await page.evaluate(() => window.__studio.step(1 / 60, 120));
    await page.keyboard.up('ArrowRight');
    const playing = await page.evaluate(() => window.__studio.game());
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__studio.step(1 / 60, 10));
    const left = await page.evaluate(() => window.__studio.game());
    await ctx.close();
    if (!playing || playing.phase !== 'playing' || !(playing.x > 80)) throw new Error(`while playing: ${JSON.stringify(playing)}`);
    if (left.phase !== 'paused') throw new Error(`after Escape: ${JSON.stringify(left)}`);
    return { playing, left };
  });

  // 9. The soundtrack renders without clipping (offline, no speakers).
  await run('music: 16 s offline render, no clipping, not silent', async (errors) => {
    const ctx = await b.newContext({ viewport: { width: 800, height: 500 } });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?studio&capture`, { waitUntil: 'load' });
    await waitForStudio(page);
    const per = await page.evaluate(() => window.__studio.music(16));
    await ctx.close();
    const peak = Math.max(...per.map((p) => p.peak));
    const rms = Math.max(...per.map((p) => p.rms));
    if (peak >= 0.98) throw new Error(`peak ${peak}`);
    if (rms < 0.005) throw new Error(`silent: rms ${rms}`);
    return { peak, rms };
  });

  // 10. The page's case figures are there and animated.
  await run('page: seven animated case figures', async (errors) => {
    const page = await b.newPage();
    watch(page, errors);
    await page.goto(`${base}/?static`, { waitUntil: 'load' });
    const figs = await page.evaluate(() => [...document.querySelectorAll('svg.fig__svg')].map((s) => s.querySelectorAll('animateMotion, animate, animateTransform, [style*="animation"]').length));
    await page.close();
    if (figs.length !== 7) throw new Error(`${figs.length} figures`);
    if (figs.some((n) => n === 0)) throw new Error(`a figure without motion: ${figs.join(',')}`);
    return { animationsPerFigure: figs };
  });

  // The page view: the original portfolio, untouched, inside a full-screen frame.
  await run('page view: the original portfolio in a frame, a way back to the studio', async (errors) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/page/`, { waitUntil: 'load' });
    const frame = page.frameLocator('iframe.original');
    await frame.locator('text=Béleczki').first().waitFor({ timeout: 60000 });
    const href = await page.locator('[data-studio]').getAttribute('href');
    const title = await page.title();
    await ctx.close();
    // the original page asks for an unfilled '{{ cvHref }}' before it renders (as it does live)
    errors.splice(0, errors.length, ...errors.filter((e) => !/cvHref|%7B%7B|404/.test(e)));
    if (href !== '/?studio') throw new Error(`pill href ${href}`);
    return { title };
  });

  // Every generated page and feed responds.
  await run('routes: pages, original, CVs, feeds, assets', async () => {
    const out = {};
    for (const p of ['/', '/cv/', '/notes/', '/notes/building-the-studio/', '/rss.xml', '/sitemap.xml', '/robots.txt', '/models/studio.json', '/page/', '/page/original/', '/page/cv/', '/page/cv-long/', '/models/vehicles.json', '/textures/vehicles_day.webp', '/textures/cv_page.webp']) {
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
