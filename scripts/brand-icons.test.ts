import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brandMarkSvg } from '../src/lib/brand-mark';
import { iconSvg, MANIFEST_ICONS } from './brand-icons';

const root = process.cwd();

test('Brand: public/brand mark and src/app/icon.svg match src/lib/brand-mark.ts (run `npm run brand:icons`)', () => {
  assert.equal(readFileSync(join(root, 'public/brand/kovertklaus-mark.svg'), 'utf8'), `${brandMarkSvg()}\n`);
  assert.equal(readFileSync(join(root, 'src/app/icon.svg'), 'utf8'), `${iconSvg()}\n`);
});

test('Brand: each copy of the mark gets its own mask id', () => {
  const a = brandMarkSvg('kk-a');
  assert.equal((a.match(/id="kk-a"/g) ?? []).length, 1);
  assert.ok(a.includes('url(#kk-a)'));
  assert.ok(!a.includes('{{MASK_ID}}'));
  assert.throws(() => brandMarkSvg('"><script>'));
});

test('Brand: favicon.ico holds 16, 32 and 48px PNG images', () => {
  const ico = readFileSync(join(root, 'src/app/favicon.ico'));
  assert.equal(ico.readUInt16LE(2), 1);
  const count = ico.readUInt16LE(4);
  const sizes = Array.from({ length: count }, (_, i) => ico.readUInt8(6 + 16 * i));
  assert.deepEqual(sizes, [16, 32, 48]);
  const firstOffset = ico.readUInt32LE(6 + 12);
  assert.equal(ico.subarray(firstOffset + 1, firstOffset + 4).toString('ascii'), 'PNG');
});

test('Brand: the web manifest icons exist at their stated sizes (run `npm run brand:icons`)', async () => {
  const sharp = (await import('sharp')).default;
  const { default: manifest } = await import('../src/app/manifest');
  const m = manifest();
  assert.equal(m.start_url, '/dashboard');
  for (const icon of m.icons ?? []) {
    const file = join(root, 'public', icon.src);
    const meta = await sharp(readFileSync(file)).metadata();
    assert.equal(`${meta.width}x${meta.height}`, icon.sizes, icon.src);
    // Home-screen icons have no transparent background: the corner pixel is opaque paper.
    const { data, info } = await sharp(readFileSync(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(data[info.channels - 1], 255, `${icon.src}: corner must be opaque`);
  }
  assert.ok((m.icons ?? []).some((i) => i.purpose === 'maskable'));
  for (const [file, size, padding] of MANIFEST_ICONS) {
    assert.ok(padding / size >= (file.includes('maskable') ? 0.2 : 0.09), `${file}: padding`);
  }
});
