import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAspectFitDimensions,
  formatFileSize,
  validateImageFile,
  isDataUrl,
} from './imageCompression';

test('Aspect Fit Dimension Calculations', async (t) => {
  await t.test('Leaves dimensions unchanged if already within bounds', () => {
    const res = calculateAspectFitDimensions(800, 600, 1200, 1200);
    assert.equal(res.width, 800);
    assert.equal(res.height, 600);
  });

  await t.test('Scales down wide landscape image preserving aspect ratio', () => {
    const res = calculateAspectFitDimensions(2400, 1200, 1200, 1200);
    assert.equal(res.width, 1200);
    assert.equal(res.height, 600);
  });

  await t.test('Scales down tall portrait image preserving aspect ratio', () => {
    const res = calculateAspectFitDimensions(1000, 3000, 1200, 1200);
    assert.equal(res.width, 400);
    assert.equal(res.height, 1200);
  });

  await t.test('Scales square image evenly', () => {
    const res = calculateAspectFitDimensions(4000, 4000, 1000, 1000);
    assert.equal(res.width, 1000);
    assert.equal(res.height, 1000);
  });

  await t.test('Handles zero or negative source dimensions safely', () => {
    const res = calculateAspectFitDimensions(0, 0, 800, 800);
    assert.equal(res.width, 800);
    assert.equal(res.height, 800);
  });
});

test('File Size Formatter', async (t) => {
  await t.test('Formats bytes, KB, and MB accurately', () => {
    assert.equal(formatFileSize(0), '0 B');
    assert.equal(formatFileSize(512), '512 B');
    assert.equal(formatFileSize(1024), '1.0 KB');
    assert.equal(formatFileSize(86420), '84.4 KB');
    assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB');
  });
});

test('Image File Validation & Data URL Detection', async (t) => {
  await t.test('Identifies valid Base64 data URLs', () => {
    assert.equal(isDataUrl('data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/1/4='), true);
    assert.equal(isDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD'), true);
    assert.equal(isDataUrl('https://example.com/photo.jpg'), false);
    assert.equal(isDataUrl('invalid-string'), false);
    assert.equal(isDataUrl(''), false);
  });

  await t.test('Validates file types and size bounds', () => {
    // Mock File object
    const mockValidFile = {
      name: 'gift.jpg',
      type: 'image/jpeg',
      size: 2 * 1024 * 1024,
    } as File;

    const mockOversizedFile = {
      name: 'huge.png',
      type: 'image/png',
      size: 20 * 1024 * 1024,
    } as File;

    const mockTextFile = {
      name: 'notes.txt',
      type: 'text/plain',
      size: 500,
    } as File;

    const validRes = validateImageFile(mockValidFile, 15 * 1024 * 1024);
    assert.equal(validRes.valid, true);

    const oversizedRes = validateImageFile(mockOversizedFile, 10 * 1024 * 1024);
    assert.equal(oversizedRes.valid, false);
    assert.ok(oversizedRes.error?.includes('exceeds maximum allowed size'));

    const invalidTypeRes = validateImageFile(mockTextFile);
    assert.equal(invalidTypeRes.valid, false);
    assert.ok(invalidTypeRes.error?.includes('Unsupported file type'));
  });
});
