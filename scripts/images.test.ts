import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getPostBySlug } from '../lib/posts.ts';

import type { ImageManifest } from "../lib/optimized-images.ts";

test('image pipeline serves responsive previews, preserves originals and handles orientation and animation', async () => {
  const root = process.cwd();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rainey-images-'));
  const postDir = path.join(directory, 'public/sample');
  const picture = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#b2c3d4' } });
  const optimize = () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./optimize-images.ts', import.meta.url))], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  try {
    await fs.mkdir(postDir, { recursive: true });
    await fs.mkdir(path.join(directory, 'content'), { recursive: true });
    await fs.writeFile(path.join(directory, 'content/projects.json'), '{}');
    await fs.writeFile(path.join(directory, 'content/friends.json'), '{}');
    await fs.writeFile(path.join(directory, 'content/contacts.json'), '{}');
    await picture(2400, 1200).jpeg().toFile(path.join(postDir, 'photo.jpg'));
    await picture(800, 600).png().toFile(path.join(postDir, 'photo.png'));
    await picture(1200, 600).withMetadata({ orientation: 6 }).jpeg().toFile(path.join(postDir, 'rotated.jpg'));
    await picture(1200, 1800).jpeg().toFile(path.join(postDir, 'portrait.jpg'));
    await picture(160, 80).png().toFile(path.join(postDir, 'small.png'));
    await picture(800, 600).png().toFile(path.join(postDir, '中文 image,1.png'));
    const frames = Buffer.concat([Buffer.alloc(8 * 8 * 3, 0), Buffer.alloc(8 * 8 * 3, 255)]);
    await sharp(frames, { raw: { width: 8, height: 16, channels: 3, pageHeight: 8 } }).gif({ delay: [100, 100] }).toFile(path.join(postDir, 'animated.gif'));
    const original = await fs.readFile(path.join(postDir, 'photo.jpg'));
    const markdown = `---\ntitle: Sample\nsummary: Summary\ndate: 2024-02-01\ncover: ./photo.jpg\n---\n` +
      ['photo.jpg', 'photo.png', 'rotated.jpg', 'portrait.jpg', 'small.png', '中文 image,1.png', 'animated.gif'].map((name) => `![Image](<./${name}>)`).join('\n\n');
    await fs.writeFile(path.join(postDir, 'index.md'), markdown);
    await fs.writeFile(path.join(postDir, 'photo.mov'), 'live photo fixture');
    optimize();
    const manifest: ImageManifest = JSON.parse(await fs.readFile(path.join(directory, 'public/_optimized/manifest.json'), 'utf8'));
    for (const [originalSrc, display] of Object.entries(manifest)) {
      const originalBytes = await fs.readFile(path.join(directory, 'public', decodeURIComponent(originalSrc)));
      assert.match(display.originalSrc, /^\/_optimized\/images\/[a-f0-9]{64}\//);
      assert.deepEqual(await fs.readFile(path.join(directory, 'public', decodeURIComponent(display.originalSrc))), originalBytes);
      if (originalSrc.endsWith('.gif')) continue;
      assert.notEqual(display.displaySrc, originalSrc);
      assert.ok(display.srcSet);
      for (const candidate of display.srcSet.split(', ')) {
        const [url, descriptor] = candidate.split(' ');
        const size = await sharp(path.join(directory, 'public', decodeURIComponent(url))).metadata();
        const bytes = await fs.readFile(path.join(directory, 'public', decodeURIComponent(url)));
        assert.equal(url.split('/')[3], createHash('sha256').update(bytes).digest('hex'));
        assert.equal(size.width, Number(descriptor.slice(0, -1)));
        assert.ok(size.width && size.height);
        assert.ok(Math.max(size.width, size.height) <= 1600);
        assert.equal(size.orientation, undefined);
      }
    }
    assert.deepEqual([manifest['/sample/rotated.jpg'].width, manifest['/sample/rotated.jpg'].height], [600, 1200]);
    assert.deepEqual([manifest['/sample/small.png'].width, manifest['/sample/small.png'].height], [160, 80]);
    assert.notEqual(manifest['/sample/photo.jpg'].displaySrc, manifest['/sample/photo.png'].displaySrc);
    assert.ok(manifest['/sample/%E4%B8%AD%E6%96%87%20image%2C1.png'].srcSet?.includes('%20image%2C1.png'));
    assert.equal(manifest['/sample/animated.gif'].displaySrc, manifest['/sample/animated.gif'].originalSrc);
    assert.equal(manifest['/sample/animated.gif'].height, 8);
    assert.equal(manifest['/sample/animated.gif'].srcSet, undefined);
    assert.deepEqual(await fs.readFile(path.join(postDir, 'photo.jpg')), original);
    assert.match(optimize(), /0 variants generated/);

    process.chdir(directory);
    const post = await getPostBySlug('sample');
    assert.equal(post.cover, manifest['/sample/photo.jpg'].originalSrc);
    assert.equal(post.coverDisplaySrc, manifest['/sample/photo.jpg'].displaySrc);
    assert.ok(post.coverImage);
    assert.equal(post.coverImage.srcSet, manifest['/sample/photo.jpg'].srcSet);
    assert.match(post.content, /srcset="[^\"]+320w/);
    assert.match(post.content, /width="1600" height="800"/);
    assert.ok(post.content.includes(`data-full-src="${manifest['/sample/photo.jpg'].originalSrc}"`));
    assert.equal(post.images[0].src, manifest['/sample/photo.jpg'].originalSrc);
    assert.equal(post.coverImage.originalSrc, post.images[0].src);
    assert.equal('sourceHash' in post.images[0], false);
    assert.equal('pipelineHash' in post.coverImage, false);
    assert.match(post.content, /data-live-src="\/sample\/photo.mov"/);

    await fs.writeFile(path.join(postDir, 'index.md'), '---\nhidden: true\n---\n![Small](./small.png)');
    optimize();
    const cleaned = JSON.parse(await fs.readFile(path.join(directory, 'public/_optimized/manifest.json'), 'utf8'));
    assert.deepEqual(Object.keys(cleaned), ['/sample/small.png']);
    await assert.rejects(fs.access(path.join(directory, 'public', manifest['/sample/photo.jpg'].displaySrc)), { code: 'ENOENT' });
    await assert.rejects(fs.access(path.join(directory, 'public', manifest['/sample/photo.jpg'].originalSrc)), { code: 'ENOENT' });
    assert.deepEqual(await fs.readFile(path.join(postDir, 'photo.jpg')), original);
  } finally {
    process.chdir(root);
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('content versions survive rebuilds and timestamp changes, change on replacement, and repair damaged outputs', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rainey-image-versions-'));
  const publicDir = path.join(directory, 'public');
  const postDir = path.join(publicDir, 'sample');
  const source = path.join(postDir, 'photo.jpg');
  const manifestPath = path.join(publicDir, '_optimized/manifest.json');
  const file = (url: string) => path.join(publicDir, decodeURIComponent(url));
  const optimize = async (): Promise<ImageManifest> => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./optimize-images.ts', import.meta.url))], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  };
  try {
    await fs.mkdir(postDir, { recursive: true });
    const original = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#b2c3d4' } }).jpeg().toBuffer();
    await fs.writeFile(source, original);
    await fs.writeFile(path.join(postDir, 'other.jpg'), original);
    await fs.writeFile(path.join(postDir, 'index.md'), '---\ntitle: Versions\ndate: 2024-02-01\ncover: ./photo.jpg\n---\n![Photo](./photo.jpg)\n\n![Other](./other.jpg)\n');
    const first = await optimize();
    const stat = await fs.stat(source);
    await fs.utimes(source, stat.atime, new Date(stat.mtimeMs + 10000));
    assert.deepEqual(await optimize(), first, 'mtime-only changes must not change versions');

    await fs.unlink(file(first['/sample/photo.jpg'].displaySrc));
    await fs.writeFile(file(first['/sample/photo.jpg'].originalSrc), 'damaged build cache');
    assert.deepEqual(await optimize(), first, 'repairing the build cache preserves content URLs');
    assert.deepEqual(await fs.readFile(file(first['/sample/photo.jpg'].originalSrc)), original);

    const replacement = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#334455' } }).jpeg().toBuffer();
    await fs.writeFile(source, replacement);
    await fs.utimes(source, stat.atime, stat.mtime);
    const second = await optimize();
    for (const field of ['originalSrc', 'displaySrc', 'thumbnailSrc', 'srcSet'] as const) {
      assert.notEqual(second['/sample/photo.jpg'][field], first['/sample/photo.jpg'][field], field);
      assert.equal(second['/sample/other.jpg'][field], first['/sample/other.jpg'][field], 'unmodified photo: ' + field);
    }
    assert.deepEqual(await fs.readFile(file(second['/sample/photo.jpg'].originalSrc)), replacement);
    assert.deepEqual(await fs.readFile(source), replacement, 'source files stay at their original public paths');
    await assert.rejects(fs.access(file(first['/sample/photo.jpg'].originalSrc)), { code: 'ENOENT' });
    await assert.rejects(fs.access(file(first['/sample/photo.jpg'].displaySrc)), { code: 'ENOENT' });
    assert.deepEqual(await optimize(), second, 'unchanged subsequent builds keep the replacement URL');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
