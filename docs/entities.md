# 文档即实体

每个 `public/<slug>/index.md` 定义一个实体。目录名是全局唯一 slug，metadata 是属性，正文是内容，普通 Markdown 内链建立关联。详情地址为 `/<slug>/`，公开 Markdown 为 `/<slug>.md`。所有类型使用同一静态发布链路，没有 JSON 名录、数据库或 CMS。

## 共享属性

| 属性 | 默认／约束 | 用途 |
|---|---|---|
| `type` | 必填，`article` / `project` / `friend` / `contact` | 决定集合与渲染 |
| `title` | 必填非空文字 | 完整标题，用于详情、卡片和 SEO |
| `name` | 省略时使用 `title` | 自动生成的行内名称；只有简称与完整标题不同才填写 |
| `summary` | 可选，公开文章必填 | 简介，用于详情、卡片和 SEO；不再使用 `description` |
| `date` | 可选，公开文章必填，`YYYY-MM-DD` | 实体日期与列表排序，不用文件时间补造 |
| `updated` | 可选，`YYYY-MM-DD`，必须有 `date` 且不早于它 | 实质内容更新，用于 SEO 和 sitemap，不改变排序 |
| `tags` | 空数组 | 可见标签；文章筛选、统计仅包含公开文章 |
| `keywords` | 空数组 | SEO 专用，与站点关键词和 tags 去重合并，不显示为标签 |
| `icon` | 可选，HTTPS 或站内绝对路径 | 头像、标志、小图标，不作为分享封面 |
| `cover` | 可选，相对路径、站内绝对路径或 HTTP(S) | 详情头图、分享大图及悬浮卡片封面；列表不显示，没有时不从正文取首图 |
| `location` | 可选文字 | 文档地点说明，摄影使用来源文档的说明，不推断精确坐标 |
| `url` | 可选，contact 必填 | HTTP(S) 相关网址，contact 额外允许单个邮箱的 `mailto:` |
| `redirect` | `false` | 详情是否跳转到 url；启用时必须提供 HTTP(S) 目标，不能自动打开邮件应用 |
| `noindex` | `false` | 控制索引及 sitemap、llms.txt、JSON-LD，不控制列表、摄影或关联 |
| `showHeader` | `true` | 显示自动头部；关闭仍保留封面、正文、目录和关联区域 |

布尔字段仅接受 YAML 布尔值。tags、keywords 推荐数组，也支持英文逗号分隔字符串。未知属性报错；不接受 `id`、`slug`、`order`、`related`、`extensions` 或旧的文档级 `photography`。今后确需专属属性时直接在类型与校验器中定义。

没有 summary 时不补写可见简介，SEO 使用站点默认描述；没有 cover 时使用站点默认分享图。有效不索引状态也用于过滤集合的 JSON-LD 条目，但不影响可见卡片或摄影成员。

## 类型与日期含义

- `article`：文章、随笔、图集、关于页、授权页等正文内容。date 是发布日期，公开文章必须有 date、summary。专属 `hidden` 默认 false，设为 true 时排除文章列表、标签统计和 RSS/Atom；专属 `pinned` 默认 false，设为 true 时在首页和文章集合置顶，不影响订阅和摄影排序。
- `project`：项目、产品或实验。title 是项目名称，date 是项目开始日期，summary 介绍用途，icon 是标志，url 是项目网址。现有记录原日期原样迁移，不另推断。没有其他专属属性。
- `friend`：朋友及其站点。title 是站点标题，name 可以是朋友名字，date 是收录日期，icon 是头像或站点标志，下载到对应文档目录后使用站内绝对路径引用，url 是站点地址。没有其他专属属性。
- `contact`：联系方式、账号或订阅入口。title 是渠道名称，summary 是用途，date 是收录日期，url 必填。没有其他专属属性。

`page` 不单独建模：关于、授权、测试等页面使用 `article + hidden: true`；隐藏文档可以不填日期。hidden 不控制访问或索引，也不排除引用关系。

```yaml
---
type: friend
title: SeasonX
name: Season
summary: 个人博客 · 技术、思考与生活
date: 2026-09-22
icon: /Season/icon.svg
url: https://seasonx.life/
redirect: true
---
```

## 集合与详情渲染

| 路径 | 内容与排序 | 展示 |
|---|---|---|
| `/article/` | article 且非 hidden，pinned 优先、日期倒序 | 文章文字卡：标题、日期、标签、摘要；保留单选标签筛选与折叠 |
| `/project/` | 全部 project，日期倒序 | 单列实体卡：48px 图标、标题和简介各一行，超出省略 |
| `/friend/` | 全部 friend，日期倒序 | 同项目卡片 |
| `/contact/` | 全部 contact，日期倒序 | 同项目卡片 |
| `/photography/` | 所有显式标记图片，拍摄时间优先 | 平铺网格与同一个灯箱序列，不按文章或地点分组 |

没有日期排最后，同日期按 slug 升序。标准实体卡片不显示日期、标签或正文。缺 icon 用标题首字占位，图标保持比例。文章列表及独立卡片不显示 icon 或 cover。四种实体的悬浮预览共用标准卡片，按封面自动切换布局：有 cover 时宽度为 320px（受视口两侧各 20px 留白约束），顶部通栏封面按 16:9 裁切填满，最大高度 180px，下方标题和简介各最多两行、内边距 14px；没有 cover 或封面加载失败时，恢复左侧 48px 图标、右侧标题和简介各一行的紧凑布局。图标保持比例，缺失或加载失败时显示标题首字。封面复用优化后的响应式图片，按实际卡片宽度选择资源，不从正文补取图片。

首页保留 WELCOME.md、3 篇文章、6 张摄影照片条、全部项目卡片、全部朋友名称标记及页脚联系方式图标。朋友自动名称使用 name，悬浮卡片使用 title。页脚联系方式直接访问 url；其他实体链接访问本站详情。

详情共用正文、目录、图片与灯箱。非文章头部可以展示 icon 和外链入口；正文允许为空。showHeader 不影响 SEO。非跳转详情末尾直接展示关联的实体列表，不显示标题；反向引用列表保留“引用此文档的内容”标题。空集合不显示，按日期倒序与 slug 排序。

共享渲染器为 `lib/entity-rendering.ts`，React 的 Entity、EntityList 与 Markdown 共用默认模板和类型覆盖。文章列表也使用 Entity；所有悬浮预览共用默认 popover 配置中的标准实体卡片。详情通过 EntityDetail、EntityHeader 组织，头部差异读取同一展示配置。各实体的六种形态、组件职责和扩展方式见 [实体渲染形态与组件映射](./entity-rendering-design.md)。

渲染参数按 card / inline 区分：卡片支持标题层级和适用的图标设置；行内支持文字 / chip / icon、sm / md / lg、图标和悬浮预览。错误的形态参数组合由类型检查拒绝。保持现有鼠标、键盘和触控边界，默认使用本站实体地址；仅显式 external 联系动作使用 url。

## 内链与关联

```md
在正文中引用 [我给项目起的名字](/xiaofenshen/)。

[小分身](/xiaofenshen/)

[全部项目](/project/)
```

行内实体链接保留作者文字、格式与悬浮预览。顶层独立段落中的单个文字链接：指向实体展开卡片，指向四种实体集合展开列表。列表、引用块、标题内的链接保持行内。行内集合链接只导航；摄影链接不展开图库。query、hash、`.md` 链接保持导航用途，不块级展开。

识别 `/slug`、`/slug/`、`/slug.md`、本站绝对地址和相对地址。身份忽略 query/hash，导航保留它们。外部网址不会反查 url 字段，因此要建立关联应写本站内链。

先对全部原始 Markdown 提取引用，再展开卡片或集合：hidden、noindex、redirect 文档均在索引中。重复引用去重，自引用忽略，互相引用合法。集合展开不会给全部成员建立关系；图片 token、代码、WELCOME.md、系统导航和自动关联区域不生成文档间关系。

`lib/content-index.ts` 先读取所有 metadata，再提取引用；`lib/entity-metadata.ts` 统一校验；`lib/posts.ts` 负责正文、图片、详情和订阅；`lib/markdown-refs.ts` 负责内链识别与展开。读取索引不会递归渲染目标文档。

## 静态跳转与公开 Markdown

redirect 实体由构建生成的 `_redirects` 以 302 跳转，精确覆盖 `/slug`、`/slug/`，不覆盖资源或 `.md`。旧复数集合以 301 转到同名单数集合，保留查询参数。静态兜底页保留自动跳转和手动入口；实体跳转链接跳过客户端页面过渡。目标 query 优先，否则沿用来源 query；浏览器片段行为在客户端兜底保持一致。

有效不索引状态是 `noindex || redirect`。公开 Markdown 保留实体身份和普通内链，集合展开为 Markdown 列表，相对资源（包括带 title 或引用式图片）改写为站内绝对地址。跳转实体的 `.md` 声明 noindex 且不声明指向本站跳转页的 canonical。构建不会留下 `out/<slug>/index.md`。

## 联系方式图标来源

`public/assets/contacts/` 的单色 SVG 使用 `--contact-icon-filter` 适配明暗主题，仅作用于此目录，不改变其他彩色图标。RSS 图标由用户提供，订阅 url 为 `https://rainey.space/feed`。历史官方图标于 2026-09-23 获取；更新时确认响应是图片而非拦截页。

| 资源 | 官方来源 |
|---|---|
| blog | https://rainey.space/favicon.ico |
| github | https://github.githubassets.com/favicons/favicon.png |
| bilibili | https://space.bilibili.com/favicon.ico |
| jike | https://web.okjike.com/apple-touch-icon.png |
| x | https://x.com/favicon.ico |
