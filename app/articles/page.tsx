import type { Metadata } from "next";
import { Suspense } from "react";
import PostCard from "@/app/components/PostCard";
import { getPostTagCounts, getPublicPosts } from "@/lib/posts";
import ArticleList, { ArticleListContent } from "./ArticleList";

export const metadata: Metadata = {
  title: "文章 - Rainey's Blog",
  description: "Rainey 的全部公开文章。",
};

export default async function ArticlesPage() {
  const posts = await getPublicPosts();
  const tagCounts = getPostTagCounts(posts);
  const articles = posts.map((post) => ({
    slug: post.slug,
    tags: post.tags,
    card: <PostCard post={post} />,
  }));

  return (
    <div className="relative -top-2.5">
      <header className="mb-8">
        <h1 className="text-[28px] font-black leading-none text-[--title]">文章</h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          记录一些生活日常与技术分享或者一些不成熟的想法。
        </p>
      </header>
      <Suspense fallback={<ArticleListContent posts={articles} tagCounts={tagCounts} />}>
        <ArticleList posts={articles} tagCounts={tagCounts} />
      </Suspense>
    </div>
  );
}
