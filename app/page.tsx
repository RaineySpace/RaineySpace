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

      <HomeSection id="articles" title="字里行间" href="/articles" linkLabel="全部文章" description="写日常，写技术，也写那些还没有答案的事。">
        <HoverCardList>
          {posts.slice(0, 3).map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </HoverCardList>
      </HomeSection>

      <HomeSection id="photography" title="光阴有迹" href="/photography" linkLabel="全部摄影" description="光偶然落下，我恰好经过。">
        <PhotoGallery photos={featuredPhotos} variant="strip" />
      </HomeSection>

      <HomeSection id="projects" title="念有所成" href="/projects" linkLabel="全部项目" description="把偶然闪过的念头，做成值得留下的东西。">
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

      <HomeSection id="friends" title="远近有邻" href="/friends" linkLabel="全部朋友" description="循着这些名字，去看看别处的生活。">
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
