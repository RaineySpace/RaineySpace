const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sharp = require('sharp');
const load = require('./load-typescript.cjs');
const { getPostBySlug } = load('lib/posts.ts');

test('image pipeline serves responsive previews, preserves originals and handles orientation and animation', async () => {
  const root = process.cwd();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rainey-images-'));
  const postDir = path.join(directory, 'public/sample');
  const picture = (width, height) => sharp({ create: { width, height, channels: 3, background: '#b2c3d4' } });
  const optimize = () => {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/optimize-images.mjs')], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  try {
    await fs.mkdir(postDir, { recursive: true });
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
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'public/_optimized/manifest.json')));
    for (const [originalSrc, display] of Object.entries(manifest)) {
      if (originalSrc.endsWith('.gif')) continue;
      assert.notEqual(display.displaySrc, originalSrc);
      for (const candidate of display.srcSet.split(', ')) {
        const [url, descriptor] = candidate.split(' ');
        const size = await sharp(path.join(directory, 'public', decodeURIComponent(url))).metadata();
        assert.equal(size.width, Number(descriptor.slice(0, -1)));
        assert.ok(Math.max(size.width, size.height) <= 1600);
        assert.equal(size.orientation, undefined);
      }
    }
    assert.deepEqual([manifest['/sample/rotated.jpg'].width, manifest['/sample/rotated.jpg'].height], [600, 1200]);
    assert.deepEqual([manifest['/sample/small.png'].width, manifest['/sample/small.png'].height], [160, 80]);
    assert.notEqual(manifest['/sample/photo.jpg'].displaySrc, manifest['/sample/photo.png'].displaySrc);
    assert.ok(manifest['/sample/%E4%B8%AD%E6%96%87%20image%2C1.png'].srcSet.includes('%20image%2C1.png'));
    assert.equal(manifest['/sample/animated.gif'].displaySrc, '/sample/animated.gif');
    assert.equal(manifest['/sample/animated.gif'].height, 8);
    assert.equal(manifest['/sample/animated.gif'].srcSet, undefined);
    assert.deepEqual(await fs.readFile(path.join(postDir, 'photo.jpg')), original);
    assert.match(optimize(), /0 variants generated/);

    process.chdir(directory);
    const post = await getPostBySlug('sample');
    assert.equal(post.cover, '/sample/photo.jpg');
    assert.equal(post.coverDisplaySrc, manifest['/sample/photo.jpg'].displaySrc);
    assert.equal(post.coverImage.srcSet, manifest['/sample/photo.jpg'].srcSet);
    assert.match(post.content, /srcset="[^\"]+320w/);
    assert.match(post.content, /width="1600" height="800"/);
    assert.match(post.content, /data-full-src="\/sample\/photo.jpg"/);
    assert.match(post.content, /data-live-src="\/sample\/photo.mov"/);

    await fs.writeFile(path.join(postDir, 'index.md'), '---\nhidden: true\n---\n![Small](./small.png)');
    optimize();
    const cleaned = JSON.parse(await fs.readFile(path.join(directory, 'public/_optimized/manifest.json')));
    assert.deepEqual(Object.keys(cleaned), ['/sample/small.png']);
    await assert.rejects(fs.access(path.join(directory, 'public', manifest['/sample/photo.jpg'].displaySrc)), { code: 'ENOENT' });
    assert.deepEqual(await fs.readFile(path.join(postDir, 'photo.jpg')), original);
  } finally {
    process.chdir(root);
    await fs.rm(directory, { recursive: true, force: true });
  }
});
