import type { Metadata } from 'next';
import * as config from './config';
import type { Post } from './posts';

export interface PageInfo {
  pathname: string;
  title: string;
  description: string;
}

export const pages = {
  friends: { pathname: '/friends/', title: `朋友们 - ${config.title}`, description: 'Rainey 的朋友们' },
  home: { pathname: '/', title: config.title, description: config.description },
  articles: { pathname: '/articles/', title: `文章 - ${config.title}`, description: 'Rainey 的全部公开文章' },
  photography: { pathname: '/photography/', title: `摄影 - ${config.title}`, description: 'Rainey 的摄影记录' },
  projects: { pathname: '/projects/', title: `项目 - ${config.title}`, description: 'Rainey 的项目与个人实验' },
} satisfies Record<string, PageInfo>;

export function canonicalUrl(pathname: string): string {
  const url = new URL(pathname, config.siteUrl);
  url.search = '';
  url.hash = '';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
  return url.href;
}

export function postUrl(slug: string): string {
  return canonicalUrl(`/${encodeURIComponent(slug)}/`);
}

export function markdownUrl(slug: string): string {
  return new URL(`/${encodeURIComponent(slug)}.md`, config.siteUrl).href;
}

export function pageMetadata(
  page: PageInfo,
  options: {
    image?: string;
    markdown?: string;
    article?: { publishedTime?: string; modifiedTime?: string; tags: string[] };
  } = {},
): Metadata {
  const url = canonicalUrl(page.pathname);
  const image = new URL(options.image || config.ogImage, config.siteUrl).href;
  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: url,
      types: {
        'application/rss+xml': [{ url: `${config.siteUrl}/rss.xml`, title: `${config.title} RSS` }],
        'application/atom+xml': [{ url: `${config.siteUrl}/atom.xml`, title: `${config.title} Atom` }],
        ...(options.markdown ? { 'text/markdown': options.markdown } : {}),
      },
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: config.title,
      locale: 'zh_CN',
      images: image,
      ...(options.article
        ? { type: 'article' as const, ...options.article, authors: [config.authorUrl] }
        : { type: 'website' as const }),
    },
    twitter: {
      card: 'summary_large_image',
      site: config.twitterHandle,
      creator: config.twitterHandle,
      title: page.title,
      description: page.description,
      images: image,
    },
  };
}

export function postMetadata(post: Post): Metadata {
  const isStandalonePage = post.slug === 'about';
  return {
    ...pageMetadata({
      pathname: postUrl(post.slug),
      title: `${post.title} - ${config.title}`,
      description: post.summary || config.description,
    }, {
      markdown: markdownUrl(post.slug),
      image: post.cover || config.ogImage,
      ...(!isStandalonePage ? {
        article: {
          publishedTime: post.date?.toISOString(),
          modifiedTime: post.updated?.toISOString(),
          tags: post.tags,
        },
      } : {}),
    }),
    keywords: [...new Set([...config.keywords, ...post.keywords, ...post.tags])],
    ...(post.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

function authorJsonLd() {
  return {
    '@type': 'Person',
    '@id': `${canonicalUrl('/')}#person`,
    name: config.author,
    url: config.authorUrl,
    image: config.avatar,
    sameAs: config.authorProfiles,
  };
}

export function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      authorJsonLd(),
      {
        '@type': 'WebSite',
        '@id': `${canonicalUrl('/')}#website`,
        url: canonicalUrl('/'),
        name: config.title,
        description: config.description,
        inLanguage: 'zh-CN',
        publisher: { '@id': `${canonicalUrl('/')}#person` },
      },
    ],
  };
}

export function postJsonLd(post: Post): Record<string, unknown> | null {
  if (post.noindex) return null;
  const url = postUrl(post.slug);
  if (post.slug === 'about') {
    return {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      '@id': `${url}#webpage`,
      url,
      name: `${post.title} - ${config.title}`,
      description: post.summary || undefined,
      mainEntity: authorJsonLd(),
      inLanguage: 'zh-CN',
    };
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: post.title,
    description: post.summary || undefined,
    datePublished: post.date?.toISOString(),
    dateModified: post.updated?.toISOString(),
    author: authorJsonLd(),
    // Only describe an image that is actually shown as this article's cover.
    // Photography covers stay in share metadata but are not rendered on the page.
    image: post.cover && !post.photography ? new URL(post.cover, config.siteUrl).href : undefined,
    inLanguage: 'zh-CN',
    isPartOf: { '@id': `${canonicalUrl('/')}#website` },
  };
}

export function collectionJsonLd(
  page: PageInfo,
  items: { url: string; name: string; description?: string }[],
) {
  const url = canonicalUrl(page.pathname);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#webpage`,
    url,
    name: page.title,
    description: page.description,
    inLanguage: 'zh-CN',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        ...item,
      })),
    },
  };
}

export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function sitemapEntries(posts: readonly Post[]) {
  return [
    ...[pages.home, pages.articles, pages.photography, pages.projects, pages.friends].map((page) => ({
      loc: canonicalUrl(page.pathname),
      lastmod: undefined as string | undefined,
    })),
    ...posts.filter((post) => !post.noindex).map((post) => ({
      loc: postUrl(post.slug),
      lastmod: (post.updated || post.date)?.toISOString(),
    })),
  ];
}

function markdownText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/[\\`*_\[\]<>]/g, '\\$&').trim();
}

export function llmsText(posts: readonly Post[]): string {
  const channels = [pages.home, pages.articles, pages.photography, pages.projects, pages.friends];
  return [
    `# ${config.title}`,
    '',
    `> ${config.description}`,
    '',
    `作者：${config.author}。正文以中文为主。搜索引用请链接到对应的 HTML 规范网址。`,
    '允许搜索索引及回答时检索引用，不允许将内容用于模型训练。抓取规则见 robots.txt。',
    '',
    '## 站点导航',
    '',
    ...channels.map((page) => `- [${markdownText(page.title)}](${canonicalUrl(page.pathname)}): ${markdownText(page.description)}`),
    '',
    '## 内容',
    '',
    ...posts.filter((post) => !post.noindex).map((post) => {
      const dates = [post.dateText, post.updated ? `更新 ${post.updated.toISOString().slice(0, 10)}` : ''].filter(Boolean).join('；');
      const description = [dates, markdownText(post.summary)].filter(Boolean).join('。');
      return `- [${markdownText(post.title)}](${markdownUrl(post.slug)}): ${description ? `${description} ` : ''}[原文](${postUrl(post.slug)})`;
    }),
    '',
  ].join('\n');
}
