import * as config from "@/lib/config";

export const dynamic = "force-static";

export async function GET() {
  // Keep training opt-outs in the export as well as Cloudflare's managed rules.
  const trainingBots = [
    'Amazonbot', 'Applebot-Extended', 'Bytespider', 'CCBot', 'ClaudeBot',
    'CloudflareBrowserRenderingCrawler', 'Google-Extended', 'GPTBot', 'meta-externalagent',
  ];
  return new Response(`User-agent: *
# Content-Signal is a voluntary usage preference; bot-specific rules follow.
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /

${trainingBots.map((bot) => `User-agent: ${bot}\nDisallow: /`).join('\n\n')}

Sitemap: ${config.siteUrl}/sitemap.xml
`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
