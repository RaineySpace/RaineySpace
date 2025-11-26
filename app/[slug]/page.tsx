import type { Metadata } from 'next';
import { getPostBySlug, getPosts } from '@/lib/posts';
import { marked } from 'marked';
import "./prose.css";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPostBySlug(decodeURIComponent(params.slug));
  
  return {
    title: post.title ? `${post.title} - Rainey's Blog` : "Rainey's Blog",
    authors: [{ name: "Rainey", url: "https://rainey.space" }],
    creator: "Rainey",
    description: post.summary || "A blog by Rainey",
    keywords: ["Rainey", "blog", ...(post.keywords || []), ...(post.tags || [])],
  };
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
  const html = marked(post.content);
  return (
    <article className="markdown">
      <header>
        {
          post.title && (<h1>{post.title}</h1>)
        }
        <div className="text-[13px] text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <time dateTime={post.date?.toISOString()}>{post.date?.toLocaleDateString()}</time>
          {post.tags?.map((tag) => (
            <span key={tag} className="inline-block bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded-md text-[10px]">
              {tag}
            </span>
          ))}
        </div>
        {
          post.summary && (
            <p className="text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-md text-[13px]">
              {post.summary}
            </p>
          )
        }
      </header>
      <section className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
