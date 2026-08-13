# 文章、摄影与项目内容维护

所有内容统一存放在 `public/<slug>/index.md`。每个 Markdown 都有详情页，也可以通过 frontmatter 标记汇入摄影或项目列表。

## 通用字段

```yaml
---
title: 内容标题
date: 2026-08-13
summary: 一句话摘要
tags: []
location: 杭州
hidden: false
pinned: false
photography: false
project: false
projectUrl: https://example.com
sourceUrl: https://github.com/example/repo
---
```

- `location` 可用于任何文章，也是摄影灯箱显示的地点。
- `pinned: true` 会在文章、摄影和项目列表中置顶；多篇置顶内容仍按日期倒序。
- `hidden: true` 只从首页文章、文章列表、RSS/Atom 和 sitemap 隐藏，详情页仍可访问。
- `photography: true` 和 `project: true` 不受 `hidden` 影响，可以同时使用。

## 添加摄影图集

1. 建立 `public/<slug>/index.md`。
2. 在 frontmatter 中设置 `photography: true`。
3. 将图片放在同一个 `public/<slug>/` 目录或其子目录，通过相对路径引用：

```md
![准确描述画面内容的图片说明](./photo.webp)
![另一张照片](./images/another-photo.webp)
```

- 图片 `alt` 会直接作为摄影列表和灯箱说明，不能为空。
- 摄影聚合按文章置顶状态、文章日期和图片正文顺序排列。
- 首页显示排序最前的 6 张，摄影页显示全部图片。
- 远程图片、data URL、HTML `<img>`、站内绝对路径和跨文章路径不会进入摄影聚合。
- 同一资源在正文中多次引用时，摄影聚合只收集第一次。

## 添加项目

在普通文章 frontmatter 中设置 `project: true`：

```yaml
---
title: 项目名称
date: 2026-08-13
summary: 项目解决的问题或用途
tags:
  - Next.js
  - TypeScript
project: true
projectUrl: https://example.com
sourceUrl: https://github.com/example/repo
---
```

- 项目名称链接站内文章详情。
- `projectUrl` 和 `sourceUrl` 都可省略；存在时分别显示“访问项目”和“查看源码”。
- 项目按置顶状态和日期倒序排列，首页显示前 3 个。
- 如果项目不应进入文章渠道，可同时设置 `hidden: true`。

修改完成后运行：

```bash
pnpm validate:content
pnpm build
```
