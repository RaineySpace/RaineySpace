# 博客维护说明

这个项目是一个基于 Next.js App Router 的静态博客。文章内容存放在 `public/<slug>/index.md`，构建后输出到 `out/`，用于 Cloudflare Pages 部署。

## 项目结构

- `app/page.tsx`：首页文章列表。
- `app/[slug]/page.tsx`：文章详情页，包含文章 metadata 和目录。
- `app/rss.xml/route.ts`、`app/atom.xml/route.ts`：RSS 和 Atom feed。
- `app/sitemap.xml/route.ts`、`app/robots.txt/route.ts`：搜索引擎入口。
- `lib/posts.ts`：文章读取、frontmatter 归一化、Markdown 渲染、日期格式、公开文章过滤和 feed 数据逻辑。
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

可选封面：

```yaml
cover: ./cover.webp
```

封面文件放在同一文章目录下，使用相对路径。文章页和文章列表会把封面渲染在标题上方。没有 `cover` 的文章不显示占位图，仍从标题开始排版。

## 隐藏文章

如果文章只希望直接访问，不希望进入首页、feed 和 sitemap，添加：

```yaml
hidden: true
```

隐藏文章仍会被静态生成，所以 `/about/` 这类页面可以继续作为独立页面使用。

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
pnpm deploy:cf
```

`pnpm build` 会生成：

- 首页
- 文章页
- RSS
- Atom
- sitemap
- robots

`pnpm deploy:cf` 会先构建，再通过 Wrangler 部署 `out/` 到 Cloudflare Pages。

## 维护约定

- 不要把项目维护说明写入 `README.md`，该文件用于 GitHub public profile。
- 不要改变 `public/<slug>/index.md` 的文章存储方式，除非明确执行内容迁移。
- 不要让隐藏文章进入首页、feed 或 sitemap。
- 日期展示保持 `YYYY-MM-DD`。
- 优先保持轻量个人博客风格，避免引入复杂内容系统。
