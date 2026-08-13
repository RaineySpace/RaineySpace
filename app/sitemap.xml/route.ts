import { getPublicPosts } from "@/lib/posts";
import * as config from "@/lib/config";

export const dynamic = "force-static";

export async function GET() {
  const posts = await getPublicPosts();
  const urls = [
    { loc: config.siteUrl, lastmod: new Date().toISOString() },
    { loc: `${config.siteUrl}/articles/`, lastmod: new Date().toISOString() },
    { loc: `${config.siteUrl}/photography/`, lastmod: new Date().toISOString() },
    { loc: `${config.siteUrl}/projects/`, lastmod: new Date().toISOString() },
    ...posts.map((post) => ({
      loc: `${config.siteUrl}/${post.slug}/`,
      lastmod: (post.date || new Date()).toISOString(),
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
  </url>`).join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
