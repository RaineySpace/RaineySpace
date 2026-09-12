import { getPublicPosts } from "@/lib/posts";
import { sitemapEntries } from "@/lib/seo";

export const dynamic = "force-static";

export async function GET() {
  const posts = await getPublicPosts();
  const urls = sitemapEntries(posts);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
  </url>`).join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
