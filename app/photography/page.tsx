import type { Metadata } from 'next';
import PhotoGallery from '@/app/components/PhotoGallery';
import { collectPhotographyPhotos } from '@/lib/photography';
import { getPosts } from '@/lib/posts';
import { isIndexable } from '@/lib/entities';
import JsonLd from '@/app/components/JsonLd';
import { collectionJsonLd, pageMetadata, pages, postUrl } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(pages.photography);

export default async function PhotographyPage() {
  const posts = await getPosts();
  const photos = collectPhotographyPhotos(posts);
  const indexablePhotos = collectPhotographyPhotos(posts.filter(isIndexable));
  return <div>
    <JsonLd data={collectionJsonLd(pages.photography, indexablePhotos.map((photo) => ({
      url: `${postUrl(photo.sourceSlug)}#${encodeURIComponent(photo.anchor)}`, name: photo.alt,
    })))} />
    <header className="mb-3">
      <h1 className="page-title">摄影</h1>
      <p className="page-description">一些街头、日常和偶然遇见的光。</p>
    </header>
    {photos.length ? <PhotoGallery photos={photos} variant="grid" /> : <p className="meta">暂时还没有摄影图片。</p>}
  </div>;
}
