import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { getPostBySlug, type PostImage } from '../lib/posts.ts';
import { collectPhotographyPhotos, getPhotographyPhotos } from '../lib/photography.ts';
import { redirectTarget } from '../lib/redirects.ts';
import { post } from './content-fixtures.ts';

function photo(id: string, capturedAt?: string, photography = true): PostImage {
  return { id, anchor: `photo-${id}`, src: `/${id}.jpg`, displaySrc: `/${id}.jpg`, alt: id, photography, capturedAt };
}

test('flat photo ordering uses capture time then document time, never pinning or fabricated display dates', () => {
  const old = post('old', { date: '2020-01-01', pinned: true }); old.images = [photo('old-1', '2024-03-01'), photo('old-2', undefined, false)];
  const recent = post('recent', { date: '2024-02-01', hidden: true, noindex: true }); recent.images = [photo('recent-1'), photo('recent-2')];
  const undated = post('undated', { hidden: true, date: undefined }); undated.images = [photo('undated-1')];
  const photos = collectPhotographyPhotos([undated, recent, old]);
  assert.deepEqual(photos.map((item) => item.id), ['old-1', 'recent-1', 'recent-2', 'undated-1']);
  assert.equal(photos[1].capturedAt, undefined); assert.equal(photos[3].date, '');
});

test('a later marked occurrence selects one image and emits one stable anchor with no marker tooltip', async () => {
  const original = process.cwd();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-marker-'));
  try {
    await fs.mkdir(path.join(root, 'public', 'source'), { recursive: true });
    await fs.writeFile(path.join(root, 'public/source/index.md'), '---\ntype: article\ntitle: Source\nhidden: true\n---\n![ordinary](./photo.svg)\n\n![selected](photo.svg "photography")\n\n![other](./other.svg "caption")\n');
    await fs.writeFile(path.join(root, 'public/source/photo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    await fs.writeFile(path.join(root, 'public/source/photo.MOV'), 'fixture');
    process.chdir(root);
    const source = await getPostBySlug('source');
    const selected = source.images.filter((image) => image.photography);
    assert.equal(selected.length, 1); assert.equal(selected[0].alt, 'selected');
    assert.equal(selected[0].liveVideoSrc, '/source/photo.MOV');
    assert.equal(source.content.match(/id="photo-photo.svg"/g)?.length, 1);
    assert.doesNotMatch(source.content, /title="photography"/);
    assert.match(source.content, /title="caption"/);
  } finally { process.chdir(original); await fs.rm(root, { recursive: true, force: true }); }
});

test('existing photography migration keeps all 70 images and their source identities', async () => {
  const photos = await getPhotographyPhotos();
  assert.equal(photos.length, 70); assert.equal(new Set(photos.map((item) => item.id)).size, 70);
  assert.equal(new Set(photos.map((item) => item.sourceSlug)).size, 9);
  assert.ok(photos.every((photo) => photo.anchor && photo.capturedAt));
});

test('validator rejects invalid marked images but permits ordinary missing images and literal alt links', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-validation-'));
  try {
    const directory = path.join(root, 'public', 'source');
    await fs.mkdir(path.join(directory, 'folder'), { recursive: true });
    await fs.writeFile(path.join(directory, 'photo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const cases: [string, number][] = [
      ['![photo](./photo.svg "photography")', 0],
      ['![](./photo.svg "photography")', 1],
      ['![photo](https://example.com/photo.jpg "photography")', 1],
      ['![photo](../photo.svg "photography")', 1],
      ['![photo](./missing.svg "photography")', 1],
      ['![photo](./folder "photography")', 1],
      ['![ordinary](./missing.svg)', 0],
      ['![literal [link](/unknown/)](./photo.svg "photography")', 0],
    ];
    for (const [body, status] of cases) {
      await fs.writeFile(path.join(directory, 'index.md'), `---\ntype: article\ntitle: Source\ndate: 2024-01-01\nsummary: Source\n---\n${body}\n`);
      const result = spawnSync(process.execPath, [fileURLToPath(new URL('./validate-content.ts', import.meta.url))], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, status, `${body}\n${result.stderr}`);
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('static fallback redirects preserve target parameters and Pages query behavior', () => {
  assert.equal(redirectTarget('/article/', 'https://rainey.space/articles/?tag=x#top'), 'https://rainey.space/article/?tag=x#top');
  assert.equal(redirectTarget('https://example.com/?q=target#target', 'https://rainey.space/p/?q=source#source'), 'https://example.com/?q=target#target');
});
