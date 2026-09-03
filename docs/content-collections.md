# 文章、摄影与项目内容维护

文章与摄影内容存放在 `public/<slug>/index.md`，项目资料集中保存在 `content/projects.json`。每个 Markdown 都有详情页，也可以通过 frontmatter 汇入摄影列表或关联一个项目。

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
projectId: example-project
cover: ./cover.webp
---
```

- `location` 可用于任何文章，也是摄影灯箱显示的地点文案。
- `pinned: true` 会在文章和摄影列表中置顶；项目是否置顶由项目注册表控制。
- `hidden: true` 只从首页文章、文章列表、RSS/Atom 和 sitemap 隐藏，详情页仍可访问。
- `photography: true` 和 `projectId` 不受 `hidden` 影响，可以同时使用。
- `cover` 可选。建议使用文章目录内的相对路径，例如 `./cover.webp`。有封面时会显示在标题上方；没有封面的文章保持原来的标题开头排版。

## 添加摄影图集

1. 建立 `public/<slug>/index.md`。
2. 在 frontmatter 中设置 `photography: true`。
3. 将图片放在同一个 `public/<slug>/` 目录或其子目录，通过相对路径引用：

```md
![准确描述画面内容的图片说明](./photo.webp)
![另一张照片](./images/another-photo.webp)
```

- 图片 `alt` 会直接作为摄影列表和灯箱说明，不能为空。
- 构建时会从**原图**读取 EXIF：拍摄时间、GPS、相机/镜头、光圈、快门、ISO、焦距。压缩后的 WebP 不含这些信息，灯箱主预览仍加载原图。
- 灯箱优先显示 EXIF 拍摄时间；没有时回退到文章 `date`。地点文案仍来自 frontmatter `location`，有 GPS 时额外提供 OpenStreetMap 链接。
- 摄影聚合按文章置顶状态、文章日期和图片正文顺序排列；摄影页按图集分节，首页显示排序最前的 6 张。
- 远程图片、data URL、HTML `<img>`、站内绝对路径和跨文章路径不会进入摄影聚合。
- 同一资源在正文中多次引用时，摄影聚合只收集第一次。
- 摄影原图缺少可读拍摄时间时，内容校验会给出 warning，不会失败。

## 添加项目

先在 `content/projects.json` 注册项目。对象的键是稳定的项目 ID，不随项目名称或网址变化：

```json
{
  "example-project": {
    "name": "项目名称",
    "url": "https://example.com",
    "date": "2026-08-13",
    "description": "项目解决的问题或用途",
    "cover": "/assets/projects/example-project.webp",
    "pinned": false
  }
}
```

- `name`、`url`、`date` 必填。`date` 是项目自身日期，格式为 `YYYY-MM-DD`，与关联文章日期相互独立。
- `description`、`cover`、`pinned` 可省略。
- `cover` 可以是 HTTPS 图片，也可以是指向 `public/` 中文件的站点绝对路径。未设置时卡片使用项目名称首字符生成渐变字标。
- 每个注册项目至少需要被一篇文章引用；规范化后相同的项目网址不能注册为多个项目。

然后在相关文章 frontmatter 中引用项目 ID：

```yaml
---
title: 一篇与项目有关的文章
date: 2026-08-13
summary: 文章摘要
projectId: example-project
---
```

- 同一个项目可以被多篇文章引用，主页和项目页仍只显示一张项目卡片。
- 项目先按注册表中的 `pinned` 排序，再按最新关联文章日期倒序；首页显示前 3 个。
- 项目卡片直接打开注册表中的 `url`，文章正文底部也会显示同一张项目卡片。
- 注册表是项目展示资料的唯一来源；修改注册表会同步影响主页、项目页和所有相关文章。
- 如果相关文章不应进入文章渠道，可以同时设置 `hidden: true`，它仍会参与项目聚合。

修改完成后运行：

```bash
pnpm validate:content
pnpm build
```
