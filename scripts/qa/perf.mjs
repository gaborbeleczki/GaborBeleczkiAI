// Performance numbers: transfer sizes, time to interactive studio, frame times.
// Headless Chromium renders WebGL in software (SwiftShader), so absolute fps is far below a
// real GPU; the numbers are for comparing builds, not for marketing.
import fs from 'node:fs';
import path from 'node:path';
import { DIST, browser, serve, waitForStudio, watch, writeJson } from './lib.mjs';

function dirSize(dir, filter = () => true) {
  let total = 0;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) total += dirSize(p, filter);
    else if (filter(p)) total += fs.statSync(p).size;
  }
  return total;
}

export async function perf(base) {
  const errors = [];
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  watch(page, errors);
  const bytes = { page: 0, studio: 0 };
  page.on('response', async (r) => {
    try {
      const len = Number(r.headers()['content-length'] || (await r.body()).length);
      bytes.studio += len;
    } catch {
      /* ignore */
    }
  });
  const t0 = Date.now();
  await page.goto(`${base}/?studio`, { waitUntil: 'load' });
  const tLoad = Date.now() - t0;
  await waitForStudio(page);
  const tStudio = Date.now() - t0;
  // let it run for a few seconds and sample real frame times
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const ts = [];
        let last = performance.now();
        const end = last + 5000;
        const tick = (now) => {
          ts.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(tick);
          else resolve(ts);
        };
        requestAnimationFrame(tick);
      }),
  );
  const sorted = [...frames].sort((a, b) => a - b);
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const info = await page.evaluate(() => window.__studio.info());
  await ctx.close();

  // static page weight
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const page2 = await ctx2.newPage();
  page2.on('response', async (r) => {
    try {
      bytes.page += Number(r.headers()['content-length'] || (await r.body()).length);
    } catch {
      /* ignore */
    }
  });
  const t1 = Date.now();
  await page2.goto(`${base}/?page`, { waitUntil: 'networkidle' });
  const tPage = Date.now() - t1;
  const lcp = await page2.evaluate(
    () =>
      new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const e = list.getEntries();
          resolve(e[e.length - 1]?.startTime ?? null);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(null), 1500);
      }),
  );
  await b.close();
  return {
    errors,
    page: { loadMs: tPage, lcpMs: lcp, transferKB: Math.round(bytes.page / 1024) },
    studio: {
      domLoadMs: tLoad,
      readyMs: tStudio,
      transferKB: Math.round(bytes.studio / 1024),
      frames: frames.length,
      frameMs: { median: +p(0.5).toFixed(1), p95: +p(0.95).toFixed(1) },
      renderer: info,
      note: 'software WebGL (SwiftShader) in headless Chromium',
    },
    dist: {
      totalKB: Math.round(dirSize(DIST) / 1024),
      modelsKB: Math.round(dirSize(path.join(DIST, 'models')) / 1024),
      texturesKB: Math.round(dirSize(path.join(DIST, 'textures')) / 1024),
      jsKB: Math.round(dirSize(path.join(DIST, 'assets'), (f) => f.endsWith('.js')) / 1024),
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const srv = await serve(4322);
  const res = await perf(srv.url);
  srv.close();
  writeJson('perf.json', res);
  console.log(JSON.stringify(res, null, 2));
}
