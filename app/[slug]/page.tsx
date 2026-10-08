import type { Metadata } from 'next';
import { getPostBySlug, getPosts } from '@/lib/posts';
import "./prose.css";
import "./syntax.css";
import { postJsonLd, postMetadata } from '@/lib/seo';
import JsonLd from '@/app/components/JsonLd';
import EntityDetail from '@/app/components/EntityDetail';
import EntityRedirect from '@/app/components/EntityRedirect';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(decodeURIComponent(slug));
  return postMetadata(post);
}

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(decodeURIComponent(slug));
  if (post.redirect) return <EntityRedirect url={post.url} title={post.title} />;

  return (
    <div className="relative">
      <JsonLd data={postJsonLd(post)} />
      <EntityDetail post={post} />
    </div>
  );
}
