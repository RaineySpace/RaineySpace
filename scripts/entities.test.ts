import assert from 'node:assert/strict';
import test from 'node:test';
import { getEntityPresentation, renderEntityCardHtml, renderEntityHtml, renderEntityInlineHtml } from '../lib/entity-rendering.ts';
import { entityTypes, type EntityType } from '../lib/entities.ts';
import { entity } from './content-fixtures.ts';
import { loadContentIndex } from '../lib/content-index.ts';

test('cards preserve title and summary while linking to the local entity identity', () => {
  const item = entity('Season', { type: 'friend', title: 'SeasonX', name: 'Season', url: 'https://example.com', redirect: true });
  const card = renderEntityHtml(item);
  assert.match(card, /href="\/Season\/" data-no-page-transition/);
  assert.match(card, />SeasonX<\/h3>/); assert.doesNotMatch(card, /target="_blank"/);
  const inline = renderEntityHtml(item, { variant: 'inline', appearance: 'chip' });
  assert.match(inline, /entity-inline-name">Season</); assert.match(inline, /entity-chip-popover/);
});

test('author labels retain formatting and HTML text fields are escaped', () => {
  const item = entity('p', { type: 'project', title: '<script>bad</script>', summary: 'A & B' });
  const card = renderEntityHtml(item);
  assert.match(card, /&lt;script&gt;/); assert.match(card, /A &amp; B/); assert.doesNotMatch(card, /<script>/);
  const inline = renderEntityInlineHtml(item, {}, { href: '/p/?x=1&y=2#hello', html: '<strong>作者文字</strong>' });
  assert.match(inline, /<strong>作者文字<\/strong>/); assert.match(inline, /href="\/p\/\?x=1&amp;y=2#hello"/);
});

test('contacts use local cards but explicit external actions retain mailto and accessibility', () => {
  const mail = entity('email', { type: 'contact', title: '邮箱', url: 'mailto:a@example.com', icon: '/assets/contacts/email.svg' });
  assert.match(renderEntityHtml(mail), /href="\/email\/"/);
  const action = renderEntityHtml(mail, { variant: 'inline', appearance: 'icon', external: true, newTab: true });
  assert.match(action, /href="mailto:a@example.com"/); assert.match(action, /aria-label="邮箱"/);
  assert.doesNotMatch(action, /target="_blank"/);
});

test('article cards share text layout without cover or icon and no-icon entity variants stay supported', () => {
  const article = renderEntityHtml(entity('a', { cover: './cover.jpg', icon: '/a.svg', tags: ['技术'] }));
  assert.match(article, /post-card/); assert.match(article, /2024-02-01/); assert.match(article, /技术/); assert.doesNotMatch(article, /<img/);
  assert.doesNotMatch(renderEntityHtml(entity('p', { type: 'project', icon: '/p.svg' }), { showIcon: false }), /entity-card-media/);
});

test('type presentations inherit defaults and override article cards, header icons and URL labels', () => {
  const labels: Record<EntityType, string> = { article: '阅读文章', project: '访问项目', friend: '访问站点', contact: '联系我' };
  const standard = getEntityPresentation('project');
  for (const type of entityTypes) {
    const presentation = getEntityPresentation(type);
    assert.equal(presentation.inline, standard.inline);
    assert.equal(presentation.cardActionLabel, labels[type]);
    assert.equal(presentation.urlActionLabel, type === 'article' ? '相关链接' : labels[type]);
    assert.equal(presentation.header.showIcon, type !== 'article');
    assert.equal(presentation.popover.card, standard.card);
    assert.equal(presentation.popover.showCover, true);
    assert.equal(presentation.popover.showIcon, true);
    if (type === 'article') assert.notEqual(presentation.card, standard.card);
    else assert.equal(presentation.card, standard.card);
  }
  // A caller cannot accidentally change another type's inherited header settings.
  standard.header.showIcon = false;
  assert.equal(getEntityPresentation('friend').header.showIcon, true);
  standard.popover.showCover = false;
  assert.equal(getEntityPresentation('friend').popover.showCover, true);
});

test('all previews share cover-first media followed by title and summary, with icon and initial fallbacks', () => {
  const item = entity('covered', { title: 'A & B', summary: '<简介>', icon: '/icon.svg', cover: './图片 1.jpg', tags: ['标签'] });
  for (const type of entityTypes) {
    const target = entity('covered', { type, title: item.title, summary: item.summary, icon: item.icon, cover: item.cover, tags: item.tags, url: 'https://example.com/' });
    const preview = renderEntityCardHtml(target, { root: 'span' });
    assert.match(preview, /class="entity-card"/);
    assert.match(preview, /entity-card-media" aria-hidden="true"><img class="entity-card-cover" src="\/covered\/%E5%9B%BE%E7%89%87%201.jpg"/);
    assert.ok(preview.indexOf('entity-card-media') < preview.indexOf('entity-card-copy'));
    assert.match(preview, /entity-card-icon" src="\/icon.svg"/);
    assert.match(preview, /entity-card-fallback" hidden>A</);
    assert.match(preview, /entity-card-name">A &amp; B</);
    assert.match(preview, /entity-card-description">&lt;简介&gt;</);
    assert.doesNotMatch(preview, /post-card|<time|class="tag"|<(?:article|div|p|h[1-6])\b/);
    const noCover = renderEntityCardHtml({ ...target, cover: '' }, { root: 'span' });
    assert.doesNotMatch(noCover, /entity-card-cover/);
    assert.match(noCover, /entity-card-icon/);
    const noImages = renderEntityCardHtml({ ...target, cover: '', icon: '' }, { root: 'span' });
    assert.doesNotMatch(noImages, /<img/);
    assert.match(noImages, /entity-card-fallback">A</);
    const noIcon = renderEntityCardHtml(target, { root: 'span', showIcon: false });
    assert.match(noIcon, /entity-card-cover/);
    assert.doesNotMatch(noIcon, /entity-card-icon|entity-card-fallback/);
  }
  assert.doesNotMatch(renderEntityCardHtml(item), /<img/);
  assert.doesNotMatch(renderEntityCardHtml(entity('p', { type: 'project', cover: './cover.jpg' })), /entity-card-cover/);
  for (const cover of ['/assets/cover.jpg', 'https://example.com/cover.jpg?x=1&y=2']) {
    const html = renderEntityCardHtml({ ...item, cover }, { root: 'span' });
    assert.ok(html.includes(`src="${cover.replace(/&/g, '&amp;')}"`));
  }
});

test('all inline appearances reuse the mapped card with phrasing-only preview markup', () => {
  for (const type of entityTypes) {
    const item = entity(`sample-${type}`, { type, title: '完整标题', name: '短名', icon: '/icon.svg', url: 'https://example.com/' });
    const block = renderEntityHtml(item, { headingLevel: 'h2' });
    assert.equal(block, renderEntityCardHtml(item, { headingLevel: 'h2' }));
    assert.match(block, /<h2\b/);
    const preview = renderEntityCardHtml(item, { root: 'span' });
    assert.doesNotMatch(preview, /<(?:article|div|p|h[1-6])(?:\s|>)/);
    for (const appearance of ['text', 'chip', 'icon'] as const) {
      const inline = renderEntityHtml(item, { variant: 'inline', appearance });
      assert.equal(inline, renderEntityInlineHtml(item, { appearance }));
      assert.ok(inline.includes(preview), `${type}/${appearance} must reuse its card`);
      assert.equal((inline.match(/<a\b/g) || []).length, 2);
      assert.match(inline, /<\/a><span class="entity-chip-popover">/);
      if (appearance === 'icon') {
        assert.match(inline, /aria-label="短名"/);
        assert.doesNotMatch(inline, /entity-inline-name/);
      } else assert.match(inline, /entity-inline-name">短名</);
    }
  }
});

test('optional icons, previews and article metadata retain their display policies', () => {
  const item = entity('sample-friend', { type: 'friend', title: '😀朋友', icon: '/missing.svg' });
  const card = renderEntityHtml(item);
  assert.match(card, /onerror="this.hidden=true;this.nextElementSibling.hidden=false"/);
  assert.match(card, /entity-card-fallback" hidden>😀</);
  const missingIcon = renderEntityHtml({ ...item, icon: '' });
  assert.doesNotMatch(missingIcon, /<img/);
  assert.match(missingIcon, /entity-card-fallback">😀</);
  assert.doesNotMatch(renderEntityHtml(item, { showIcon: false }), /entity-card-media/);
  assert.doesNotMatch(renderEntityInlineHtml(item, { popoverShowIcon: false }), /entity-card-media/);
  assert.doesNotMatch(renderEntityInlineHtml(item, { hoverCard: false }), /entity-chip-popover/);
  const hiddenArticle = entity('undated', { hidden: true, date: undefined, summary: undefined, icon: '/icon.svg' });
  assert.doesNotMatch(renderEntityHtml(hiddenArticle, { showIcon: true }), /<time|<img|<p\b/);
});

test('navigation is shared while article cards always preserve their local destination', () => {
  const article = entity('sample-article', { redirect: true, url: 'https://example.com/?x=1#target' });
  for (const root of ['article', 'span'] as const) {
    const articleCard = renderEntityCardHtml(article, { root, external: true, newTab: true });
    assert.match(articleCard, /href="\/sample-article\/" data-no-page-transition/);
    assert.doesNotMatch(articleCard, /target="_blank"/);
  }
  const contact = entity('sample-contact', { type: 'contact', url: 'https://example.com/?x=1&y=2#target' });
  const action = renderEntityInlineHtml(contact, { external: true, newTab: true });
  assert.equal((action.match(/href="https:\/\/example.com\/\?x=1&amp;y=2#target" target="_blank" rel="noreferrer"/g) || []).length, 2);
  assert.doesNotMatch(action, /data-no-page-transition/);
  assert.match(renderEntityHtml(contact), /href="\/sample-contact\/"/);
});

test('migrated documents preserve identities and the two distinct friend display names', () => {
  const { entities } = loadContentIndex();
  assert.equal(entities.size, 50);
  assert.equal(entities.get('Season')?.title, 'SeasonX'); assert.equal(entities.get('Season')?.name, 'Season');
  assert.equal(entities.get('AwesomeYang')?.title, '老杨的知识荒原');
  assert.equal(entities.get('xiaofenshen')?.redirect, true); assert.equal(entities.get('email')?.redirect, false);
});
