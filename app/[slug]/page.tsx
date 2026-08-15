import type { Metadata } from 'next';
import { getPostBySlug, getPosts } from '@/lib/posts';
import "./prose.css";
import "highlight.js/styles/github-dark.css";
import * as config from '@/lib/config';
import TableOfContents from './TableOfContents';
import MarkdownContent from '@/app/components/MarkdownContent';
import ProjectCard from '@/app/components/ProjectCard';
import { getProjectById } from '@/lib/projects';

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
  const project = getProjectById(post.projectId);

  return (
    <div className="relative">
      <TableOfContents headings={post.headings} />
      <article className="markdown">
        {(post.showTitle || post.date || post.location || post.tags.length > 0 || post.summary) && (
          <header>
            {post.showTitle && <h1>{post.title}</h1>}
            {(post.date || post.location || post.tags.length > 0) && (
              <div className="flex items-center gap-2 text-[13px] text-gray-700 dark:text-gray-300">
                {post.date && <time dateTime={post.date.toISOString()}>{post.dateText}</time>}
                {post.location && <span>{post.location}</span>}
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
        <MarkdownContent
          html={post.content}
          images={post.images}
          location={post.photography ? post.location : undefined}
          date={post.photography ? post.dateText : undefined}
        />
      </article>
      {project && (
        <aside aria-label={`关于项目：${project.name}`} className="mt-10">
          <ProjectCard project={project} headingLevel="h2" />
        </aside>
      )}
    </div>
  );
}
