import type { Metadata } from "next";
import PhotoGallery from "@/app/components/PhotoGallery";
import { getPhotographyAlbums } from "@/lib/photography";

export const metadata: Metadata = {
  title: "摄影 - Rainey's Blog",
  description: "Rainey 的摄影记录。",
};

export default async function PhotographyPage() {
  const albums = await getPhotographyAlbums();

  return (
    <div className="relative -top-2.5">
      <header className="mb-8">
        <h1 className="text-[28px] font-black leading-none text-[--title]">摄影</h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          一些街头、日常和偶然遇见的光。
        </p>
      </header>
      <div className="flex flex-col gap-10">
        {albums.map((album) => (
          <section key={album.slug} aria-labelledby={`album-${album.slug}`}>
            <header className="mb-3">
              <h2 id={`album-${album.slug}`} className="text-lg font-bold leading-tight text-[--title]">
                <a href={`/${album.slug}/`}>{album.title}</a>
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
