import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { parseEntityMetadata } from '../lib/entity-metadata.ts';
import { loadContentIndex } from '../lib/content-index.ts';
import { collectionEntities, isIndexable } from '../lib/entities.ts';
import { reservedSlugs } from '../lib/content-paths.ts';
import { entity } from './content-fixtures.ts';

function yaml(source: string) { const parsed = matter(`---\n${source}\n---`); return parseEntityMetadata('fixture', parsed.data, parsed.matter); }

test('shared metadata keeps optional names, SEO keywords and independent visibility controls', () => {
  const item = entity('Season', { type: 'friend', title: 'SeasonX', name: 'Season', keywords: ' SEO, title, SEO ', tags: ['blog'], noindex: true });
  assert.equal(item.name, 'Season'); assert.equal(item.title, 'SeasonX');
  assert.deepEqual(item.keywords, ['SEO', 'title']); assert.deepEqual(item.tags, ['blog']);
  assert.equal(item.hidden, undefined); assert.equal(item.showHeader, true);
  assert.equal(entity('p', { type: 'project', title: 'Project' }).name, 'Project');
  assert.equal(entity('p', { type: 'project', date: undefined, summary: undefined }).date, null);
  assert.equal(entity('about', { hidden: true, date: undefined, summary: undefined }).date, null);
  assert.equal(isIndexable(entity('hidden', { hidden: true })), true);
  assert.equal(isIndexable(entity('r', { redirect: true, url: 'https://example.com' })), false);
});

test('required fields, unknown fields and article-only flags fail instead of silently coercing', () => {
  for (const changes of [{ type: 'page' }, { title: '' }, { summary: undefined }, { date: undefined }, { extensions: {} }, { id: 'x' }, { description: 'x' }, { photography: true }, { type: 'friend', hidden: false }, { type: 'project', pinned: false }]) assert.throws(() => entity('x', changes));
  for (const field of ['noindex', 'redirect', 'showHeader', 'hidden', 'pinned']) for (const value of ['false', null, 0, []]) assert.throws(() => entity('x', { [field]: value }), /boolean/);
  for (const field of ['tags', 'keywords']) assert.throws(() => entity('x', { [field]: [42] }), /string array/);
});

test('calendar dates reject YAML rollover and do not infer missing dates', () => {
  assert.equal(yaml('type: article\ntitle: X\nsummary: X\ndate: 2024-02-29').dateText, '2024-02-29');
  for (const date of ['2024-02-30', '"2024-02-30"', '2024-2-01', 'null', 'true']) assert.throws(() => yaml(`type: article\ntitle: X\nsummary: X\ndate: ${date}`), /YYYY-MM-DD/);
  assert.throws(() => entity('x', { updated: '2024-01-01' }), /earlier/);
});

test('contact actions, redirect targets and image fields have distinct validation', () => {
  assert.equal(entity('mail', { type: 'contact', url: 'mailto:a@example.com?subject=Hi' }).url, 'mailto:a@example.com?subject=Hi');
  for (const changes of [{ type: 'contact' }, { type: 'project', url: 'mailto:a@example.com' }, { type: 'contact', url: 'mailto:a@example.com', redirect: true }, { redirect: true }, { redirect: true, url: 'https://rainey.space/sample/' }, { url: 'javascript:alert(1)' }, { icon: 'http://example.com/i.png' }, { icon: '/../secret' }, { cover: '../escape.png' }]) assert.throws(() => entity('sample', changes));
  assert.equal(entity('x', { icon: '/assets/a.svg', cover: './photo.jpg', url: 'https://example.com', redirect: false }).redirect, false);
});

test('collections sort by date with article-only pinning, missing dates and deterministic ties', () => {
  const items = [entity('z'), entity('a'), entity('old', { date: '2020-01-01', pinned: true }), entity('hidden', { hidden: true }), entity('p', { type: 'project' }), entity('undated', { type: 'project', date: undefined })];
  assert.deepEqual(collectionEntities(items, 'article').map((i) => i.slug), ['old', 'a', 'z']);
  assert.deepEqual(collectionEntities(items, 'project').map((i) => i.slug), ['p', 'undated']);
});

test('both current and legacy collection routes are reserved everywhere', () => {
  for (const slug of reservedSlugs) assert.throws(() => entity(slug), /reserved/);
  assert.equal(entity('中文 #1').slug, '中文 #1');
});

test('two-phase index permits citation cycles and includes hidden, noindex and redirect documents', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'document-index-'));
  const write = (slug: string, metadata: string, body: string) => {
    fs.mkdirSync(path.join(root, 'public', slug), { recursive: true });
    fs.writeFileSync(path.join(root, 'public', slug, 'index.md'), `---\ntitle: ${slug}\n${metadata}\n---\n${body}`);
  };
  try {
    write('a', 'type: article\nhidden: true\nnoindex: true', '[B](/b/) [B again](/b.md#x) [self](/a/)\n\n[projects](/project/)');
    write('b', 'type: project\nurl: https://example.com\nredirect: true', '[A](/a/)');
    let index = loadContentIndex(root);
    assert.deepEqual(index.outgoing.get('a'), ['b']); assert.deepEqual(index.incoming.get('a'), ['b']);
    assert.equal(index.entities.size, 2);
    write('a', 'type: article\nhidden: true\nurl: https://rainey.space/b/\nredirect: true', '');
    write('b', 'type: project\nurl: https://rainey.space/a/\nredirect: true', '');
    assert.throws(() => loadContentIndex(root), /redirect cycle/);
    write('a', 'type: article\nhidden: true', ''); write('b', 'type: project', '');
    index = loadContentIndex(root); assert.equal(index.entities.size, 2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
