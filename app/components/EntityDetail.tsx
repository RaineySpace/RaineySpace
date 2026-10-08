import type { Post } from '@/lib/posts';
import TableOfContents from '@/app/[slug]/TableOfContents';
import EntityHeader from '@/app/components/EntityHeader';
import EntityList from '@/app/components/EntityList';
import MarkdownContent from '@/app/components/MarkdownContent';

/** Shared document layout; content loading, SEO and redirects stay in the route. */
export default function EntityDetail({ post }: { post: Post }) {
  return (
    <>
      <TableOfContents headings={post.headings} />
      <article className="markdown">
        <EntityHeader post={post} />
        <MarkdownContent
          html={post.content}
          images={post.images}
          location={post.location || undefined}
          date={post.dateText || undefined}
        />
      </article>
      {(post.outgoing.length > 0 || post.incoming.length > 0) && <aside className="mt-10 space-y-8 border-t border-dashed border-(--border) pt-6" aria-label="文档关联">
        {post.outgoing.length > 0 && <EntityList items={post.outgoing} />}
        {post.incoming.length > 0 && <section><h2 className="section-title mb-3">引用此文档的内容</h2><EntityList items={post.incoming} /></section>}
      </aside>}
    </>
  );
}
