import Link from 'next/link';
import HomeSection from '@/app/components/HomeSection';
import PhotoGallery from '@/app/components/PhotoGallery';
import PostCard from '@/app/components/PostCard';
import ProjectList from '@/app/components/ProjectList';
import { getFeaturedPhotos } from '@/lib/photography';
import { getPublicPosts } from '@/lib/posts';
import { getFeaturedProjects } from '@/lib/projects';

export default async function Home() {
  const posts = await getPublicPosts();
  const featuredPhotos = await getFeaturedPhotos(6);
  const featuredProjects = await getFeaturedProjects(3);

  return (
    <div className="relative -top-2.5 flex flex-col gap-10">
      <section id="about" aria-label="关于我" className="scroll-mt-8">
        <div className="text-base leading-8 text-gray-700 dark:text-gray-300">
          <p>
            你好，我是 Rainey，一名主要使用 TypeScript 的程序员，也喜欢做饭、街拍、游戏和探索没有尝试过的事情。
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            目前生活在杭州，在这里记录工作、生活与偶尔出现的想法。你也可以从
            <Link
              href="/about"
              className="mx-1 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-900 dark:decoration-gray-600 dark:hover:text-white"
            >
              一篇更完整的自述
            </Link>
            开始认识我。
          </p>
        </div>
      </section>

      <HomeSection id="articles" title="文章" href="/articles" linkLabel="全部文章">
        <div className="flex flex-col gap-8">
          {posts.slice(0, 3).map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </HomeSection>

      <HomeSection id="photography" title="摄影" href="/photography" linkLabel="全部摄影">
        <PhotoGallery photos={featuredPhotos} variant="strip" />
      </HomeSection>

      <HomeSection id="projects" title="项目" href="/projects" linkLabel="全部项目">
        <ProjectList projects={featuredProjects} />
      </HomeSection>
    </div>
  );
}
