# 博客维护说明

这个项目是一个基于 Next.js App Router 的静态博客。文章内容存放在 `public/<slug>/index.md`，封面和附件放在同一个文章目录，构建后输出到 `out/`，用于 Cloudflare Pages 部署。访问 `/<slug>/` 渲染文章，访问 `/<slug>.md` 返回 Markdown 原文。

## 运行时与 TypeScript

`mise.toml` 固定 Node.js `24.21.0` 和 pnpm `10.33.0`。首次运行 `mise install`，然后执行 `mise exec -- pnpm install --frozen-lockfile`。未自动激活 mise 的终端，后续命令统一加 `mise exec --` 前缀。

应用使用 Next.js `16.3.6`、React `19.3.0` 和 TypeScript `6.0.3`。页面和组件由 Next.js 默认的 Turbopack 编译；共享模块、维护脚本与测试由 Node 原生擦除类型后执行，不使用自定义加载器。原生执行不做类型检查，因此提交与发布前必须运行 `pnpm verify`。

根包使用 ESM。共享模块和脚本的相对导入必须带 `.ts` 扩展名，不依赖 `@/*` 别名；React JSX 文件使用 `.tsx`，保留应用别名。Node 执行的代码仅使用可擦除类型语法，不使用枚举、参数属性等需要转译的语法。脚本自身位置使用 `import.meta.url`，内容和构建目录使用 `process.cwd()`，便于在临时目录运行校验。

`next.config.ts` 保持静态导出，Tailwind 配置保持 `.ts`；仅 `postcss.config.mjs`、`eslint.config.mjs` 使用 `.mjs`。`tsconfig.json` 使用 `ESNext` / `bundler` / `react-jsx`；`tsconfig.scripts.json` 使用 `NodeNext` 并启用 `erasableSyntaxOnly`，覆盖全部脚本、测试和共享模块。两者严格检查、禁止 JavaScript 输入、不输出代码，缓存分别存放于 `.cache/typescript/`。

`pnpm typecheck` 先执行 `next typegen`，再运行两套 `tsc` 检查。`next-env.d.ts`、`.next/types/` 和 `.next/dev/types/` 由 Next.js 自动管理，不提交 Git。ESLint 独立运行 `pnpm lint`；构建保留 Next.js 自身的类型检查。

参考：[Next.js TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript)、[Next.js 16 升级指南](https://nextjs.org/docs/app/guides/upgrading/version-16)、[Node 原生 TypeScript](https://nodejs.org/api/typescript.html)。

## 依赖与样式维护

依赖使用兼容的稳定版本。当前 Tailwind CSS 为 `4.3.3`、Marked 为 `18.0.14`、Feed 为 `6.0.0`、Sharp 为 `0.35.4`。TypeScript 暂留 `6.0.3`，因为 [typescript-eslint 的支持范围](https://typescript-eslint.io/users/dependency-versions/)尚未包含 TypeScript 7；ESLint 暂留 `9.39.5`，因为 Next.js 使用的 `eslint-plugin-react` 和 `eslint-plugin-jsx-a11y` 尚未声明支持 ESLint 10。`@types/node` 跟随 Node 24，而非独立升级到 Node 26。后续升级先核对插件的 peerDependencies，再更新锁文件，不通过强制覆盖忽略兼容约束。

Tailwind 4 通过 `@tailwindcss/postcss` 接入，自带前缀处理，不再单独安装 Autoprefixer。`app/globals.css` 使用 `@import "tailwindcss"`、`@config "../tailwind.config.ts"` 加载现有字号与 typography 配置，并显式限定 `app/` 为工具类扫描目录。CSS 变量工具类使用 `text-(--secondary)` 等 v4 语法。新增全局元素默认样式应放在 `@layer base` 内，避免覆盖工具类；现有灰色值、焦点轮廓与模糊强度保持升级前效果。

摄影缩略图保留基于 `transform` 的旋转和缩放，灯箱开场几何读取同一变换矩阵；不要直接替换成独立 `rotate` / `scale` 属性。减少动态效果模式下，使用 `motion-reduce:translate-none!` 覆盖悬停和焦点状态的独立位移。按照 [Tailwind 4 官方兼容要求](https://tailwindcss.com/docs/upgrade-guide)，浏览器最低版本为 Safari 16.4、Chrome 111、Firefox 128。

Marked 的自定义 renderer 接收 token 对象；标题中的行内 Markdown 通过 `renderer.parser.parseInline(tokens)` 渲染。升级 Markdown 解析器时运行 `pnpm test:seo`，确保格式化标题、重复标题锚点、目录文字与图片属性保持正确。升级 Sharp 可能重建图片缓存；原图字节和内容哈希 URL 必须保持稳定，预览图的 URL 始终取自实际输出字节。

## 项目结构

- `app/page.tsx`：首页文章列表。
- `app/[slug]/page.tsx`：文章详情页，包含文章 metadata 和目录。
- `app/rss.xml/route.ts`、`app/atom.xml/route.ts`：RSS 和 Atom feed。
- `app/sitemap.xml/route.ts`、`app/robots.txt/route.ts`：搜索引擎入口。
- `app/llms.txt/route.ts`：允许索引内容的 AI 阅读导航。
- `lib/posts.ts`：文章读取、frontmatter 归一化、Markdown 渲染、日期格式、文章频道／允许索引内容筛选和 feed 数据逻辑。
- `lib/registry.ts`：项目与友链注册表读取、校验字段、排序。
- `lib/markdown-refs.ts`：识别 `project:` / `friend:` 链接 title，并生成卡片、行内图标名称、悬停预览和公开 Markdown 展开结果。
- `lib/seo.ts`：规范网址、页面元数据、JSON-LD、sitemap 条目和 llms.txt 内容。
- `lib/config.ts`：站点 URL、标题、作者、头像、关键词等全局配置。
- `scripts/new-post.ts`：新建文章脚本。
- `scripts/validate-content.ts`：内容校验脚本。
- `scripts/optimize-images.ts`：构建前根据原图生成展示用 WebP。
- `scripts/export-markdown.ts`：构建后把 `public/<slug>/index.md` 发布为 `out/<slug>.md`，把相对资源改写成站点绝对路径，并删除会泄漏的 `out/<slug>/index.md`。

## 项目授权

原创程序代码采用 MIT，根目录 `LICENSE.txt` 保存全文与适用范围，`package.json` 的 `license` 为 `MIT`。所有原创文字与摄影内容默认采用 CC BY-NC-ND 4.0，第三方素材和单独声明的内容除外。授权说明源文件为 `public/license/index.md`，发布为 `/license/` 和 `/license.md`；设置 `hidden: true`，不进入文章列表或 RSS/Atom，但允许搜索索引。首页 footer 链接至该页，feed 的内容版权声明由 `lib/config.ts` 统一维护。

根目录 `LICENSE-CONTENT.txt` 是 2026-09-23 从 `https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode.txt` 获取的未经修改的官方英文全文。协议全文只在仓库保留，不复制到 `public/`；授权页面面向内容读者，仅介绍文字与摄影内容的 CC 授权并链接官方全文和中文法律文本，不展示代码许可或仓库文件说明。不要把站点说明写入 CC 协议全文，也不要将内容授权声明套用到 `package.json` 的代码许可字段。

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

封面文件放在同一文章目录下，使用相对路径。文章详情页在摘要之后、正文之前显示封面，首页和文章列表不显示封面。封面默认显示压缩图，点击或用键盘打开灯箱查看原图，关闭后焦点回到封面。没有 `cover` 的文章不显示占位图，也不用正文图片顶替封面。

## 隐藏文章

如果内容不希望进入首页文章、文章列表、标签统计和 RSS/Atom，添加：

```yaml
hidden: true
```

隐藏文章仍会被静态生成，所以 `/about/` 这类页面可以继续作为独立页面使用。

`hidden` 默认为 `false`，不控制索引或访问权限。摄影集合仍与 `hidden` 无关；项目和友链来自注册表，也不依赖文章引用。它们的频道 JSON-LD 与实际展示的条目一致。sitemap 和 `llms.txt` 按独立的 `noindex` 字段筛选，允许索引的隐藏页面也会被列出。

## 索引与页头开关

```yaml
noindex: true
showHeader: false
```

`noindex` 默认为 `false`。设为 `true` 时，HTML 声明 `noindex, follow`，Markdown 原文声明 `X-Robots-Tag: noindex`，同时不进入 sitemap、`llms.txt` 或详情页 JSON-LD；页面仍可直达，文章列表、订阅和摄影集合不因此隐藏。当前只有语法测试页显式设置为 `true`，索引规则不再根据 `test` 目录名判断。不要用 robots.txt 禁止抓取这些页面，否则搜索引擎无法读取索引声明。

`showHeader` 默认为 `true`。设为 `false` 时隐藏自动生成的标题、日期、地点、标签和摘要，但这些数据仍用于 SEO。封面、正文和目录保持原有行为。关于页、朋友们页面和测试页填写完整标题与摘要，再通过这个开关保持当前正文起始布局；不需要为它们补造发布日期。

两个字段只接受 YAML 布尔值，字符串 `"false"`、空值和其他类型会使读取、内容校验或响应头生成失败。共享解析位于 `lib/post-options.ts`。常规新文章模板省略这两个默认开关；完整字段说明见 [内容集合维护](./content-collections.md)。

## SEO 与 AI 阅读

首页、文章、摄影、项目和详情页各自提供标题、描述、canonical、Open Graph 与 Twitter 元数据。页面规范网址统一为 `https://rainey.space/` 下带尾斜杠的 HTML 地址；`/articles/?tag=摄影` 等筛选链接的 canonical 始终是 `/articles/`，不额外生成标签索引页。聚合页不声明无法确认的 `lastmod`。

首页提供 `WebSite` 与 `Person`，允许索引的普通内容提供 `BlogPosting`（包括隐藏内容），频道页提供 `CollectionPage` 与 `ItemList`，关于页提供 `AboutPage`，朋友们页面提供与当前友链一致的 `CollectionPage`。`noindex: true` 的详情页不输出 JSON-LD。详情页标题与摘要统一读取 Markdown，包括关于页和朋友们页面；作者身份和已公开的个人资料链接来自 `lib/config.ts`。结构化数据只使用实际内容，有明确封面时才声明文章图片。JSON-LD 统一转义 `<`，防止内容中的 `</script>` 结束脚本元素。

每页都提供 RSS/Atom 自动发现链接，详情页额外声明 `text/markdown` 替代格式。源文件仍是 `public/<slug>/index.md`，构建时发布为 `/<slug>.md`，不维护第二份源文件。发布稿会把 `./cover.webp` 这类相对资源改写成 `/<slug>/cover.webp`，让根路径 Markdown 对搜索引擎和 AI 抓取仍能解析图片；源文件继续使用相对路径。构建后删除 `out/<slug>/index.md`，避免同一篇文章出现两份公开 Markdown。

`pnpm build` 完成静态导出与 Markdown 发布后，`postbuild` 步骤运行 `scripts/generate-headers.ts`，根据站点 URL 与原文元数据完整生成 `out/_headers`：为 `/<slug>.md` 提供 `Content-Type: text/markdown; charset=utf-8` 和指向 HTML 页的 canonical Link，为标记内容添加 `X-Robots-Tag: noindex`，并生成图片长期缓存及页面校验规则。删除内容或取消标记后，下一次构建会移除旧规则；生成失败会使构建失败。不要维护第二份手写 `public/_headers`。变更站点域名后重新构建并运行 SEO 校验即可；普通本地静态服务器不会解释 `_headers`。

`/llms.txt` 在构建时从允许索引的内容生成站点导航、标题、摘要、日期和 Markdown 链接，并提供 HTML 原文链接供引用。没有日期时省略日期，不产生空日期标点或当前时间；sitemap 同样省略无法确定的 `lastmod`。它只是机器阅读的便利入口，不保证排名或 AI 引用量提升；[Google 的 AI 搜索功能仍遵循基础 SEO 要求](https://developers.google.com/search/docs/appearance/ai-features)。

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

封面和正文统一遵循“默认显示缩略图，点击查看原图”。Markdown 继续引用原图，例如 `./photo.jpg`。构建和本地开发前会生成 320、640、960 像素宽及最大展示尺寸的 WebP，最大边长不超过 1600，不放大小图。原图逐字节复制，原图副本与各尺寸预览分别根据实际文件内容生成 SHA-256 路径：`/_optimized/images/<hash>/<filename>`。输出文件保留原始扩展名，避免同名 JPG/PNG 冲突；`public/_optimized/manifest.json` 以原有图片路径为键，记录版本化原图 URL、宽高、展示图和 `srcset`。

正文、封面和摄影列表通过 `srcset`/`sizes` 按屏幕选择压缩图；正文还声明宽高，提前预留版面。灯箱底栏使用缩略图，主预览及后台预热使用版本化原图 URL。EXIF 方向在生成预览时纠正，原图与 Live Photo 视频保留不变；动图只生成原样副本，避免丢失动画。远程图片沿用其原 URL，不在构建时下载。整个 `_optimized` 目录都是构建产物，不要提交到 git。修改图片后重新运行优化命令；脚本会清理已经不再引用的派生文件。原有 `/<slug>/photo.jpg` 链接继续可访问，公开 Markdown 的资源路径也保持该格式。

`/_optimized/images/*` 使用 `Cache-Control: public, max-age=31536000, immutable`，浏览器可在一年有效期内复用缓存。同名图片内容发生变化时自动生成新 URL；只改文件时间或重复构建不会改变 URL。构建缓存按源文件内容和图片处理工具链校验，缺失或损坏的派生文件会重新生成。哈希始终来自输出字节，即使工具链变化后重新处理，也不会把不同内容发布到同一个长期缓存 URL。

HTML 页面、Next.js 导航数据（`.txt`）、Markdown、XML 和图片 manifest 使用 `Cache-Control: no-cache`，允许存储，但再次请求时需校验，从而获取最新图片地址。一年缓存仅覆盖版本化图片目录；未经过图片管线的文件、原有图片地址及 Live Photo 视频不追加该规则。缓存配置在重新部署后生效，本地可用 `wrangler pages dev out` 验证实际响应头。浏览器仍可能主动回收图片缓存；已打开的旧页面或浏览器历史快照可能继续显示当时版本，重新加载页面可获取新版本。

打开灯箱时，已加载的缩略图通过独立图层等比展开，入场与遮罩渐变持续 280ms；无法取得来源图片或有效几何时使用 150ms 淡入。原图并行加载，点击时的 `currentSrc` 继续作为后备预览，避免切换展示文件时出现空白。预览图保持原有清晰度和亮度，原图加载并解码成功后以 300ms 淡入，缓存命中时直接显示。

入场结束后，若原图仍未就绪，图片区域底部使用深色细描边圆角卡片：左侧为环形加载动画，右侧第一行显示“加载中”和真实百分比，第二行显示“已下载 / 总大小”（十进制 KB/MB，已下载量与总大小使用同一单位）。同源原图通过共享 Fetch 流累计已接收字节，最多约每 100ms 更新一次；总大小来自未编码响应的 Content-Length，缺失或不可靠时仅显示已下载量，不估算百分比。下载完成、解码尚未结束时显示“解码中”；失败时保留可用预览并改为“原图加载失败”。远程图片继续使用原生图片加载，不要求额外 CORS 权限，只显示不定进度提示。提示不拦截手势，切图、关闭或窗口变化会清理入场动画。Live Photo 在入场结束后播放，减少动态效果模式下跳过入场与加载动画。维护灯箱时应同时检查慢网连续切图、裁剪与旋转缩略图、加载失败、缓存命中和关闭后的焦点恢复。

原图预加载由 `lib/image-preloader.ts` 统一调度，通过 `useImagePreloading` 自动登记本页所有灯箱中的封面、正文和摄影图片；相同 URL 去重，不预热 Live Photo 视频。页面 `load` 后利用 `requestIdleCallback` 逐张预热，缺少该 API 时回退到 500ms 定时调度。打开灯箱后，当前原图立即以高优先级请求，不等待后台队列；其加载、解码结束后，依次预热下一张、上一张、同组其余图片，再继续本页其他图片。相邻滑动页先显示预览，原图完成预热后才挂载，避免绕开调度重复发起后台请求。

全页最多同时进行一个后台原图请求，同源原图使用 Fetch 的 `priority="low"`，主动打开的原图以 `high` 发起。当前图仍在加载时不启动新的后台任务；已有的一次下载可完成，若它正是新打开的图片则共享该请求及进度，不重复下载。Fetch 发出后无法动态提升优先级，保留已有下载；远程图片沿用原生 Image 的优先级提示。蜂窝网络或有效速度为 `3g` 时仅预热前后各一张，`Save-Data`、`2g` 和 `slow-2g` 时关闭后台预热；不支持网络信息 API 时沿用单请求队列。页面隐藏或离线时暂停新增后台请求，恢复后继续。切换路由会移除旧页面队列并取消不再使用的任务；失败原图不自动循环重试，用户实际打开时仍可重新请求。同源下载继续使用浏览器 HTTP 缓存，完成后以临时 Blob URL 供灯箱解码和显示，避免再请求一次原图。预热和灯箱按 URL 共享下载，最后一个使用者离开时中止未完成请求并撤销 Blob URL；仅正在使用的图片保留 Blob，不长期缓存整组文件。远程预热完成后释放临时 Image 引用。缓存可能被浏览器回收，原有加载提示仍作为兜底。

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
- `noindex` 和 `showHeader` 是否为布尔值
- 本地封面文件是否存在
- Markdown 本地图片是否存在
- 项目／友链注册表必填字段、日期、网址、图标路径、重复网址和空注册表
- Markdown 中已声明的 `project:` / `friend:` 标记是否格式正确、ID 是否存在

缺失图片以当次校验输出为准，发布前应逐项检查 warning。

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
pnpm verify
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
- `_headers`（构建后自动生成的 Markdown canonical、索引及缓存响应头）

`pnpm test:seo` 检查日期、元数据和结构化数据序列化，通过临时 Markdown 覆盖 `hidden/noindex` 四种组合、新字段默认值与非法类型、非测试页的索引声明、重命名或删除后的响应头清理，以及图片长期缓存和页面校验的匹配范围。`pnpm validate:seo` 读取 `out/`，检查页面元数据、JSON-LD、静态正文、自动页头与封面、sitemap、feed、Markdown 原文、llms.txt 链接及完整 `_headers` 索引规则；运行前必须完成当前版本的 `pnpm build`。这些脚本由 Node.js 原生执行 TypeScript，不引入浏览器端依赖。

`pnpm verify` 依次执行路由类型生成、两套严格类型检查、ESLint、内容校验、注册表与 Markdown 数据标记测试、SEO 测试、图片管线及预加载调度测试、脚本 CLI 测试、完整构建、SEO 产物校验和图片产物校验。图片测试覆盖缩略图、方向、小图、动图、原图保留、哈希稳定性、同名替换、构建缓存修复、派生文件清理，以及下载字节进度、总大小缺失、流失败、共享请求与 Blob 释放、预加载优先级、并发去重、网络策略、后台暂停和路由清理；产物校验检查静态内链、测试页 noindex、文件内容与哈希的一致性、版本化原图字节、图片候选尺寸、正文占位尺寸、封面灯箱入口及缓存响应头。

`pnpm test:scripts` 验证原生 TypeScript 入口在临时工作目录下的新建文章、Markdown 导出、响应头生成，以及重复文章、无效引用、损坏图片和缺失产物的失败退出。

`pnpm deploy:cf` 和 GitHub Actions 共用 `pnpm verify`，任一步失败都会停止部署。CI 通过 mise-action 读取仓库 `mise.toml` 安装 Node.js 和 pnpm，与本地使用同一版本来源。验证成功后才通过 Wrangler 或现有 Pages action 部署 `out/` 到 Cloudflare Pages。

### 上线核查

发布后检查首页、一个频道页和一篇文章，以及 `/robots.txt`、`/sitemap.xml`、`/llms.txt` 的 HTTP 状态和内容；确认文章 Markdown 返回 `text/markdown`，HTTP `Link` 指向同一篇 HTML canonical。检查最终 `robots.txt` 中托管规则与源码规则的合并结果。

另外检查 `/test/` 的 robots meta、`/test.md` 的 `X-Robots-Tag` 和 canonical Link 同时生效；按当前元数据，关于页和图集不应带 noindex。用手机与桌面浏览器检查封面、正文和摄影缩略图，点击后应显示原图或加载提示，关闭灯箱后应恢复焦点。检查页面空闲预热、同组优先、慢网连续切图、隐藏页面暂停及省流量模式下仍能正常打开原图。图片候选和缓存命中以浏览器 `currentSrc` 和实际网络请求为准。

核对版本化原图和预览图的线上响应包含一年 `max-age` 与 `immutable`，HTML 及 `.txt` 导航数据为 `no-cache`；域名级 Cloudflare Cache Rules 或 Browser Cache TTL 也可能影响最终响应，以部署后的实际响应头为准。同名替换图片后，检查新 HTML 引用本次构建的图片 URL；输出字节变化的原图或预览图应获得新 URL。

使用 Cloudflare 安全事件或真实爬虫访问记录排查 403/挑战，确认搜索与用户读取没有被额外拦截。仅修改 User-Agent 的请求不代表真实爬虫，也不足以确认某条防火墙规则导致拦截，不据此创建宽泛白名单。通过 Google Search Console、Bing Webmaster Tools 检查 sitemap 和代表性网址的抓取、索引状态；抓取允许不保证一定收录或被引用。

## 维护约定

- 首页介绍维护在根目录 `WELCOME.md`；`README.md` 仅用于 GitHub public profile，博客不再读取，不要把项目维护说明写入其中。
- 不要改变 `public/<slug>/index.md` 的文章存储方式，除非明确执行内容迁移。文章的公开 Markdown 地址是 `/<slug>.md`。
- `hidden` 控制文章列表与 feed；`noindex` 独立控制 sitemap、llms.txt 与索引声明。
- 日期展示保持 `YYYY-MM-DD`。
- 优先保持轻量个人博客风格，避免引入复杂内容系统。
