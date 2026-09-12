import type { Metadata } from "next";
import PhotoGallery from "@/app/components/PhotoGallery";
import { getPhotographyAlbums } from "@/lib/photography";
import JsonLd from "@/app/components/JsonLd";
import { collectionJsonLd, pageMetadata, pages, postUrl } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(pages.photography);

export default async function PhotographyPage() {
  const albums = await getPhotographyAlbums();

  return (
    <div className="page-content">
      <JsonLd data={collectionJsonLd(pages.photography, albums.map((album) => ({
        url: postUrl(album.slug), name: album.title,
      })))} />
      <header className="mb-3">
        <h1 className="page-title">摄影</h1>
        <p className="page-description">
          一些街头、日常和偶然遇见的光。
        </p>
      </header>
      <div className="flex flex-col gap-10">
        {albums.map((album) => (
          <section key={album.slug} aria-labelledby={`album-${album.slug}`}>
            <header className="mb-3">
              <h2 id={`album-${album.slug}`} className="section-title">
                <a href={`/${album.slug}/`}>{album.title}</a>
              </h2>
              <p className="mt-1 meta">
                {[album.location, album.date, `${album.photos.length} 张`].filter(Boolean).join(" · ")}
              </p>
            </header>
            <PhotoGallery photos={album.photos} variant="grid" />
          </section>
        ))}
      </div>
    </div>
  );
}
