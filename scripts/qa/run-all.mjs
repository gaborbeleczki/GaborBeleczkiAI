// Run every QA pass against dist/ and write renders/qa/report.md.
//   npm run build && npm run qa
import fs from 'node:fs';
import path from 'node:path';
import { OUT, serve, writeJson } from './lib.mjs';
import { adversarial } from './adversarial.mjs';
import { perf } from './perf.mjs';
import { pixeldiff } from './pixeldiff.mjs';
import { screenshots } from './screenshots.mjs';

const srv = await serve(4326);
const t0 = Date.now();
const shots = await screenshots(srv.url);
const perfRes = await perf(srv.url);
const diff = await pixeldiff(srv.url);
const adv = await adversarial(srv.url);
srv.close();

const summary = { generated: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), screenshots: shots, perf: perfRes, pixeldiff: diff, adversarial: adv };
writeJson('summary.json', summary);

const lines = [
  '# QA report',
  '',
  `Generated ${summary.generated} in ${summary.seconds}s. Headless Chromium with software WebGL (SwiftShader).`,
  '',
  '## Screenshots',
  '',
  `${shots.shots.length} captured: ${shots.shots.join(', ')}.`,
  shots.errors.length ? `Console errors: ${shots.errors.length}\n\n${shots.errors.map((e) => `- ${e}`).join('\n')}` : 'No console errors.',
  '',
  '## Performance',
  '',
  `- Page: ${perfRes.page.transferKB} KB transferred, load ${perfRes.page.loadMs} ms, LCP ${perfRes.page.lcpMs ? Math.round(perfRes.page.lcpMs) + ' ms' : 'n/a'}`,
  `- Studio: ${perfRes.studio.transferKB} KB transferred, ready in ${perfRes.studio.readyMs} ms, frame time median ${perfRes.studio.frameMs.median} ms / p95 ${perfRes.studio.frameMs.p95} ms (${perfRes.studio.note})`,
  `- dist: ${perfRes.dist.totalKB} KB total (models ${perfRes.dist.modelsKB} KB, textures ${perfRes.dist.texturesKB} KB, JS ${perfRes.dist.jsKB} KB)`,
  '',
  '## Pixel difference (WebGL vs Cycles reference, home camera)',
  '',
  ...Object.entries(diff.results).map(([k, v]) => `- ${k}: ${v.skipped || v.error || `${v.mismatchPct}% pixels differ beyond threshold, mean |Δluma| ${v.meanAbsLuma} (WebGL ${v.meanLumaWebGL} vs Cycles ${v.meanLumaCycles})`}`),
  '',
  '## Adversarial checks',
  '',
  ...adv.checks.map((c) => `- ${c.pass && !c.errors.length ? 'PASS' : 'FAIL'} ${c.name}${c.pass ? '' : ` — ${c.detail}`}${c.errors.length ? ` — errors: ${c.errors.join(' | ')}` : ''}`),
  '',
];
fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n'));
console.log(lines.join('\n'));
