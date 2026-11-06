// Shared helpers for the QA scripts: a static server for dist/, a headless Chromium with
// software WebGL, console-error capture, and a report folder.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = require('/opt/node-tools/node_modules/playwright');
}
export const { chromium, devices } = pw;

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DIST = path.join(ROOT, 'dist');
export const OUT = path.join(ROOT, 'renders', 'qa');
fs.mkdirSync(OUT, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.hdr': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain',
};

/** Minimal static server mirroring Vercel's cleanUrls/trailingSlash behaviour. */
export function serve(port = 4321) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(DIST, url);
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ url: `http://localhost:${port}`, close: () => server.close() })));
}

export async function browser(extraArgs = []) {
  return chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', ...extraArgs],
  });
}

/** Attach console/page error collection to a page. */
export function watch(page, bucket) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') bucket.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => bucket.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!u.includes('/media/')) bucket.push(`requestfailed: ${u} ${r.failure()?.errorText}`);
  });
}

export async function waitForStudio(page, timeout = 120000) {
  await page.waitForFunction(() => window.__studio && window.__studio.ready, null, { timeout });
  await page.evaluate(() => window.__studio.prefetched());
  // the sharp window photos load after the first frames
  await page.evaluate(() => (window.__studio.sharpened ? window.__studio.sharpened() : true));
}

export function writeJson(name, data) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));
}
