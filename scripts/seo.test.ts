import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import matter from 'gray-matter';
import type { Post } from '../lib/posts.ts';
import * as seo from '../lib/seo.ts';
import { getPosts, getPostBySlug, getListedPosts, getIndexablePosts, getPostTagCounts, generateFeed } from '../lib/posts.ts';
import { parseUpdatedDate } from '../lib/post-dates.ts';
import { loadContentIndex } from '../lib/content-index.ts';
import { collectionEntities, isIndexable, type EntityType } from '../lib/entities.ts';
const loadEntities = (type: EntityType) => collectionEntities(loadContentIndex().entities.values(), type);
import { generateHeaders } from './generate-headers.ts';
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function post(overrides: Partial<Post> = {}): Post {
  return {
    type: 'article', name: '一篇文章', icon: '', url: '', redirect: false, outgoing: [], incoming: [], slug: 'sample', title: '一篇文章', summary: '文章摘要', hidden: false, noindex: false, showHeader: true,
    date: new Date('2024-02-01'), dateText: '2024-02-01', updated: null,
    cover: '', tags: [], keywords: [], showTitle: true, coverDisplaySrc: '', location: '', pinned: false, images: [], content: '', plainContent: '', headings: [], ...overrides,
  } as Post;
}

function updateDate(value: string) {
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
  assert.ok(metadata.openGraph.type === 'article');
  assert.equal(metadata.openGraph.modifiedTime, '2024-02-29T00:00:00.000Z');
  assert.equal(metadata.alternates.types['text/markdown'], 'https://rainey.space/sample.md');
  const photography = seo.postMetadata(post({
    slug: 'photo-album',
    cover: '/photo-album/cover.webp',
    hidden: true,
  }));
  assert.equal(photography.openGraph.images, 'https://rainey.space/photo-album/cover.webp');
  assert.equal(seo.postJsonLd(post({
    slug: 'photo-album',
    cover: '/photo-album/cover.webp',
  }))?.image, 'https://rainey.space/photo-album/cover.webp');
  const about = seo.postMetadata(post({ slug: 'about', title: '自定义关于页', summary: '关于页摘要', hidden: true, showHeader: false }));
  assert.equal(about.title, "自定义关于页 - Rainey's Blog");
  assert.equal(about.description, '关于页摘要');
  assert.equal(about.openGraph.type, 'website');
  const friendsPage = seo.pageMetadata(seo.pages.friends);
  assert.equal(friendsPage.title, "朋友们 - Rainey's Blog");
  assert.equal(friendsPage.description, 'Rainey 的朋友们');
  assert.equal(friendsPage.openGraph.type, 'website');
  assert.equal(about.openGraph.images, 'https://rainey.space/og.jpg');
  assert.equal(about.robots, undefined);
  assert.equal(seo.postMetadata(post({ slug: 'test', hidden: true })).robots, undefined);
  assert.deepEqual(seo.postMetadata(post({ slug: 'syntax-check', noindex: true })).robots, { index: false, follow: true });
  assert.equal(seo.postMetadata(post({ slug: 'photo-album', hidden: true })).robots, undefined);
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
  const structured = seo.postJsonLd(source);
  assert.ok(structured);
  const encoded = seo.serializeJsonLd(structured);
  assert.ok(!encoded.includes('<'));
  const data = JSON.parse(encoded);
  assert.equal(data.headline, source.title);
  assert.equal(data['@type'], 'BlogPosting');
  assert.equal(data.datePublished, '2024-02-01T00:00:00.000Z');
  assert.equal(data.dateModified, '2024-02-29T00:00:00.000Z');
  assert.equal(data.image, undefined);
  assert.equal(data.author.url, 'https://rainey.space/about/');
  assert.equal(seo.postJsonLd(post({ hidden: true }))?.['@type'], 'BlogPosting');
  assert.equal(seo.postJsonLd(post({ noindex: true })), null);
  assert.equal(seo.postJsonLd(post({ slug: 'about', noindex: true })), null);
  const about = seo.postJsonLd(post({ slug: 'about', hidden: true, title: '作者介绍', summary: '自定义摘要' }));
  assert.ok(about);
  assert.equal(about['@type'], 'AboutPage');
  assert.equal(about.name, "作者介绍 - Rainey's Blog");
  assert.equal(about.description, '自定义摘要');
  const friends = seo.entityCollectionJsonLd(seo.pages.friends, loadEntities('friend'));
  assert.equal(friends['@type'], 'CollectionPage');
  assert.equal(friends.name, "朋友们 - Rainey's Blog");
  assert.equal(friends.description, 'Rainey 的朋友们');
  const registeredFriends = loadEntities('friend').filter(isIndexable);
  assert.equal(friends.mainEntity.numberOfItems, registeredFriends.length);
  assert.deepEqual(friends.mainEntity.itemListElement.map((item) => item.name), registeredFriends.map((item) => item.title ?? item.name));
  assert.equal(JSON.parse(seo.serializeJsonLd(seo.postJsonLd(post())!)).dateModified, undefined);
  const items = [{ url: 'https://example.com/', name: '项目' }, { url: seo.postUrl('hidden-album'), name: '摄影' }];
  const collection = seo.collectionJsonLd(seo.pages.projects, items).mainEntity;
  assert.deepEqual(collection.itemListElement.map((item) => item.url), items.map((item) => item.url));
  assert.deepEqual(collection.itemListElement.map((item) => item.position), [1, 2]);
});

test('collection structured data excludes redirects and noindex while keeping hidden indexable entities', () => {
  const entities = [post({ slug: 'hidden', hidden: true }), post({ slug: 'noindex', noindex: true }), post({ slug: 'redirect', redirect: true, url: 'https://example.com' }), post({ slug: 'visible' })];
  const list = seo.entityCollectionJsonLd(seo.pages.articles, entities).mainEntity;
  assert.equal(list.numberOfItems, 2);
  assert.deepEqual(list.itemListElement.map((item) => item.url), [seo.postUrl('hidden'), seo.postUrl('visible')]);
  assert.deepEqual(list.itemListElement.map((item) => item.position), [1, 2]);
  assert.equal(entities.length, 4, 'SEO filtering does not remove rendered members');
});

test('sitemap and llms include hidden indexable content without inventing dates', () => {
  const source = [post(), post({ slug: 'revised', updated: new Date('2024-02-29') }), post({ slug: 'about', hidden: true, date: null, dateText: '' }), post({ slug: 'excluded', noindex: true })];
  const entries = seo.sitemapEntries(source);
  assert.ok(entries.slice(0, Object.keys(seo.pages).length).every((entry) => entry.lastmod === undefined));
  assert.deepEqual(entries.slice(Object.keys(seo.pages).length).map((entry) => entry.lastmod), ['2024-02-01T00:00:00.000Z', '2024-02-29T00:00:00.000Z', undefined]);
  assert.ok(entries.some((entry) => entry.loc.includes('/about/')));
  assert.equal(entries.filter((entry) => entry.loc === seo.canonicalUrl(seo.pages.friends.pathname)).length, 1);
  assert.ok(!entries.some((entry) => entry.loc.includes('/excluded/')));
  assert.equal(seo.sitemapEntries([post({ date: null })]).at(-1)?.lastmod, undefined);
  const llms = seo.llmsText(source);
  assert.ok(llms.includes('https://rainey.space/sample.md'));
  assert.ok(llms.includes('[原文](https://rainey.space/sample/)'));
  assert.ok(llms.includes('更新 2024-02-29'));
  assert.ok(llms.includes('## 内容'));
  assert.ok(llms.includes('https://rainey.space/friend/'));
  assert.ok(!llms.includes('https://rainey.space/friend.md'));
  assert.ok(llms.includes('https://rainey.space/contact/'));
  assert.ok(!llms.includes('https://rainey.space/contact.md'));
  assert.equal(entries.filter((entry) => entry.loc === seo.canonicalUrl(seo.pages.contacts.pathname)).length, 1);
  assert.ok(llms.includes('https://rainey.space/about.md): 文章摘要 [原文]'));
  assert.ok(!llms.includes('/excluded/'));
  assert.equal(seo.llmsText(source), llms);
  const tricky = seo.llmsText([post({ title: '[标题](https://bad.example)\n## 假标题', summary: '<script>text</script>' })]);
  assert.ok(tricky.includes('\\[标题\\]'));
  assert.ok(!tricky.includes('\n## 假标题'));
});

async function withContentFixture(run: (directory: string) => Promise<void>) {
  const originalCwd = process.cwd();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rainey-metadata-'));
  try {
    for (const name of ['public', 'content', 'out']) await fs.mkdir(path.join(directory, name));
    process.chdir(directory);
    await run(directory);
  } finally {
    process.chdir(originalCwd);
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function writeFixture(slug: string, options = '') {
  await fs.mkdir(path.join('public', slug), { recursive: true });
  await fs.writeFile(path.join('public', slug, 'index.md'), `---\ntype: article\ntitle: ${JSON.stringify(slug)}\nsummary: Fixture summary\ndate: 2024-02-01\ntags: ${JSON.stringify(['shared', slug])}\n${options}---\n\nFixture body.\n`);
}

test('real content keeps listing, feeds and indexing independent for all four combinations', async () => {
  await withContentFixture(async () => {
    for (const hidden of [false, true]) {
      for (const noindex of [false, true]) {
        await writeFixture(`content-${hidden}-${noindex}`, `hidden: ${hidden}\nnoindex: ${noindex}\n`);
      }
    }
    const posts = await getPosts();
    const listed = await getListedPosts();
    const indexable = await getIndexablePosts();
    const feed = await generateFeed();
    const sitemap = seo.sitemapEntries(posts);
    const llms = seo.llmsText(posts);
    const tagCounts = getPostTagCounts(posts);
    assert.equal(await generateHeaders(), 2);
    const headers = await fs.readFile('out/_headers', 'utf8');
    for (const item of posts) {
      assert.equal(listed.some((entry) => entry.slug === item.slug), !item.hidden);
      assert.equal(indexable.some((entry) => entry.slug === item.slug), !item.noindex);
      for (const xml of [feed.rss2(), feed.atom1()]) assert.equal(xml.includes(seo.postUrl(item.slug)), !item.hidden);
      assert.equal(tagCounts.some((entry) => entry.tag === item.slug), !item.hidden);
      assert.equal(sitemap.some((entry) => entry.loc === seo.postUrl(item.slug)), !item.noindex);
      assert.equal(llms.includes(seo.markdownUrl(item.slug)), !item.noindex);
      assert.equal(seo.postMetadata(item).robots?.index === false, item.noindex);
      assert.equal(seo.postJsonLd(item) === null, item.noindex);
      assert.equal(headers.includes(`/${item.slug}.md\n  X-Robots-Tag: noindex`), item.noindex);
    }
  });
});

test('reader, validator and header CLI agree on defaults and reject invalid new options', async () => {
  await withContentFixture(async (directory) => {
    await writeFixture('options');
    let item = await getPostBySlug('options');
    assert.equal(item.noindex, false);
    assert.equal(item.showHeader, true);
    assert.equal(await generateHeaders(), 0);
    const validate = () => spawnSync(process.execPath, [path.join(projectRoot, 'scripts/validate-content.ts')], { cwd: directory, encoding: 'utf8' });
    assert.equal(validate().status, 0);
    await writeFixture('options', 'noindex: true\nshowHeader: false\n');
    item = await getPostBySlug('options');
    assert.equal(item.noindex, true);
    assert.equal(item.showHeader, false);
    assert.equal(validate().status, 0);
    for (const field of ['noindex', 'showHeader']) {
      for (const value of ['"false"', 'null', '', '0', '[]', '{}']) {
        await writeFixture('options', `${field}: ${value}\n`);
        const error = new RegExp(`frontmatter "${field}" must be a boolean`);
        await assert.rejects(getPostBySlug('options'), error);
        await assert.rejects(generateHeaders(), error);
        const check = validate();
        assert.equal(check.status, 1, check.stderr);
        assert.match(check.stderr, error);
      }
    }
    const headers = spawnSync(process.execPath, [path.join(projectRoot, 'scripts/generate-headers.ts')], { cwd: directory, encoding: 'utf8' });
    assert.equal(headers.status, 1);
    assert.match(headers.stderr, /showHeader/);
  });
});

test('header generation encodes slugs and removes obsolete rules without canonical links on redirects', async () => {
  await withContentFixture(async () => {
    await fs.mkdir('public/asset-only');
    const slug = '语法检查 #1';
    await writeFixture(slug, 'noindex: true\n');
    assert.deepEqual((await getPosts()).map((item) => item.slug), [slug]);
    assert.equal(await generateHeaders(), 1);
    let headers = await fs.readFile('out/_headers', 'utf8');
    assert.ok(headers.includes(`${new URL(seo.markdownUrl(slug)).pathname}\n  X-Robots-Tag: noindex`));
    await fs.rename(path.join('public', slug), 'public/renamed');
    await writeFixture('renamed', 'url: https://example.com/path?q=1#top\nredirect: true\n');
    await generateHeaders();
    headers = await fs.readFile('out/_headers', 'utf8');
    assert.ok(!headers.includes(encodeURIComponent(slug)));
    const block = headers.split(/\n\s*\n/).find((rule) => rule.startsWith('/renamed.md\n'))!;
    assert.match(block, /noindex/); assert.doesNotMatch(block, /canonical/);
    const redirects = await fs.readFile('out/_redirects', 'utf8');
    assert.match(redirects, /^\/renamed https:\/\/example.com\/path\?q=1#top 302$/m);
    assert.match(redirects, /^\/renamed\/ https:\/\/example.com\/path\?q=1#top 302$/m);
    assert.doesNotMatch(redirects, /renamed\.md|renamed\/\*/);
    assert.match(redirects, /\/articles\/ \/article\/ 301/);
    await fs.rm('public/renamed', { recursive: true });
    assert.equal(await generateHeaders(), 0);
    assert.doesNotMatch(await fs.readFile('out/_redirects', 'utf8'), /renamed/);
    await fs.rm('out', { recursive: true });
    await assert.rejects(generateHeaders(), /ENOENT/);
  });
});

test('headers cache only versioned images for a year and revalidate HTML and navigation data', async () => {
  await withContentFixture(async () => {
    await generateHeaders();
    const blocks = (await fs.readFile('out/_headers', 'utf8')).trim().split(/\n\s*\n/);
    const cacheHeaders = (pathname: string) => blocks.flatMap((block) => {
      const [pattern, ...headers] = block.split('\n');
      const regex = new RegExp('^' + pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      return regex.test(pathname) ? headers.filter((line) => line.trim().startsWith('Cache-Control:')).map((line) => line.trim().slice('Cache-Control: '.length)) : [];
    });
    assert.deepEqual(cacheHeaders('/_optimized/images/' + 'a'.repeat(64) + '/photo.jpg'), ['public, max-age=31536000, immutable']);
    assert.deepEqual(cacheHeaders('/sample/photo.jpg'), [], 'legacy original URLs must not get immutable caching');
    for (const pathname of ['/', '/sample/', '/sample/index.html', '/sample/index.txt', '/sample.md', '/feed', '/rss.xml', '/_optimized/manifest.json']) {
      assert.deepEqual(cacheHeaders(pathname), ['no-cache'], pathname);
    }
  });
});

test('content reader and CLI both enforce updated on real Markdown fixtures', async () => {
  const root = process.cwd();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rainey-seo-'));
  try {
    await fs.mkdir(path.join(directory, 'public', 'sample'), { recursive: true });
    await fs.mkdir(path.join(directory, 'content'));
    process.chdir(directory);
    for (const [updated, error] of [['2024-02-29', null], ['2024-02-30', /valid YYYY-MM-DD/], ['2024-01-31', /earlier than/]] as const) {
      await fs.writeFile(path.join(directory, 'public/sample/index.md'), `---\ntype: article\ntitle: Sample\nsummary: Summary\ndate: 2024-02-01\nupdated: ${updated}\n---\nVisible body.\n`);
      if (error) await assert.rejects(getPostBySlug('sample'), error);
      else assert.equal((await getPostBySlug('sample')).updated?.toISOString(), '2024-02-29T00:00:00.000Z');
      const check = spawnSync(process.execPath, [path.join(projectRoot, 'scripts/validate-content.ts')], { cwd: directory, encoding: 'utf8' });
      assert.equal(check.status, error ? 1 : 0, check.stderr);
      if (error) assert.match(check.stderr, error);
    }
  } finally {
    process.chdir(root);
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('Markdown headings retain inline formatting and stable anchors after renderer API upgrades', async () => {
  await withContentFixture(async (directory) => {
    await writeFixture('renderer');
    const filename = path.join(directory, 'public/renderer/index.md');
    await fs.appendFile(filename, '\n## **粗体** 与 `代码`\n\n## **粗体** 与 `代码`\n\n### [站点](https://example.com)\n\n![A & B](https://example.com/image.png "Image title")\n');
    const item = await getPostBySlug('renderer');
    assert.deepEqual(item.headings, [
      { id: '粗体-与-代码', text: '粗体 与 代码', level: 2 },
      { id: '粗体-与-代码-2', text: '粗体 与 代码', level: 2 },
      { id: '站点', text: '站点', level: 3 },
    ]);
    assert.match(item.content, /<h2 id="粗体-与-代码"><strong>粗体<\/strong> 与 <code>代码<\/code><\/h2>/);
    assert.match(item.content, /<h3 id="站点"><a href="https:\/\/example.com">站点<\/a><\/h3>/);
    assert.match(item.content, /<img src="https:\/\/example.com\/image.png" alt="A &amp; B" title="Image title" loading="lazy">/);
  });
});
