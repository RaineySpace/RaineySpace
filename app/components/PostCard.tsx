import Link from "next/link";
import type { Post } from "@/lib/posts";

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  return (
    <Link
      href={`/${post.slug}`}
      className="block scale-100 py-4 will-change-transform hover:scale-[1.005] active:scale-100"
      style={{ opacity: 1, transition: "transform 0.2s ease-in-out, opacity 0.2s 0.4s linear" }}
    >
      <article>
        <h2 className="mb-2 text-[28px] font-black leading-[1.22] text-[--lightLink] dark:text-[--darkLink]">
          {post.title}
        </h2>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-gray-700 dark:text-gray-300">
          {post.date && <time dateTime={post.date.toISOString()}>{post.dateText}</time>}
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-md bg-gray-100 px-2 py-1 text-[10px] text-gray-800 dark:bg-gray-800 dark:text-gray-200"
            >
              {tag}
            </span>
          ))}
        </div>
        {post.summary ? (
          <p className="mt-2 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
            {post.summary}
          </p>
        ) : null}
      </article>
    </Link>
  );
}
