# 文章、摄影、项目与友链内容维护

文章与摄影内容存放在 `public/<slug>/index.md`，封面、文内图片和其他引用资源放在同一个文章目录。项目资料保存在 `content/projects.json`，友链资料保存在 `content/friends.json`。每个 Markdown 都有详情页，也可以通过 frontmatter 汇入摄影列表。项目和友链登记后即可展示，不依赖文章引用。访问 `/<slug>/` 渲染文章，访问 `/<slug>.md` 返回 Markdown 原文。原文在构建时从 `index.md` 发布到站点根路径，并把相对资源改写成站点绝对路径，不另维护第二份源文件。

## 通用字段

```yaml
---
title: 内容标题
date: 2026-08-13
summary: 一句话摘要
tags: []
location: 杭州
hidden: false
noindex: false
showHeader: true
pinned: false
photography: false
cover: ./cover.webp
---
```

常规新文章仍只需填写 `title`、`date`、`summary` 和可选 `tags`，无需重复写入默认开关。进入文章或摄影列表的内容必须填写标题、日期和摘要；不参与这些列表的独立隐藏页可以省略日期。

- `title` 是内容标题，供页面、列表和 SEO 使用。`summary` 是摘要，供列表、详情、订阅和 SEO 使用；关于页和朋友们页面也直接读取这两个字段。
- `date` 是发布日期，显示为 `YYYY-MM-DD`，用于列表和订阅排序。
- `tags` 默认为空数组，用于展示、筛选、标签统计。`keywords` 默认为空数组，仅与标签、站点关键词合并后用于页面关键词元信息；常规写作只维护 `tags` 即可。两者支持数组或英文逗号分隔字符串，推荐使用数组。
- `location` 可用于任何文章，也是摄影灯箱显示的地点文案。
- `updated: YYYY-MM-DD` 可选，记录实质更新日期，不得早于 `date`；用于文章修改时间和 sitemap，不改变列表排序或原发布日期。未填写时不声明文章修改时间。
- `pinned: true` 会在文章和摄影列表中置顶；项目和友链是否置顶由各自注册表控制。
- `hidden` 默认为 `false`。设为 `true` 时从首页文章、文章列表、标签统计和 RSS/Atom 隐藏，详情页仍可访问。
- `noindex` 默认为 `false`。设为 `true` 时，HTML 声明 `noindex, follow`，Markdown 原文响应声明 `X-Robots-Tag: noindex`，同时从 sitemap、`llms.txt` 和详情页 JSON-LD 排除。它不改变列表或订阅内容，也不是访问权限。
- `hidden: true` 且 `noindex: false` 的内容仍进入 sitemap 和 `llms.txt`。允许索引的普通内容生成 `BlogPosting`，关于页生成 `AboutPage`，朋友们页面生成与当前友链一致的 `CollectionPage`；无日期的独立页不声明 sitemap 修改时间，机器阅读目录也省略日期。
- `showHeader` 默认为 `true`。设为 `false` 时隐藏详情页自动生成的标题、日期、地点、标签和摘要，元数据仍供 SEO 使用；正文、封面与目录不受影响。
- `noindex`、`showHeader` 必须使用 YAML 布尔值，不能填写字符串 `"false"`、空值或其他类型；读取、校验与响应头生成共用解析规则。
- `photography: true` 不受 `hidden` 影响。不要再填写 `projectId`，也不要使用已废弃的 `project`、`projectName`、`projectUrl`、`projectDescription`、`projectCover`。
- `cover` 可选。建议使用文章目录内的相对路径，例如 `./cover.webp`。封面显示在详情页摘要之后、正文之前，关闭页头时仍显示；文章列表不展示封面。没有 `cover` 时不生成占位图，也不会用正文图片递补。

关于页这类独立页面可以补齐元数据并保持从正文开始的排版：

```yaml
---
title: 关于 Rainey
summary: 关于我的经历与正在做的事情。
hidden: true
showHeader: false
---
```

该页面仍允许索引。语法测试页另外设置 `noindex: true`；不通过目录名自动判断索引策略。朋友们页面同样使用通用 Markdown 详情路由：

```yaml
---
title: 朋友们
summary: 去朋友那里坐坐。
hidden: true
showHeader: false
---
```

`friends` 可以用作文章 slug。页面不进入文章列表或订阅，但允许索引，并沿用现有流程进入 sitemap 和 `llms.txt`。

## 文章标签筛选

`/articles/` 默认不激活任何标签，显示全部公开文章（包括无标签文章），不单独显示“全部”选项。标签显示文章数量，按数量降序、数量相同时按标签名排序（`zh-CN`）。默认仅显示一行；放不下时在行末显示下箭头按钮，点击后展开所有标签。展开后末尾显示上箭头按钮，点击收起为一行，保留当前筛选。可见标签数随页面宽度调整。同一篇文章重复填写相同标签只计一次；`hidden: true` 的文章不参与统计。

标签为单选，再次点击已激活的标签即移除筛选、恢复全部文章。筛选后保留文章原有的置顶和日期顺序，标签数量和排列不随筛选改变。链接使用 `tag` 参数保存选择，例如 `/articles/?tag=诗歌`（中文会自动进行 URL 编码），支持刷新、分享和浏览器前进后退。清除筛选时移除 `tag` 参数，未知或空标签按未筛选状态展示。展开状态仅保留在当前页面，刷新后默认恢复一行；若分享链接选中的标签被折叠，可通过下箭头按钮查看。

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

- `name`、`url`、`date` 必填。`date` 是项目自身日期，格式为 `YYYY-MM-DD`。
- `description`、`cover`、`pinned` 可省略。
- `cover` 可以是 HTTPS 图片，也可以是指向 `public/` 中文件的站点绝对路径。未设置或加载失败时，卡片使用项目名称首字符作为中性占位。
- 登记即可在首页和项目页展示，不需要再写一篇关联文章。规范化后相同的项目网址不能注册为多个项目。
- 项目先按注册表中的 `pinned` 排序，再按注册表日期倒序，最后按 ID 排序；首页显示前 3 个。
- 项目卡片直接打开注册表中的 `url`。名称、简介、图标和网址都以注册表为准。

## 添加友链

友链登记在 `content/friends.json`，字段与项目类似，但用 `icon` 表示站点图标：

```json
{
  "example-blog": {
    "name": "朋友的博客",
    "url": "https://example.com",
    "icon": "/assets/friends/example-blog.png",
    "date": "2026-09-22",
    "description": "记录生活与一些想法",
    "pinned": false
  }
}
```

- `name`、`url`、`date` 必填；`date` 是收录日期。
- `icon`、`description` 可选；`pinned` 默认 `false`。
- `icon` 只接受 HTTPS 图片或站内绝对资源路径，不自动猜测或抓取 favicon。
- 排序规则与项目相同：置顶优先、日期倒序、ID 排序。登记即可展示。
- 首页不单独展示友链区块，也不放页脚入口。空列表在朋友们页面显示「暂时还没有添加朋友。」

## 在 Markdown 中引用项目和友链

使用标准链接的 title 声明数据标记。页面按 token 识别；名称、网址、简介和图标统一读取注册表，Markdown 自带的名称与网址只给普通阅读器兜底。

```md
最近在做 [小分身](https://xiaofenshen.com "project:xiaofenshen")。

[小分身](https://xiaofenshen.com "project:xiaofenshen")

[全部项目](https://rainey.space/projects/ "project:*")

[朋友的博客](https://example.com "friend:example-blog")

[朋友们](https://rainey.space/friends/ "friend:*")
```

| 标记 | 行内模式 | 独立块模式 |
|---|---|---|
| `project:ID` | 图标+名称，悬停弹出项目卡 | 项目卡 |
| `project:*` | 全部项目图标+名称，悬停弹出项目卡 | 项目卡列表 |
| `friend:ID` | 图标+名称，悬停弹出友链卡 | 友链卡 |
| `friend:*` | 全部友链图标+名称，悬停弹出友链卡 | 友链卡列表 |

- 顶层段落只有一个标记时渲染独立块，前后需要空行；其余场景使用行内模式。行内集合以顿号分隔。
- 行内模式显示图标和名称，悬停或键盘聚焦时渐隐渐显弹出原卡片。
- 标题、列表、引用和表格中保持行内模式；普通换行不改变模式。
- 支持标准引用式链接；代码块、行内代码与转义内容保持原样。
- 空块级集合显示简短空状态，空行内集合保留普通集合入口。
- 卡片区域隔离正文的图片、段落和链接装饰；卡片图标不进入灯箱，卡片名称不加入目录。
- 公开 Markdown 和 RSS/Atom 会展开为当前注册表的普通链接或列表，并去掉特殊 title。源文件不回写。
- 已声明的标记格式错误、ID 不存在或注册表数据非法时，内容校验与构建会失败并定位来源；普通链接不受影响。

修改完成后运行：

```bash
pnpm validate:content
pnpm build
pnpm test:seo
pnpm validate:seo
```
