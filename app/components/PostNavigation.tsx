import Link from "next/link";
import { getPublicPosts, getRelatedPosts, type Post } from "@/lib/posts";

export default async function PostNavigation({ post }: { post: Post }) {
  const related = post.hidden ? [] : getRelatedPosts(post, await getPublicPosts());
  return (
    <nav aria-label="文章导航" className="mt-12 border-t border-[--border] pt-6 text-sm">
      {related.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-xs text-[--muted]">相关阅读</h2>
          <ul className="space-y-2">
            {related.map((item) => (
              <li key={item.slug}>
                <Link href={`/${encodeURIComponent(item.slug)}/`} className="text-[--secondary] hover:text-[--title]">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[--muted]">
        <Link href="/articles/" className="hover:text-[--title]">全部文章</Link>
        {post.photography && <Link href="/photography/" className="hover:text-[--title]">摄影</Link>}
        {post.projectId && <Link href="/projects/" className="hover:text-[--title]">项目</Link>}
        {post.slug !== "about" && <Link href="/about/" className="hover:text-[--title]">关于 Rainey</Link>}
      </div>
    </nav>
  );
}
