import HomeSection from '@/app/components/HomeSection';
import HoverCardList from '@/app/components/HoverCardList';
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
    <div className="flex flex-col gap-10">
      <section id="about" aria-label="关于我" className="home-intro">
        <div className="markdown" dangerouslySetInnerHTML={{ __html: aboutContent }} />
      </section>

      <HomeSection id="articles" title="文章" href="/articles" linkLabel="全部文章" description="记录生活、技术与一些想法">
        <HoverCardList>
          {posts.slice(0, 3).map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </HoverCardList>
      </HomeSection>

      <HomeSection id="photography" title="摄影" href="/photography" linkLabel="全部摄影" description="留下日常里偶然遇见的光">
        <PhotoGallery photos={featuredPhotos} variant="strip" />
      </HomeSection>

      <HomeSection id="projects" title="项目" href="/projects" linkLabel="全部项目" description="做过的产品、工具与个人实验">
        <ProjectList projects={featuredProjects} />
      </HomeSection>
    </div>
  );
}
