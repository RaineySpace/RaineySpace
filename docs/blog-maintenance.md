# 博客维护说明

这个项目是一个基于 Next.js App Router 的静态博客。文章内容存放在 `public/<slug>/index.md`，构建后输出到 `out/`，用于 Cloudflare Pages 部署。

## 项目结构

- `app/page.tsx`：首页文章列表。
- `app/[slug]/page.tsx`：文章详情页，包含文章 metadata 和目录。
- `app/rss.xml/route.ts`、`app/atom.xml/route.ts`：RSS 和 Atom feed。
- `app/sitemap.xml/route.ts`、`app/robots.txt/route.ts`：搜索引擎入口。
- `app/llms.txt/route.ts`：公开文章的 AI 阅读导航。
- `lib/posts.ts`：文章读取、frontmatter 归一化、Markdown 渲染、日期格式、公开文章过滤和 feed 数据逻辑。
- `lib/seo.ts`：规范网址、页面元数据、JSON-LD、sitemap 条目和 llms.txt 内容。
- `lib/config.ts`：站点 URL、标题、作者、头像、关键词等全局配置。
- `scripts/new-post.mjs`：新建文章脚本。
- `scripts/validate-content.mjs`：内容校验脚本。
- `scripts/optimize-images.mjs`：构建前根据原图生成展示用 WebP。

## 新建文章

```bash
pnpm new-post <slug> [title]
```

示例：

```bash
pnpm new-post my-new-post "我的新文章"
```

脚本会创建：

```text
public/my-new-post/index.md
```

默认 frontmatter：

```yaml
---
title: 我的新文章
date: YYYY-MM-DD
summary: 
tags: []
---
```

公开文章建议填写 `title`、`date`、`summary`。`tags` 可以为空数组。

文章有实质更新时，可以添加：

```yaml
updated: 2026-09-12
```

`updated` 必须是合法的 `YYYY-MM-DD` 日期，且不得早于 `date`。不填写时不输出文章修改时间，sitemap 的 `lastmod` 回退到发布日期。不要把构建或部署时间写成内容更新时间。`date` 继续决定文章和 feed 的排序；`updated` 不会改变置顶、排序或发布日期的展示。

可选封面：

```yaml
cover: ./cover.webp
```

封面文件放在同一文章目录下，使用相对路径。只有文章详情页会把封面渲染在标题上方，首页和文章列表不显示封面。没有 `cover` 的文章不显示占位图，也不用正文图片顶替封面，仍从标题开始排版。

## 隐藏文章

如果文章只希望直接访问，不希望进入首页、feed 和 sitemap，添加：

```yaml
hidden: true
```

隐藏文章仍会被静态生成，所以 `/about/` 这类页面可以继续作为独立页面使用。

`hidden` 不等于 `noindex`，也不是访问控制。摄影和项目的集合成员资格仍与 `hidden` 无关；它们的频道 JSON-LD 与频道实际展示的条目一致。`llms.txt` 的公开文章目录和 sitemap 一样，不枚举隐藏详情页或其 Markdown 原文。

## SEO 与 AI 阅读

首页、文章、摄影、项目和详情页各自提供标题、描述、canonical、Open Graph 与 Twitter 元数据。页面规范网址统一为 `https://rainey.space/` 下带尾斜杠的 HTML 地址；`/articles/?tag=摄影` 等筛选链接的 canonical 始终是 `/articles/`，不额外生成标签索引页。聚合页不声明无法确认的 `lastmod`。

首页提供 `WebSite` 与 `Person`，公开文章提供 `BlogPosting`，频道页提供 `CollectionPage` 与 `ItemList`，关于页提供 `AboutPage`。作者身份和已公开的个人资料链接来自 `lib/config.ts`；结构化数据只使用实际内容，有明确文章封面时才声明文章图片。JSON-LD 统一转义 `<`，防止内容中的 `</script>` 结束脚本元素。

每页都提供 RSS/Atom 自动发现链接，详情页额外声明 `text/markdown` 替代格式。原文仍位于 `/<slug>/index.md`，不维护第二份文章。`public/_headers` 随构建复制到 `out/_headers`，由 Cloudflare Pages 为 Markdown 响应添加指向对应 HTML 页的 HTTP `Link: <...>; rel="canonical"`。变更站点域名时，需要同时更新该文件并运行 SEO 校验。普通本地静态服务器不会解释 `_headers`。

`/llms.txt` 在构建时从现有内容生成站点导航、公开文章标题、摘要、日期和 Markdown 链接，并提供 HTML 原文链接供引用。它只是机器阅读的便利入口，不保证排名或 AI 引用量提升；[Google 的 AI 搜索功能仍遵循基础 SEO 要求](https://developers.google.com/search/docs/appearance/ai-features)。

### 抓取策略

允许搜索索引和用户发起的检索引用，拒绝模型训练。源码 `robots.txt` 声明 `Content-Signal: search=yes, ai-input=yes, ai-train=no`，通用规则允许访问，训练用途的爬虫单独使用 `Disallow: /`。Content-Signal 是用途声明，不能代替爬虫自身支持的控制项；`robots.txt` 也不能保证不遵守规则的第三方不会使用公开内容。

- 允许 `Googlebot`、`Bingbot`、`OAI-SearchBot`、`Claude-SearchBot`、`PerplexityBot`，以及 `ChatGPT-User`、`Claude-User`、`Perplexity-User`；它们沿用通用的 `Allow: /`。
- 拒训名单与已核对的 Cloudflare 托管规则一致：`Amazonbot`、`Applebot-Extended`、`Bytespider`、`CCBot`、`ClaudeBot`、`CloudflareBrowserRenderingCrawler`、`Google-Extended`、`GPTBot`、`meta-externalagent`。
- [OpenAI 将搜索和训练爬虫分别控制](https://developers.openai.com/api/docs/bots)。[Google-Extended 同时控制 Gemini 的训练及部分检索引用](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers#google-extended)，这里选择拒训优先；不因此关闭 Google 搜索。
- Cloudflare 目前还会在源文件前追加托管拒训规则。保留现有托管和训练拦截配置，检查实际响应中的合并规则。源码发布不会修改 Cloudflare 安全开关。
- 后续迁移 [Cloudflare 分类策略](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/) 时，目标为 Search、Agent 允许，Training 阻止；搜索与训练混用的爬虫按训练处理。域名级设置可能影响子域名，迁移应独立核对影响范围。

## 图片和附件

文章内图片建议放在当前文章目录下，并使用相对路径：

```markdown
![](./cover.png)
```

内容校验会检查公开文章中的本地图片和 `cover` 是否存在。缺失图片会输出 warning。

正文继续引用原图，例如 `./photo.jpg`。构建和本地开发前会生成压缩 WebP 到 `public/_optimized/`，用于文章正文、文章封面、摄影列表和灯箱底栏；灯箱主预览仍加载原图。压缩图是构建产物，不要提交到 git。

```bash
pnpm optimize:images
```

## 内容校验

```bash
pnpm validate:content
```

校验内容：

- 公开文章是否包含 `title`、`date`、`summary`
- 日期是否合法
- `updated` 是否为合法日期，且不早于发布日期
- 本地封面文件是否存在
- Markdown 本地图片是否存在

当前已知 warning：

```text
my-programmer-growth-journey: missing image asset ./attachments/bafybeie6xzabiit4b5t4x526f42276l3igxczrfuom2egfbj23qp2ujz2a
```

## 本地开发

```bash
pnpm install
pnpm dev
```

开发服务默认使用 [http://localhost:6660/](http://localhost:6660/)，避免与其他项目常用的 `3000` 端口冲突。

如果本地 `next dev` 遇到文件监听数量限制，可以先用静态构建验收：

```bash
pnpm build
python3 -m http.server 4173 --directory out
```

然后访问：

```text
http://localhost:4173/
```

## 构建和部署

```bash
pnpm build
pnpm test:seo
pnpm validate:seo
pnpm deploy:cf
```

`pnpm build` 会生成：

- 首页
- 文章页
- RSS
- Atom
- sitemap
- robots
- llms.txt

`pnpm test:seo` 检查日期、元数据、结构化数据序列化和隐藏内容边界，并通过临时 Markdown 验证实际内容读取和 CLI 校验。`pnpm validate:seo` 读取 `out/`，检查页面元数据、JSON-LD、静态正文、sitemap、feed、Markdown 原文、llms.txt 链接及 `_headers`；运行前必须完成当前版本的 `pnpm build`。这两项使用已有 TypeScript 编译器和 Node.js，不引入浏览器端依赖。

`pnpm deploy:cf` 会先构建，再通过 Wrangler 部署 `out/` 到 Cloudflare Pages。

### 上线核查

发布后检查首页、一个频道页和一篇文章，以及 `/robots.txt`、`/sitemap.xml`、`/llms.txt` 的 HTTP 状态和内容；确认文章 Markdown 返回 `text/markdown`，HTTP `Link` 指向同一篇 HTML canonical。检查最终 `robots.txt` 中托管规则与源码规则的合并结果。

使用 Cloudflare 安全事件或真实爬虫访问记录排查 403/挑战，确认搜索与用户读取没有被额外拦截。仅修改 User-Agent 的请求不代表真实爬虫，也不足以确认某条防火墙规则导致拦截，不据此创建宽泛白名单。通过 Google Search Console、Bing Webmaster Tools 检查 sitemap 和代表性网址的抓取、索引状态；抓取允许不保证一定收录或被引用。

## 维护约定

- 不要把项目维护说明写入 `README.md`，该文件用于 GitHub public profile。
- 不要改变 `public/<slug>/index.md` 的文章存储方式，除非明确执行内容迁移。
- 不要让隐藏文章进入首页、feed 或 sitemap。
- 日期展示保持 `YYYY-MM-DD`。
- 优先保持轻量个人博客风格，避免引入复杂内容系统。
