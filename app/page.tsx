import HomeSection from '@/app/components/HomeSection';
import PhotoGallery from '@/app/components/PhotoGallery';
import PostCard from '@/app/components/PostCard';
import ProjectList from '@/app/components/ProjectList';
import { getFeaturedPhotos } from '@/lib/photography';
import { getAboutContent, getPublicPosts } from '@/lib/posts';
import { getFeaturedProjects } from '@/lib/projects';
import './[slug]/prose.css';

export default async function Home() {
  const [aboutContent, posts, featuredPhotos, featuredProjects] = await Promise.all([
    getAboutContent(),
    getPublicPosts(),
    getFeaturedPhotos(6),
    getFeaturedProjects(3),
  ]);

  return (
    <div className="relative -top-2.5 flex flex-col gap-10">
      <section id="about" aria-label="关于我" className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="markdown" dangerouslySetInnerHTML={{ __html: aboutContent }} />
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
