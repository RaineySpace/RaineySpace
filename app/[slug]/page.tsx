import type { Metadata } from 'next';
import { getPostBySlug, getPosts } from '@/lib/posts';
import "./prose.css";
import "./syntax.css";
import { postJsonLd, postMetadata } from '@/lib/seo';
import JsonLd from '@/app/components/JsonLd';
import TableOfContents from './TableOfContents';
import MarkdownContent from '@/app/components/MarkdownContent';
import PostCover from '@/app/components/PostCover';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(decodeURIComponent(slug));
  return postMetadata(post);
}

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(decodeURIComponent(slug));
  // Photography covers are share/OG only; album pages keep the gallery-first layout.
  const showCover = Boolean(post.coverDisplaySrc && !post.photography);

  return (
    <div className="relative">
      <JsonLd data={postJsonLd(post)} />
      <TableOfContents headings={post.headings} />
      <article className="markdown">
        {(showCover || (post.showHeader && (post.showTitle || post.date || post.location || post.tags.length > 0 || post.summary))) && (
          <header className="article-header">
            {post.showHeader && post.showTitle && <h1>{post.title}</h1>}
            {post.showHeader && (post.date || post.location || post.tags.length > 0) && (
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
            {post.showHeader && post.summary && (
              <p className="article-summary">
                {post.summary}
              </p>
            )}
            {showCover ? (
              <PostCover
                src={post.coverDisplaySrc}
                originalSrc={post.cover}
                thumbnailSrc={post.coverImage?.thumbnailSrc}
                srcSet={post.coverImage?.srcSet}
                title={post.title}
                priority
                className="article-cover"
              />
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
    </div>
  );
}
