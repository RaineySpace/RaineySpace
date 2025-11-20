import { getPostBySlug, getAllPostSlugs } from '@/lib/posts';

export async function generateStaticParams() {
  const slugs = getAllPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default function PostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = getPostBySlug(params.slug);

  return (
    <article className="markdown">
      <h1 className="text-[40px] font-black leading-[44px] text-[--title] mb-4">
        {post.title}
      </h1>
      <p className="text-[13px] text-gray-700 dark:text-gray-300 mb-8">
        {post.date}
      </p>

      <div className="markdown-content mt-10">
        <div
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </div>
    </article>
  );
}
