import * as config from "@/lib/config";

export const dynamic = "force-static";

export async function GET() {
  return new Response(`User-agent: *
Allow: /

Sitemap: ${config.siteUrl}/sitemap.xml
`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
