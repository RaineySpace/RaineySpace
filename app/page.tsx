import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';

export default function Home() {
  const posts = getAllPosts();

  return (
    <div className="relative -top-2.5 flex flex-col gap-8">
      {posts.map((post) => (
        <Link 
          key={post.slug}
          href={`/posts/${post.slug}`}
          className="block py-4 hover:scale-[1.005] will-change-transform scale-100 active:scale-100"
          style={{opacity: 1, transition: 'transform 0.2s ease-in-out, opacity 0.2s 0.4s linear'}}
        >
          <article>
            <h2 
              className="text-[28px] font-black leading-none mb-2 text-[--lightLink] dark:text-[--darkLink]"
              style={{
                '--lightLink': 'lab(63.003 59.322 -1.465)',
                '--darkLink': 'lab(81 32.361 -7.017)',
              } as any}
            >
              {post.title}
            </h2>
            <p className="text-[13px] text-gray-700 dark:text-gray-300">
              {post.date}
            </p>
            <p className="mt-1 text-gray-700 dark:text-gray-300">
              {post.description}
            </p>
          </article>
        </Link>
      ))}
    </div>
  );
}
