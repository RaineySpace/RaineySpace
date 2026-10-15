import assert from 'node:assert/strict';
import test from 'node:test';
import { marked } from 'marked';
import { collectEntityLinks, resolveEntityLink, transformEntityLinks, type EntityIndex } from '../lib/markdown-refs.ts';
import { entity } from './content-fixtures.ts';
import { renderEntityCardHtml } from '../lib/entity-rendering.ts';
import { entityTypes } from '../lib/entities.ts';

const items = [entity('source'), entity('p', { type: 'project', title: 'Project', url: 'https://example.com', redirect: true }), entity('private', { hidden: true, noindex: true })];
const entities = new Map(items.map((item) => [item.slug, item]));
function render(source: string, index: EntityIndex = entities, format: 'card' | 'plain' = 'card') {
  const tokens = marked.lexer(source);
  transformEntityLinks(tokens, { entities: index, source: 'source', format });
  return marked.parser(tokens) as string;
}
function inlineHrefs(html: string) {
  return [...html.matchAll(/<a class="entity-inline-link[^"]*" href="([^"]*)"/g)].map((match) => match[1]);
}

test('canonical internal URL variants resolve by slug without matching external entity URLs', () => {
  for (const href of ['/p', '/p/', '/p.md', '/p/?q=1#top', 'https://rainey.space/p/', '../p/']) assert.equal(resolveEntityLink(href, entities, 'source')?.entity?.slug, 'p', href);
  for (const href of ['https://example.com', '/assets/logo.svg', '/p/photo.jpg', '/feed', '/photography/', '/not-here/', 'mailto:a@example.com']) assert.equal(resolveEntityLink(href, entities, 'source'), null, href);
});

test('only top-level sole text links expand; query/hash/files and nested links preserve navigation', () => {
  assert.match(render('[project](/p/)'), /entity-card/);
  for (const source of ['See [**mine**](/p/).', '[**mine**](/p/)', '[`mine`](/p/)', '- [mine](/p/)', '> [mine](/p/)', '## [mine](/p/)', '[mine](/p.md)', '[mine](/p/#top)', '[mine](/p/?x=1)']) {
    const html = render(source); assert.match(html, /entity-inline-link/); assert.doesNotMatch(html, /^<article class="entity-card"/);
  }
  assert.match(render('See [**mine**](/p/).'), /<strong>mine<\/strong>/);
  assert.match(render('[file](/p.md)'), /href="\/p.md"/);
  assert.match(render('[anchor](/p/#top)'), /href="\/p\/#top"/);
});

test('collections use cards standalone and inline entities in prose without creating member relationships', () => {
  assert.match(render('[projects](/project/)'), /entity-card-list/);
  const inline = render('See [projects](/project/).');
  assert.deepEqual(inlineHrefs(inline), ['/p/']);
  assert.match(inline, /^<p>See .*<\/span>\.<\/p>\n$/);
  assert.doesNotMatch(inline, /<(?:div|ul|li|article|h[1-6])\b/);
  assert.doesNotMatch(render('[filtered](/article/?tag=x)'), /post-card/);
  assert.doesNotMatch(render('[photos](/photography/)'), /entity-card/);
  assert.deepEqual(collectEntityLinks('[projects](/project/)\n\nSee [projects](/project/).\n\n[hidden](/private/)\n\n[p](/p/) [p again](/p.md#x) [self](/source/)', entities, 'source'), ['private', 'p']);
});

test('inline collections discover members dynamically using shared visibility, names and ordering', () => {
  const contacts = [
    entity('undated', { type: 'contact', url: 'mailto:last@example.com', date: undefined }),
    entity('b', { type: 'contact', url: 'https://example.com/b', date: '2025-01-01', redirect: true }),
    entity('a', { type: 'contact', url: 'mailto:first@example.com', date: '2025-01-01', noindex: true, title: '邮箱', name: 'Email <&>' }),
    entity('other-project', { type: 'project' }),
  ];
  const index = new Map(contacts.map((item) => [item.slug, item]));
  const source = '联系：[全部联系方式](/contact/)。';
  const html = render(source, index);
  assert.deepEqual(inlineHrefs(html), ['/a/', '/b/', '/undated/']);
  assert.match(html, /entity-inline-name">Email &lt;&amp;&gt;<\/span>/);
  assert.equal((html.match(/<\/span>、<span class="entity-chip"/g) || []).length, 2);
  index.set('new-contact', entity('new-contact', { type: 'contact', url: 'https://example.com/new', date: '2026-01-01' }));
  assert.deepEqual(inlineHrefs(render(source, index)), ['/new-contact/', '/a/', '/b/', '/undated/']);
  assert.deepEqual(inlineHrefs(render('文章：[全部文章](/article/)。')), ['/source/']);
});

test('inline collections work in nested Markdown, aliases and feeds while empty collections retain navigation', () => {
  for (const source of ['See [all](/projects/).', '## [all](/project/)', '- [all](/project/)', '> [all](/project/)', 'See [all][collection].\n\n[collection]: /project/']) {
    assert.deepEqual(inlineHrefs(render(source)), ['/p/'], source);
    assert.doesNotMatch(render(source), /entity-card-list/);
  }
  const mail = entity('mail', { type: 'contact', url: 'mailto:a@example.com', name: 'Email <&>' });
  assert.equal(render('联系：[all](/contact/)。', new Map([[mail.slug, mail]]), 'plain'), '<p>联系：<a href="/mail/">Email &lt;&amp;&gt;</a>。</p>\n');
  assert.equal(render('联系：[**联系我**](/contacts/)。'), '<p>联系：<a href="/contact/"><strong>联系我</strong></a>。</p>\n');
});

test('collection queries, fragments, files, image links and code keep their authored navigation or content', () => {
  for (const href of ['/project/?tag=x', '/project/#top', '/project.md', 'https://example.com/project/']) {
    const html = render(`See [all](${href}).`);
    assert.match(html, /<a href=/);
    assert.deepEqual(inlineHrefs(html), [], href);
  }
  assert.equal(render('[![cover](./cover.jpg)](/project/)'), '<p><a href="/project/"><img src="./cover.jpg" alt="cover"></a></p>\n');
  assert.equal(render('`[all](/project/)`'), '<p><code>[all](/project/)</code></p>\n');
  assert.deepEqual(inlineHrefs(render('```md\n[all](/project/)\n```')), []);
});

test('image destinations and fenced or inline code do not become citations', () => {
  assert.deepEqual(collectEntityLinks('![image](/p/)\n\n![an [alt](/p/)](./image.jpg)\n\n`[code](/p/)`\n\n```md\n[code](/p/)\n```', entities, 'source'), []);
  const tokens = marked.lexer('[![photo](./photo.jpg "photography")](/p/)');
  transformEntityLinks(tokens, { entities, source: 'source' });
  const images: string[] = [];
  marked.walkTokens(tokens, (token) => { if (token.type === 'image') images.push(token.href); });
  assert.deepEqual(images, ['./photo.jpg']);
});

test('Markdown cards, collection members and inline previews use the same type dispatch as React', () => {
  const items = entityTypes.map((type) => entity(`target-${type}`, { type, url: 'https://example.com/' }));
  const index = new Map(items.map((item) => [item.slug, item]));
  const renderWithIndex = (source: string) => {
    const tokens = marked.lexer(source);
    transformEntityLinks(tokens, { entities: index });
    return marked.parser(tokens) as string;
  };
  for (const item of items) {
    const card = renderEntityCardHtml(item);
    assert.equal(renderWithIndex(`[作者名称](/${item.slug}/)`), card);
    assert.ok(renderWithIndex(`[集合](/${item.type}/)`).includes(card));
    const collection = renderWithIndex(`集合：[全部](/${item.type}/)。`);
    assert.deepEqual(inlineHrefs(collection), [`/${item.slug}/`]);
    assert.ok(collection.includes(renderEntityCardHtml(item, { root: 'span' })));
    const inline = renderWithIndex(`引用 [**作者名称**](/${item.slug}.md?q=1#anchor)。`);
    assert.ok(inline.includes(renderEntityCardHtml(item, { root: 'span' })));
    assert.match(inline, /<strong>作者名称<\/strong>/);
    assert.ok(inline.includes(`href="/${item.slug}.md?q=1#anchor"`));
  }
});
