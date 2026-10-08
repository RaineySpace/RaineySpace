import type { Metadata } from "next";
import { Suspense } from "react";
import Entity from "@/app/components/Entity";
import { getPostTagCounts, getListedPosts } from "@/lib/posts";
import ArticleList, { ArticleListContent } from "./ArticleList";
import JsonLd from "@/app/components/JsonLd";
import { entityCollectionJsonLd, pageMetadata, pages } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(pages.articles);

export default async function ArticlesPage() {
  const posts = await getListedPosts();
  const tagCounts = getPostTagCounts(posts);
  const articles = posts.map((post) => ({
    slug: post.slug,
    tags: post.tags,
    card: <Entity item={post} headingLevel="h2" />,
  }));

  return (
    <div>
      <JsonLd data={entityCollectionJsonLd(pages.articles, posts)} />
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
