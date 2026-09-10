import Link from "next/link";
import type { Post } from "@/lib/posts";

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  return (
    <Link
      href={`/${post.slug}`}
      data-hover-card
      className="post-card -mx-3 block rounded-xl p-3"
    >
      <article>
        <h2 className="mb-2 text-base font-normal leading-[1.6] text-[--title]">
          {post.title}
        </h2>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 meta">
          {post.date && <time dateTime={post.date.toISOString()}>{post.dateText}</time>}
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="tag"
            >
              {tag}
            </span>
          ))}
        </div>
        {post.summary ? (
          <p className="mt-2 text-sm leading-[1.75] text-[--secondary]">
            {post.summary}
          </p>
        ) : null}
      </article>
    </Link>
  );
}
