import assert from 'node:assert/strict';
import test from 'node:test';
import { marked } from 'marked';
import { collectEntityLinks, resolveEntityLink, transformEntityLinks } from '../lib/markdown-refs.ts';
import { entity } from './content-fixtures.ts';
import { renderEntityCardHtml } from '../lib/entity-rendering.ts';
import { entityTypes } from '../lib/entities.ts';

const items = [entity('source'), entity('p', { type: 'project', title: 'Project', url: 'https://example.com', redirect: true }), entity('private', { hidden: true, noindex: true })];
const entities = new Map(items.map((item) => [item.slug, item]));
function render(source: string) { const tokens = marked.lexer(source); transformEntityLinks(tokens, { entities, source: 'source' }); return marked.parser(tokens) as string; }

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

test('collections expand only standalone and do not create member relationships', () => {
  assert.match(render('[projects](/project/)'), /entity-card-list/);
  assert.doesNotMatch(render('See [projects](/project/).'), /entity-card-list/);
  assert.doesNotMatch(render('[filtered](/article/?tag=x)'), /post-card/);
  assert.doesNotMatch(render('[photos](/photography/)'), /entity-card/);
  assert.deepEqual(collectEntityLinks('[projects](/project/)\n\n[hidden](/private/)\n\n[p](/p/) [p again](/p.md#x) [self](/source/)', entities, 'source'), ['private', 'p']);
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
    const inline = renderWithIndex(`引用 [**作者名称**](/${item.slug}.md?q=1#anchor)。`);
    assert.ok(inline.includes(renderEntityCardHtml(item, { root: 'span' })));
    assert.match(inline, /<strong>作者名称<\/strong>/);
    assert.ok(inline.includes(`href="/${item.slug}.md?q=1#anchor"`));
  }
});
