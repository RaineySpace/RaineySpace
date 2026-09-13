const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const matter = require('gray-matter');
const load = require('./load-typescript.cjs');
const seo = load('lib/seo.ts');
const { getPostBySlug, getRelatedPosts } = load('lib/posts.ts');
const { parseUpdatedDate } = require('../lib/post-dates.mjs');

function post(overrides = {}) {
  return {
    slug: 'sample', title: '一篇文章', summary: '文章摘要', hidden: false,
    date: new Date('2024-02-01'), dateText: '2024-02-01', updated: null,
    cover: '', tags: [], keywords: [], ...overrides,
  };
}

function updateDate(value) {
  const parsed = matter(`---\ndate: 2024-02-01\nupdated: ${value}\n---\n`);
  return parseUpdatedDate(parsed.data.updated, parsed.data.date, parsed.matter);
}

test('canonical URLs consolidate query strings and preserve encoded slug characters', () => {
  assert.equal(seo.canonicalUrl('/articles?tag=摄影&utm_source=chatgpt#top'), 'https://rainey.space/articles/');
  assert.equal(seo.canonicalUrl('/articles///'), 'https://rainey.space/articles/');
  assert.equal(seo.canonicalUrl('/'), 'https://rainey.space/');
  assert.equal(seo.postUrl('中文 ?#'), 'https://rainey.space/%E4%B8%AD%E6%96%87%20%3F%23/');
  assert.equal(seo.markdownUrl('中文 ?#'), 'https://rainey.space/%E4%B8%AD%E6%96%87%20%3F%23.md');
});

test('metadata keeps each page identity, feed discovery and Markdown alternates', () => {
  for (const page of Object.values(seo.pages)) {
    const metadata = seo.pageMetadata(page);
    assert.equal(metadata.openGraph.url, seo.canonicalUrl(page.pathname));
    assert.equal(metadata.openGraph.title, page.title);
    assert.equal(metadata.twitter.description, page.description);
    assert.equal(metadata.openGraph.locale, 'zh_CN');
    assert.equal(metadata.twitter.creator, '@XueRainey');
    assert.ok(metadata.alternates.types['application/rss+xml']);
    assert.ok(metadata.alternates.types['application/atom+xml']);
  }
  const metadata = seo.postMetadata(post({ cover: '/sample/cover.webp', updated: new Date('2024-02-29') }));
  assert.equal(metadata.openGraph.images, 'https://rainey.space/sample/cover.webp');
  assert.equal(metadata.openGraph.modifiedTime, '2024-02-29T00:00:00.000Z');
  assert.equal(metadata.alternates.types['text/markdown'], 'https://rainey.space/sample.md');
  const about = seo.postMetadata(post({ slug: 'about', title: 'about', hidden: true }));
  assert.equal(about.title, "关于 Rainey - Rainey's Blog");
  assert.equal(about.openGraph.type, 'website');
  assert.equal(about.robots, undefined);
  assert.deepEqual(seo.postMetadata(post({ slug: 'test', hidden: true })).robots, { index: false, follow: true });
  assert.equal(seo.postMetadata(post({ slug: 'photo-album', hidden: true })).robots, undefined);
});

test('related reading uses shared tags and excludes hidden, unrelated and current posts', () => {
  const current = post({ tags: ['AI', '生活'] });
  const source = [
    current,
    post({ slug: 'hidden', hidden: true, tags: ['AI', '生活'] }),
    post({ slug: 'unrelated', tags: ['摄影'] }),
    post({ slug: 'older', tags: ['AI'], date: new Date('2024-01-01') }),
    post({ slug: 'newer', tags: ['AI'], date: new Date('2024-03-01') }),
    post({ slug: 'closest', tags: ['AI', '生活'] }),
  ];
  assert.deepEqual(getRelatedPosts(current, source).map((item) => item.slug), ['closest', 'newer', 'older']);
  assert.deepEqual(getRelatedPosts(current, source, 1).map((item) => item.slug), ['closest']);
  assert.deepEqual(getRelatedPosts(post(), source), []);
  assert.deepEqual(getRelatedPosts(post({ hidden: true, tags: ['AI'] }), source), []);
});

test('updated accepts real calendar dates and rejects rollover, wrong types and earlier dates', () => {
  assert.equal(parseUpdatedDate(undefined, null, ''), null);
  for (const value of ['2024-02-29', '"2024-02-29"', "'2024-02-29'", '2024-02-29 # revision', '2024-02-01']) {
    assert.ok(updateDate(value) instanceof Date, value);
  }
  for (const value of ['2024-02-30', '"2024-02-30"', '2023-02-29', '2024-13-01', '2024-2-29', '2024-02-29T12:00:00Z', 'true', 'null', '123', '[]', '""']) {
    assert.throws(() => updateDate(value), /valid YYYY-MM-DD/, value);
  }
  assert.throws(() => updateDate('2024-01-31'), /earlier than/);
  assert.throws(() => parseUpdatedDate('2024-02-29', null, ''), /requires a valid/);
});

test('structured data uses real content and safely handles a script-closing title', () => {
  const source = post({ title: '标题 </script><script>alert(1)</script>', updated: new Date('2024-02-29') });
  const encoded = seo.serializeJsonLd(seo.postJsonLd(source));
  assert.ok(!encoded.includes('<'));
  const data = JSON.parse(encoded);
  assert.equal(data.headline, source.title);
  assert.equal(data['@type'], 'BlogPosting');
  assert.equal(data.datePublished, '2024-02-01T00:00:00.000Z');
  assert.equal(data.dateModified, '2024-02-29T00:00:00.000Z');
  assert.equal(data.image, undefined);
  assert.equal(data.author.url, 'https://rainey.space/about/');
  assert.equal(seo.postJsonLd(post({ hidden: true })), null);
  assert.equal(seo.postJsonLd(post({ slug: 'about', hidden: true }))['@type'], 'AboutPage');
  assert.equal(JSON.parse(seo.serializeJsonLd(seo.postJsonLd(post()))).dateModified, undefined);
  const items = [{ url: 'https://example.com/', name: '项目' }, { url: seo.postUrl('hidden-album'), name: '摄影' }];
  const collection = seo.collectionJsonLd(seo.pages.projects, items).mainEntity;
  assert.deepEqual(collection.itemListElement.map((item) => item.url), items.map((item) => item.url));
  assert.deepEqual(collection.itemListElement.map((item) => item.position), [1, 2]);
});

test('sitemap and llms omit hidden posts and never invent modification dates', () => {
  const source = [post(), post({ slug: 'revised', updated: new Date('2024-02-29') }), post({ slug: 'hidden', hidden: true })];
  const entries = seo.sitemapEntries(source);
  assert.ok(entries.slice(0, 4).every((entry) => entry.lastmod === undefined));
  assert.deepEqual(entries.slice(4).map((entry) => entry.lastmod), ['2024-02-01T00:00:00.000Z', '2024-02-29T00:00:00.000Z']);
  assert.ok(!entries.some((entry) => entry.loc.includes('/hidden/')));
  assert.equal(seo.sitemapEntries([post({ date: null })]).at(-1).lastmod, undefined);
  const llms = seo.llmsText(source);
  assert.ok(llms.includes('https://rainey.space/sample.md'));
  assert.ok(llms.includes('[原文](https://rainey.space/sample/)'));
  assert.ok(llms.includes('更新 2024-02-29'));
  assert.ok(!llms.includes('/hidden/'));
  assert.equal(seo.llmsText(source), llms);
  const tricky = seo.llmsText([post({ title: '[标题](https://bad.example)\n## 假标题', summary: '<script>text</script>' })]);
  assert.ok(tricky.includes('\\[标题\\]'));
  assert.ok(!tricky.includes('\n## 假标题'));
});

test('content reader and CLI both enforce updated on real Markdown fixtures', async () => {
  const root = process.cwd();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rainey-seo-'));
  try {
    await fs.mkdir(path.join(directory, 'public', 'sample'), { recursive: true });
    await fs.mkdir(path.join(directory, 'content'));
    await fs.writeFile(path.join(directory, 'content/projects.json'), '{}');
    process.chdir(directory);
    for (const [updated, error] of [['2024-02-29', null], ['2024-02-30', /valid YYYY-MM-DD/], ['2024-01-31', /earlier than/]]) {
      await fs.writeFile(path.join(directory, 'public/sample/index.md'), `---\ntitle: Sample\nsummary: Summary\ndate: 2024-02-01\nupdated: ${updated}\n---\nVisible body.\n`);
      if (error) await assert.rejects(getPostBySlug('sample'), error);
      else assert.equal((await getPostBySlug('sample')).updated.toISOString(), '2024-02-29T00:00:00.000Z');
      const check = spawnSync(process.execPath, [path.join(root, 'scripts/validate-content.mjs')], { cwd: directory, encoding: 'utf8' });
      assert.equal(check.status, error ? 1 : 0, check.stderr);
      if (error) assert.match(check.stderr, error);
    }
  } finally {
    process.chdir(root);
    await fs.rm(directory, { recursive: true, force: true });
  }
});
