import type { Metadata } from 'next';
import { getPostBySlug, getPosts } from '@/lib/posts';
import "./prose.css";
import "./syntax.css";
import { postJsonLd, postMetadata } from '@/lib/seo';
import JsonLd from '@/app/components/JsonLd';
import TableOfContents from './TableOfContents';
import MarkdownContent from '@/app/components/MarkdownContent';
import PostCover from '@/app/components/PostCover';
import ProjectCard from '@/app/components/ProjectCard';
import { getProjectById } from '@/lib/projects';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPostBySlug(decodeURIComponent(params.slug));
  return postMetadata(post);
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
      <JsonLd data={postJsonLd(post)} />
      <TableOfContents headings={post.headings} />
      <article className="markdown">
        {(post.coverDisplaySrc || post.showTitle || post.date || post.location || post.tags.length > 0 || post.summary) && (
          <header className="article-header">
            {post.showTitle && <h1>{post.title}</h1>}
            {(post.date || post.location || post.tags.length > 0) && (
              <div className="article-meta flex flex-wrap items-center gap-x-2 gap-y-1 meta">
                {post.date && <time dateTime={post.date.toISOString()}>{post.dateText}</time>}
                {post.location && <span>{post.location}</span>}
                {post.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {post.summary && (
              <p className="article-summary">
                {post.summary}
              </p>
            )}
            {post.coverDisplaySrc ? (
              <PostCover src={post.coverDisplaySrc} priority className="article-cover" />
            ) : null}
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
