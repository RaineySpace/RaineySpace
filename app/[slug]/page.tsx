import { getPostBySlug, getPosts } from '@/lib/posts';
import { marked } from 'marked';
import "./prose.css";

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
      <h1 className="text-[40px] font-black leading-[44px] text-[--title] mb-4">
        {post.title}
      </h1>
      <p className="text-[13px] text-gray-700 dark:text-gray-300 mb-8 flex items-center gap-2">
        {post.date.toLocaleDateString()}
        {post.tags?.map((tag) => (
          <span key={tag} className="inline-block bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded-md text-[10px]">
            {tag}
          </span>
        ))}
      </p>
      {
        post.summary && (
          <p className="text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-md text-[13px]">
            {post.summary}
          </p>
        )
      }
      <div className="markdown-content mt-10">
        <div
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </article>
  );
}
