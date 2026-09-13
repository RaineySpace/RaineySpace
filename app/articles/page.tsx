import type { Metadata } from "next";
import { Suspense } from "react";
import PostCard from "@/app/components/PostCard";
import { getPostTagCounts, getListedPosts } from "@/lib/posts";
import ArticleList, { ArticleListContent } from "./ArticleList";
import JsonLd from "@/app/components/JsonLd";
import { collectionJsonLd, pageMetadata, pages, postUrl } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(pages.articles);

export default async function ArticlesPage() {
  const posts = await getListedPosts();
  const tagCounts = getPostTagCounts(posts);
  const articles = posts.map((post) => ({
    slug: post.slug,
    tags: post.tags,
    card: <PostCard post={post} />,
  }));

  return (
    <div className="page-content">
      <JsonLd data={collectionJsonLd(pages.articles, posts.map((post) => ({
        url: postUrl(post.slug), name: post.title, description: post.summary,
      })))} />
      <header className="mb-3">
        <h1 className="page-title">文章</h1>
        <p className="page-description">
          记录一些生活日常与技术分享或者一些不成熟的想法。
        </p>
      </header>
      <Suspense fallback={<ArticleListContent posts={articles} tagCounts={tagCounts} />}>
        <ArticleList posts={articles} tagCounts={tagCounts} />
      </Suspense>
    </div>
  );
}
