import type { Metadata } from 'next';
import { getPostBySlug, getPosts } from '@/lib/posts';
import "./prose.css";
import "highlight.js/styles/github-dark.css";
import * as config from '@/lib/config';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPostBySlug(decodeURIComponent(params.slug));
  
  return {
    title: post.title ? `${post.title} - ${config.title}` : config.title,
    authors: [{ name: config.author, url: config.siteUrl }],
    creator: config.author,
    description: post.summary || config.description,
    keywords: [...config.keywords, ...post.keywords, ...post.tags],
    openGraph: {
      title: post.title,
      description: post.summary || config.description,
      url: `${config.siteUrl}/${post.slug}/`,
      siteName: config.title,
      locale: "zh-CN",
      type: "article",
      publishedTime: post.date?.toISOString(),
      authors: [config.author],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary || config.description,
      images: post.cover || config.avatar,
    },
  };
}

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function PostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPostBySlug(decodeURIComponent(params.slug));

  return (
    <div className="relative">
      {post.headings.length > 0 && (
        <aside className="absolute left-full top-0 ml-12 hidden w-44 xl:block">
          <nav className="sticky top-8 flex flex-col gap-2 border-l border-gray-200 pl-4 text-xs leading-relaxed text-gray-500 dark:border-gray-800 dark:text-gray-400">
            {post.headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                className={heading.level === 3 ? "pl-3" : ""}
              >
                {heading.text}
              </a>
            ))}
          </nav>
        </aside>
      )}
      <article className="markdown">
        {(post.showTitle || post.date || post.tags.length > 0 || post.summary) && (
          <header>
            {post.showTitle && <h1>{post.title}</h1>}
            {(post.date || post.tags.length > 0) && (
              <div className="flex items-center gap-2 text-[13px] text-gray-700 dark:text-gray-300">
                {post.date && <time dateTime={post.date.toISOString()}>{post.dateText}</time>}
                {post.tags.map((tag) => (
                  <span key={tag} className="inline-block rounded-md bg-gray-100 px-2 py-1 text-[10px] text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {post.summary && (
              <p className="rounded-md bg-gray-100 px-4 py-2 text-[13px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {post.summary}
              </p>
            )}
          </header>
        )}
        <section className="markdown-content" dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>
    </div>
  );
}
