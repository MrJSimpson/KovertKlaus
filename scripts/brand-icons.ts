/**
 * @file brand-icons.ts
 * @description Generates the brand mark file and the site icons from `src/lib/brand-mark.ts`.
 *
 * Tier 1 (what): Writes `public/brand/kovertklaus-mark.svg`, `src/app/icon.svg`,
 * `src/app/apple-icon.png` (180px), `src/app/favicon.ico` (16, 32, 48px) and the web manifest's
 * home-screen icons `public/brand/icon-192.png`, `icon-512.png` and `icon-maskable-512.png`.
 * Tier 2 (why): The old favicon was create-next-app's. Every icon now comes from the one brand mark
 * (visual refresh, 2.0.0-beta), so a change to the mark is one edit plus `npm run brand:icons`.
 * Tier 3 (how): `sharp` (already a dependency) renders the SVG; the ICO holds PNG images, which
 * every current browser reads. Colours are winter's stamp inks: holly red on light, gold on dark
 * (the SVG icon switches with `prefers-color-scheme`). `brand-icons.test.ts` checks the outputs
 * are current. Run on demand, not in the build.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { brandMarkSvg } from '../src/lib/brand-mark';

/** Winter stamp inks (`--kk-stamp` in kk-tokens.css) and the light paper surface. */
export const ICON_INK_LIGHT = '#a70006';
export const ICON_INK_DARK = '#e2c275';
export const ICON_PAPER = '#fffdf8';

/** Home-screen icons for the web manifest: file in `public/brand/`, size, padding (px). */
export const MANIFEST_ICONS: [file: string, size: number, padding: number][] = [
  ['icon-192.png', 192, 19],
  ['icon-512.png', 512, 51],
  ['icon-maskable-512.png', 512, 112],
];

/** The browser-tab icon: one ink, switching with the visitor's colour scheme. */
export function iconSvg(): string {
  const style = `<style>svg{color:${ICON_INK_LIGHT}}@media (prefers-color-scheme:dark){svg{color:${ICON_INK_DARK}}}</style>`;
  return brandMarkSvg().replace('<defs>', `${style}<defs>`);
}

/** The mark in a fixed ink on a filled square (home-screen icons have no transparent background). */
function tileSvg(size: number, padding: number): string {
  const inner = size - padding * 2;
  const mark = brandMarkSvg('kk-tile-cut', `x="${padding}" y="${padding}" width="${inner}" height="${inner}" color="${ICON_INK_LIGHT}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${ICON_PAPER}"/>${mark}</svg>`;
}

/** Packs PNG images into an ICO container (PNG-in-ICO, Windows Vista and every current browser). */
function toIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

function write(path: string, data: string | Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(`wrote ${path}`);
}

async function main() {
  const root = process.cwd();
  write(join(root, 'public/brand/kovertklaus-mark.svg'), `${brandMarkSvg()}\n`);
  write(join(root, 'src/app/icon.svg'), `${iconSvg()}\n`);

  const apple = await sharp(Buffer.from(tileSvg(180, 18))).png().toBuffer();
  write(join(root, 'src/app/apple-icon.png'), apple);

  // Web manifest icons (src/app/manifest.ts). Maskable icons may be cropped to a circle, so the mark
  // stays inside the central 80% safe zone.
  for (const [file, size, padding] of MANIFEST_ICONS) {
    write(join(root, 'public/brand', file), await sharp(Buffer.from(tileSvg(size, padding))).png().toBuffer());
  }

  const light = brandMarkSvg('kk-ico-cut', `color="${ICON_INK_LIGHT}"`);
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(
    sizes.map(async (size) => ({ size, png: await sharp(Buffer.from(light), { density: 72 * (size / 100) * 4 }).resize(size, size).png().toBuffer() }))
  );
  write(join(root, 'src/app/favicon.ico'), toIco(pngs));
}

if (process.argv[1] && /brand-icons\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
