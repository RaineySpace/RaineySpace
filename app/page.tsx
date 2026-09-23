import HomeSection from '@/app/components/HomeSection';
import HoverCardList from '@/app/components/HoverCardList';
import PhotoGallery from '@/app/components/PhotoGallery';
import PostCard from '@/app/components/PostCard';
import { author } from '@/lib/config';
import { getFeaturedPhotos } from '@/lib/photography';
import { getProjects } from '@/lib/projects';
import { getAboutContent, getListedPosts } from '@/lib/posts';
import JsonLd from '@/app/components/JsonLd';
import { homeJsonLd, pageMetadata, pages } from '@/lib/seo';
import ProjectList from '@/app/components/ProjectList';
import './[slug]/prose.css';

export const metadata = pageMetadata(pages.home);

export default async function Home() {
  const [aboutContent, posts, featuredPhotos, projects] = await Promise.all([
    getAboutContent(),
    getListedPosts(),
    getFeaturedPhotos(6),
    getProjects(),
  ]);

  // 抵消共享 layout 的底部留白，保持首页页脚的位置与页面总高度。
  return (
    <div className="relative -mb-8 flex flex-col gap-10 sm:-mb-12">
      <JsonLd data={homeJsonLd()} />
      <section id="about" aria-label="关于我" className="home-intro">
        <div className="markdown" dangerouslySetInnerHTML={{ __html: aboutContent }} />
      </section>

      <HomeSection id="articles" title="写点东西" href="/articles" linkLabel="全部文章" description="记录生活、技术与一些想法">
        <HoverCardList>
          {posts.slice(0, 3).map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </HoverCardList>
      </HomeSection>

      <HomeSection id="photography" title="凝固时间" href="/photography" linkLabel="全部摄影" description="留下日常里偶然遇见的光">
        <PhotoGallery photos={featuredPhotos} variant="strip" />
      </HomeSection>

      <HomeSection id="projects" title="做点东西" href="/projects" linkLabel="全部项目" description="把一些想法，慢慢变成真的">
        <ProjectList projects={projects} />
      </HomeSection>

      <footer className="flex h-8 flex-wrap items-center justify-between border-t border-dashed border-[--border] text-sm leading-[var(--lh-body)] text-[--muted] sm:h-12">
        <span>© {new Date().getFullYear()} {author}</span>
        <nav aria-label="页脚导航" className="ml-auto flex flex-wrap gap-4">
          <a href="/friends/" className="text-inherit underline underline-offset-4 hover:text-[--title] focus-visible:text-[--title]">朋友们</a>
          <a href="/about/" className="text-inherit underline underline-offset-4 hover:text-[--title] focus-visible:text-[--title]">关于我</a>
        </nav>
      </footer>
    </div>
  );
}
