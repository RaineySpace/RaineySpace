import fs from 'fs/promises';
import matter from 'gray-matter';
import { Feed } from 'feed';
import * as config from './config';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

// 配置 marked 使用 highlight.js
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
  })
);

export interface Post {
  title?: string;
  date?: Date;
  summary?: string;
  slug: string;
  cover?: string;
  tags?: string[];
  keywords?: string[];
  hidden?: boolean;
  content: string;
}

export async function getPostBySlug(slug: string): Promise<Post> {
  const fileContents = await fs.readFile(`./public/${slug}/index.md`, 'utf8');
  const { data, content } = matter(fileContents);
  return {
    title: data.title ? String(data.title) : undefined,
    date: data.date ? new Date(data.date) : undefined,
    summary: data.summary ? String(data.summary) : undefined,
    slug,
    cover: data.cover ? String(data.cover) : undefined,
    tags: data.tags ? data.tags.map(String) : undefined,
    keywords: data.keywords ? data.keywords.map(String) : undefined,
    hidden: !!data.hidden,
    content: marked(content),
  } as Post;
}

export async function getPosts(): Promise<Post[]> {
  const entries = await fs.readdir("./public/", { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const posts = await Promise.all(dirs.map(getPostBySlug));
  return posts.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.getTime() < b.date.getTime() ? 1 : -1;
  });
}

export async function generateFeed() {
  const posts = (await getPosts()).filter((post) => !post.hidden);

  const feed = new Feed({
    author: {
      name: config.author,
      email: config.email,
      link: config.siteUrl,
    },
    description: config.description,
    favicon: config.icon,
    feedLinks: { atom: `${config.siteUrl}/atom.xml`, rss: `${config.siteUrl}/rss.xml` },
    generator: "Feed for Node.js",
    id: config.siteUrl,
    image: config.avatar,
    link: config.siteUrl,
    title: config.title,
    copyright: config.copyright,
  });

  for (const post of posts) {
    feed.addItem({
      date: new Date(post.date || new Date()),
      description: post.summary || post.content.substring(0, 200) + '...',
      content: post.content,
      id: `${config.siteUrl}/${post.slug}/`,
      link: `${config.siteUrl}/${post.slug}/`,
      title: post.title || '',
    });
  }
  return feed;
}
