#!/usr/bin/env node
/**
 * Verifies src/data/products.json against public/images:
 *  - every catalogued image exists on disk, ids and slugs are unique;
 *  - lists photos on disk that no product uses (add them to products.json, or to
 *    src/data/unlisted-images.json if they should stay hidden).
 * Usage: npm run catalog:check   (exits 1 on errors)
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const products = JSON.parse(fs.readFileSync(path.join(root, "src/data/products.json"), "utf8"));
const unlisted = new Set(JSON.parse(fs.readFileSync(path.join(root, "src/data/unlisted-images.json"), "utf8")).images);
const publicDir = path.join(root, "public");
const errors = [];
const used = new Set();

const dupes = (key) => products.map((p) => p[key]).filter((v, i, a) => a.indexOf(v) !== i);
for (const k of ["id", "slug"]) for (const v of dupes(k)) errors.push(`duplicate ${k}: ${v}`);

for (const p of products) {
  if (!p.images?.length) errors.push(`${p.id} has no images`);
  for (const src of p.images ?? []) {
    if (used.has(src)) errors.push(`${src} is used by more than one product`);
    used.add(src);
    if (!fs.existsSync(path.join(publicDir, src))) errors.push(`${p.id} (${p.slug}): missing file ${src}`);
  }
}

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const onDisk = walk(path.join(publicDir, "images")).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)).map((f) => "/" + path.relative(publicDir, f).split(path.sep).join("/"));
const uncatalogued = onDisk.filter((src) => !used.has(src) && !unlisted.has(src));
const badNames = onDisk.filter((src) => !/^\/images\/[a-z0-9_/]+_\d{2}\.(jpg|png|webp|avif)$/.test(src));

console.log(`${products.length} products, ${used.size} catalogued images, ${onDisk.length} images on disk, ${products.filter((p) => p.isNewArrival).length} new arrivals`);
if (uncatalogued.length) console.log(`\nNot in the catalogue yet (${uncatalogued.length}):\n  ${uncatalogued.join("\n  ")}`);
if (badNames.length) console.log(`\nNot following the <descriptor>_NN.ext naming pattern (${badNames.length}):\n  ${badNames.join("\n  ")}`);
if (errors.length) {
  console.error(`\nErrors (${errors.length}):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log("\nCatalogue OK");
