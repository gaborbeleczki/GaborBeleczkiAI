// Pixel-difference check: the WebGL studio vs the Cycles reference render from the same
// camera (home pose, 1920x1080, evening and day). Differences are expected where the bake
// leaves out glossy reflections and where live objects are shaded in real time; the check
// catches regressions such as wrong UVs, flipped textures, exposure or colour-space errors.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { OUT, ROOT, browser, serve, waitForStudio, watch, writeJson } from './lib.mjs';

function read(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function stats(a, b) {
  let sum = 0;
  const n = a.width * a.height;
  let lumA = 0;
  let lumB = 0;
  for (let i = 0; i < n * 4; i += 4) {
    const la = 0.2126 * a.data[i] + 0.7152 * a.data[i + 1] + 0.0722 * a.data[i + 2];
    const lb = 0.2126 * b.data[i] + 0.7152 * b.data[i + 1] + 0.0722 * b.data[i + 2];
    lumA += la;
    lumB += lb;
    sum += Math.abs(la - lb);
  }
  return { meanAbsLuma: +(sum / n).toFixed(2), meanLumaWebGL: +(lumA / n).toFixed(1), meanLumaCycles: +(lumB / n).toFixed(1) };
}

export async function pixeldiff(base) {
  const errors = [];
  const results = {};
  const b = await browser();
  for (const state of ['evening', 'day']) {
    const refFile = path.join(ROOT, 'blender', 'out', 'stills', `hero_${state}.png`);
    if (!fs.existsSync(refFile)) {
      results[state] = { skipped: 'no Cycles reference yet' };
      continue;
    }
    const ref = read(refFile);
    const ctx = await b.newContext({ viewport: { width: ref.width, height: ref.height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(`${base}/?studio&capture&${state}`, { waitUntil: 'load' });
    await waitForStudio(page);
    // settle the intro move, keep the camera centred (no look-around), freeze trams
    await page.evaluate(() => {
      window.__studio.lookAt(0, 0);
      window.__studio.step(1 / 30, 120);
    });
    const buf = await page.locator('canvas.studio__gl').screenshot();
    const gl = PNG.sync.read(buf);
    await ctx.close();
    if (gl.width !== ref.width || gl.height !== ref.height) {
      results[state] = { error: `size mismatch ${gl.width}x${gl.height} vs ${ref.width}x${ref.height}` };
      continue;
    }
    const diff = new PNG({ width: ref.width, height: ref.height });
    const mismatched = pixelmatch(gl.data, ref.data, diff.data, ref.width, ref.height, { threshold: 0.12, includeAA: false, alpha: 0.35 });
    fs.writeFileSync(path.join(OUT, `pixeldiff-${state}.png`), PNG.sync.write(diff));
    fs.writeFileSync(path.join(OUT, `pixeldiff-${state}-webgl.png`), buf);
    results[state] = {
      mismatchPct: +((mismatched / (ref.width * ref.height)) * 100).toFixed(2),
      ...stats(gl, ref),
    };
  }
  await b.close();
  return { results, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const srv = await serve(4323);
  const res = await pixeldiff(srv.url);
  srv.close();
  writeJson('pixeldiff.json', res);
  console.log(JSON.stringify(res, null, 2));
}
