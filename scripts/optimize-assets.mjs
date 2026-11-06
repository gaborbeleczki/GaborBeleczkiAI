// Optimise the Blender export for the web and copy rendered images into public/.
//   node scripts/optimize-assets.mjs
// - studio_raw.glb -> public/models/studio.glb (weld, quantise, meshopt, no normals on baked meshes)
// - city renders + tram sprites -> public/textures/*.webp
// - Cycles stills -> public/img/*.webp|jpg (hero, OG card)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, weld, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (...p) => path.join(root, ...p);
const exists = (p) => fs.existsSync(p);

async function optimizeGlb() {
  const src = out('blender/out/studio_raw.glb');
  if (!exists(src)) return console.log('[assets] no studio_raw.glb yet, skipping');
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
  const doc = await io.read(src);
  // Baked meshes are unlit (albedo × lightmap): drop their normals.
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || !node.getName().startsWith('bake_')) continue;
    for (const prim of mesh.listPrimitives()) prim.setAttribute('NORMAL', null);
  }
  await doc.transform(
    dedup(),
    weld(),
    prune({ keepLeaves: false, keepExtras: true, keepAttributes: true }),
    quantize({ quantizePosition: 14, quantizeTexcoord: 14, quantizeNormal: 10 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const dst = out('public/models/studio.glb');
  await io.write(dst, doc);
  console.log(`[assets] studio.glb ${(fs.statSync(src).size / 1e6).toFixed(2)} MB -> ${(fs.statSync(dst).size / 1e6).toFixed(2)} MB`);
}

async function cityTextures() {
  const dir = out('blender/out/city');
  if (!exists(dir)) return;
  const jobs = [
    ['city_evening.png', 'city_evening.webp', { quality: 86 }],
    ['city_day.png', 'city_day.webp', { quality: 86 }],
    ['city_data.png', 'city_data.webp', { lossless: true }],
    ['tram_evening.png', 'tram_evening.webp', { quality: 90, alphaQuality: 100 }],
    ['tram_day.png', 'tram_day.webp', { quality: 90, alphaQuality: 100 }],
  ];
  for (const [from, to, opts] of jobs) {
    const p = path.join(dir, from);
    if (!exists(p)) continue;
    await sharp(p).webp({ effort: 6, ...opts }).toFile(out('public/textures', to));
  }
  if (exists(path.join(dir, 'city.json'))) fs.copyFileSync(path.join(dir, 'city.json'), out('public/models/city.json'));
  console.log('[assets] city textures written');
}

async function stills() {
  // Cycles renders of the home view: references for QA and illustrations for the build notes.
  // (The page hero and social card are WebGL captures, see scripts/qa/posters.mjs.)
  const dir = out('blender/out/stills');
  if (!exists(dir)) return;
  for (const state of ['evening', 'day']) {
    const p = path.join(dir, `hero_${state}.png`);
    if (!exists(p)) continue;
    await sharp(p).resize(1600, 900).jpeg({ quality: 82, mozjpeg: true }).toFile(out(`public/img/cycles-${state}.jpg`));
  }
  console.log('[assets] stills written');
}

async function envMaps() {
  const dir = out('blender/out/env');
  if (!exists(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.hdr')) fs.copyFileSync(path.join(dir, f), out('public/textures', f));
  }
  console.log('[assets] env maps copied');
}

fs.mkdirSync(out('public/models'), { recursive: true });
fs.mkdirSync(out('public/textures'), { recursive: true });
fs.mkdirSync(out('public/img'), { recursive: true });
await optimizeGlb();
await cityTextures();
await stills();
await envMaps();
