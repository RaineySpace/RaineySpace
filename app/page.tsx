import Link from 'next/link';
import HomeSection from '@/app/components/HomeSection';
import HoverCardList from '@/app/components/HoverCardList';
import PhotoGallery from '@/app/components/PhotoGallery';
import PostCard from '@/app/components/PostCard';
import { author } from '@/lib/config';
import { getContacts } from '@/lib/contacts';
import { getFeaturedPhotos } from '@/lib/photography';
import { getProjects } from '@/lib/projects';
import { getWelcomeContent, getListedPosts } from '@/lib/posts';
import JsonLd from '@/app/components/JsonLd';
import { homeJsonLd, pageMetadata, pages } from '@/lib/seo';
import EntityList from '@/app/components/EntityList';
import { EntityContent } from '@/app/components/Entity';
import { emptyCollectionMessage } from '@/lib/entity-rendering.ts';
import { getFriends } from '@/lib/friends';
import './[slug]/prose.css';

export const metadata = pageMetadata(pages.home);

export default async function Home() {
  const [welcomeContent, posts, featuredPhotos, projects, friends, contacts] = await Promise.all([
    getWelcomeContent(),
    getListedPosts(),
    getFeaturedPhotos(6),
    getProjects(),
    getFriends(),
    getContacts(),
  ]);

  // 抵消共享 layout 的底部留白，保持首页页脚的位置与页面总高度。
  return (
    <div className="relative -mb-8 flex flex-col gap-10 sm:-mb-12">
      <JsonLd data={homeJsonLd()} />
      <section id="about" aria-label="关于我" className="home-intro">
        <EntityContent className="markdown" html={welcomeContent} />
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
        <EntityList
          items={projects}
          variant="card"
          appearance="chip"
          showIcon
          hoverCard
          placement="top"
          emptyLabel={emptyCollectionMessage.project}
        />
      </HomeSection>

      <HomeSection id="friends" title="朋友们" href="/friends" linkLabel="全部朋友" description="欢迎去他们那里逛逛">
        <EntityList
          items={friends}
          variant="inline"
          appearance="chip"
          showIcon
          hoverCard
          placement="top"
          emptyLabel={emptyCollectionMessage.friend}
        />
      </HomeSection>

      <footer className="flex min-h-8 flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-dashed border-(--border) py-2 text-sm leading-(--lh-body) text-(--muted) sm:min-h-12">
        <Link href="/license/" rel="license" className="text-(--muted) hover:text-(--text) focus-visible:text-(--text)">© {new Date().getFullYear()} {author}</Link>
        <nav aria-label="页脚导航" className="ml-auto flex flex-wrap gap-4">
          <EntityList
            items={contacts}
            variant="inline"
            appearance="icon"
            size="sm"
            showIcon
            placement="top"
            emptyLabel={emptyCollectionMessage.contact}
          />
        </nav>
      </footer>
    </div>
  );
}
