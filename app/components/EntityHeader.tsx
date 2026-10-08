import type { Post } from '@/lib/posts';
import { getEntityPresentation } from '@/lib/entity-rendering';
import PostCover from '@/app/components/PostCover';

export default function EntityHeader({ post }: { post: Post }) {
  const showCover = Boolean(post.coverDisplaySrc);
  const presentation = getEntityPresentation(post.type);
  if (!showCover && !(post.showHeader && (post.showTitle || post.date || post.location || post.tags.length > 0 || post.summary))) return null;

  return (
    <header className="article-header">
      {post.showHeader && presentation.header.showIcon && post.icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.icon} alt="" className="mb-3 h-12 w-12 object-contain" />
      )}
      {post.showHeader && post.showTitle && <h1>{post.title}</h1>}
      {post.showHeader && (post.date || post.location || post.tags.length > 0) && (
        <div className="article-meta flex flex-wrap items-center gap-x-2 gap-y-1 meta">
          {post.date && <time dateTime={post.date.toISOString()}>{post.dateText}</time>}
          {post.location && <span>{post.location}</span>}
          {post.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}
      {post.showHeader && post.summary && <p className="article-summary">{post.summary}</p>}
      {post.showHeader && post.url && <p className="meta">
        <a href={post.url} target={post.url.startsWith('mailto:') ? undefined : '_blank'} rel="noreferrer">
          {presentation.urlActionLabel}
        </a>
      </p>}
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
  );
}
