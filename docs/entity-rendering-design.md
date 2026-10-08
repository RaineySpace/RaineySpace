# 实体渲染形态与组件映射

状态：已实施。

实体展示使用“默认渲染器 + 类型覆盖”。React 页面、Markdown 引用、集合成员和悬浮预览共用纯 TypeScript HTML 渲染器；详情页使用共享 React 组件。实体属性和内容约定见 [文档即实体](./entities.md)。

## 六种展示形态

| 形态 | 用途 | 实现 |
|---|---|---|
| 行内文字 | 正文中的实体链接 | 行内模板的 `text` 外观 |
| 名称标记 | 紧凑名称，可带图标，例如首页朋友 | 行内模板的 `chip` 外观 |
| 纯图标 | 例如首页联系方式 | 行内模板的 `icon` 外观，保留无障碍名称 |
| 独立卡片 | 列表项、独占段落的实体引用、关联区域 | 按类型选择卡片模板 |
| 悬浮卡片 | 行内链接的预览 | 共享悬浮容器与标准卡片模板，有封面时上图下文，否则左图右文 |
| 详情页 | `/<slug>/` | 共享详情结构、头部、封面、正文、目录和关联区域 |

前三种形态属于同一行内模板。悬浮卡片是卡片的使用场景，由 `popover` 配置选择已有模板及封面、图标策略。集合负责排列和筛选多个实体，`redirect` 负责详情访问行为。摄影仍由图片视图处理，不属于实体类型或实体渲染形态。

## 每种实体的渲染映射

表中 `DefaultInline`、`StandardCard`、`ArticleCard` 是 [entity-rendering.ts](../lib/entity-rendering.ts) 内部 HTML 模板的短名，分别对应 `renderDefaultEntityInlineHtml`、`renderStandardEntityCardHtml`、`renderArticleCardHtml`。它们不作为独立 React 组件使用。

| 形态 | `article` | `project` | `friend` | `contact` |
|---|---|---|---|---|
| 行内文字 | `DefaultInline(text)` | `DefaultInline(text)` | `DefaultInline(text)` | `DefaultInline(text)` |
| 名称标记 | `DefaultInline(chip)` | `DefaultInline(chip)` | `DefaultInline(chip)` | `DefaultInline(chip)` |
| 纯图标 | `DefaultInline(icon)` | `DefaultInline(icon)` | `DefaultInline(icon)` | `DefaultInline(icon)` |
| 独立卡片 | `ArticleCard` | `StandardCard` | `StandardCard` | `StandardCard` |
| 悬浮卡片 | 共享容器 + `StandardCard` | 共享容器 + `StandardCard` | 共享容器 + `StandardCard` | 共享容器 + `StandardCard` |
| 详情页 | `EntityDetail` + `EntityHeader` | `EntityDetail` + `EntityHeader` | `EntityDetail` + `EntityHeader` | `EntityDetail` + `EntityHeader` |

文章列表和独立卡片显示标题、日期、标签、摘要，不显示图标和封面。标准独立卡片显示图标、标题、简介，支持关闭图标，缺图标或加载失败时显示标题首字。

四种实体的悬浮预览共用标准卡片和默认配置，不显示日期和标签。有 cover 时使用 320px 宽的上图下文布局，宽度受视口两侧各 20px 留白约束；顶部通栏封面按 16:9 裁切填满，最大高度 180px，下方文字区内边距 14px，标题与简介各最多两行。没有 cover 或图片加载失败时，恢复左侧 48px 图标、右侧标题与简介各一行的紧凑布局，图标保持比例，缺失或加载失败时显示标题首字。布局根据未隐藏的封面元素切换，沿用现有加载失败处理和 ResizeObserver 定位，不增加实体字段或独立模板。

封面使用懒加载和已有响应式优化图片，`sizes` 与卡片的实际宽度一致，缺少 `srcSet` 时优先使用展示图；不从正文取首图，不进入灯箱。浮层使用主题表面色和细微内描边，封面保留原色。自动行内名称使用 `name`；作者正文链接保留原有文字和格式；卡片和详情使用 `title`。

悬浮模板使用 `root: 'span'`，标题、简介、容器均为适合行内位置的结构，不能把块级卡片直接插入正文段落。悬浮预览不会再次嵌套生成悬浮链接。

四种详情共用已有属性和结构，只有文章关闭头部图标；`showHeader: false` 仍保留封面。任意类型启用 `redirect` 后，详情路由先进入 `EntityRedirect`，不影响卡片、引用或集合成员资格。

## 类型配置与扩展方式

默认配置、类型覆盖表和解析函数都在共享渲染器中：

- `defaultEntityPresentation`：默认行内模板、标准卡片模板、悬浮展示和头部图标策略。
- `entityPresentationByType`：覆盖全部 `EntityType` 的类型表，仅填写差异及操作文案。
- `getEntityPresentation(type)`：合并默认值和类型差异，`header`、`popover` 按字段合并，返回完整展示配置；所有类型默认使用同一个悬浮模板，不随独立卡片覆盖改变。

| 类型 | 卡片覆盖 | 悬浮覆盖 | 头部图标 | 卡片操作文案 | 详情网址文案 |
|---|---|---|---|---|---|
| `article` | `renderArticleCardHtml` | 使用默认 | 不显示 | 阅读文章 | 相关链接 |
| `project` | 使用默认 | 使用默认 | 有图标才显示 | 访问项目 | 沿用卡片操作文案 |
| `friend` | 使用默认 | 使用默认 | 有图标才显示 | 访问站点 | 沿用卡片操作文案 |
| `contact` | 使用默认 | 使用默认 | 有图标才显示 | 联系我 | 沿用卡片操作文案 |

修改某类实体的独立卡片可覆盖 `card`；悬浮卡片统一复用 `defaultEntityPresentation.popover`，目前没有类型特例。未来确有特殊展示需要时，仍可通过 `popover.card`、`showIcon`、`showCover` 覆盖。`cardLink` 控制卡片导航策略，文章固定使用本地实体地址，其余类型遵循调用方导航参数。修改行内结构只覆盖 `inline`，仍须保留作者链接信息和共享悬浮行为。纯粹的文字、图标显示差异使用配置，不复制模板。详情目前只有配置差异，没有完整详情模板注册机制。

`coverImage` 是内容索引从现有图片 manifest 提取的派生数据，不是 metadata 属性；不包含构建指纹。封面相对路径始终基于所属实体 slug 解析，共享渲染器仍不读取文件系统。

类型表由 `Record<EntityType, EntityPresentationOverride>` 检查完整性，未知类型仍由 metadata 校验拒绝。新增实体类型还需要同步数据类型、metadata 校验、集合和路由约定，渲染映射不替代内容模型扩展。

## 组件与调用边界

| 文件或组件 | 职责 |
|---|---|
| [entity-rendering.ts](../lib/entity-rendering.ts) | 三个公共分派入口：`renderEntityHtml`、`renderEntityInlineHtml`、`renderEntityCardHtml`；内部模板不单独导出 |
| [Entity](../app/components/Entity.tsx) | 唯一 React 单实体入口，在页面服务端调用 `renderEntityHtml`；首页文章及文章集合也使用它 |
| [EntityContent](../app/components/EntityContent.tsx) | 客户端只接收生成的 HTML 并接入实体交互，不选择类型模板，不接收文章正文、图片列表等完整数据 |
| [EntityList](../app/components/EntityList.tsx) | 空状态、行内或卡片排列，逐项调用 `Entity` |
| [ArticleList](../app/article/ArticleList.tsx) | 文章标签筛选、折叠和 URL 参数，接收统一入口生成的卡片 |
| [HoverCardList](../app/components/HoverCardList.tsx) | 列表中跟随鼠标的背景高亮，不是悬浮预览容器 |
| [markdown-refs.ts](../lib/markdown-refs.ts) | 识别普通内链并调用同一分派入口；关系在展开前提取 |
| [MarkdownContent](../app/components/MarkdownContent.tsx) | 正文 HTML、实体交互、图片和灯箱 |
| [useEntityPopovers](../app/components/useEntityPopovers.ts) | 悬浮定位、鼠标、键盘、触控和关闭行为，不选择模板 |
| [EntityDetail](../app/components/EntityDetail.tsx) | 接收派生的 `Post` 数据，组织目录、头部、正文和双向关联，不加载内容 |
| [EntityHeader](../app/components/EntityHeader.tsx) | 自动头部及封面，读取类型映射中的图标策略和网址文案 |
| [详情路由](../app/[slug]/page.tsx) | 数据加载、静态参数、SEO、JSON-LD 和跳转 |

共享 HTML 渲染器没有 React、文件系统或浏览器依赖，供 React 与原生 Node 构建脚本调用。React 详情组件可以读取展示配置；共享渲染器不能导入详情组件，也不能把含模板函数的配置对象通过服务端到客户端的 props 传递。

React 卡片列表使用 `HoverCardList`，Markdown 集合展开使用 `.entity-card-list`。它们共用卡片模板，仍保留各自已有的列表容器和背景效果。

## 参数与默认行为

[entities.ts](../lib/entities.ts) 定义按形态区分的 `EntityRenderOptions`，`Entity` 和 `EntityList` 共用该联合类型。

| 参数组 | 属性与默认值 |
|---|---|
| 卡片 | `variant?: 'card'`，`headingLevel` 默认 `h3`，`showIcon` 默认 true；文章固定使用无图标模板 |
| 行内 | `variant: 'inline'`，`appearance` 默认 text，`size` 可选 sm/md/lg，`showIcon` 默认 false |
| 行内悬浮 | `hoverCard` 默认 true，`popoverShowIcon` 默认 true；关闭时隐藏图标及首字占位，但仍可显示封面。`placement` 默认 auto，可设 top |
| 导航 | `external`、`newTab` 默认 false；公共导航逻辑处理链接属性，文章卡片固定使用本站地址 |
| 内部上下文 | `root` 以及作者提供的 HTML/href 仅供 HTML 渲染入口使用，不是 React 展示参数；封面策略由映射传给内部模板 |

卡片模式不能传 `appearance`、`size`、`hoverCard`、`popoverShowIcon`、`placement`；行内模式不能传 `headingLevel`，错误组合由类型检查拒绝。图标外观总是显示图标或首字占位，并使用 `name` 作为无障碍名称。

```tsx
<Entity item={article} headingLevel="h2" />
<EntityList items={projects} showIcon />
<EntityList items={friends} variant="inline" appearance="chip" showIcon placement="top" />
<EntityList items={contacts} variant="inline" appearance="icon" size="sm" external newTab />
```

首页文章和集合页显式使用 `h2`，嵌入卡片和关联区域默认 `h3`，悬浮内容使用 `span`。默认链接本站实体；只有明确的联系动作使用 `url`。HTTP(S) 联系动作可打开新窗口，`mailto:` 不设置新窗口；跳转实体的本地链接保留绕过页面过渡的标记。作者链接中的 query、hash、`.md` 地址保留。

## 验证与维护

`scripts/entities.test.ts` 和 `scripts/markdown-refs.test.ts` 验证默认与覆盖选择、三种行内外观、悬浮模板复用、合法行内结构、图标降级、作者文字和导航；`scripts/entity-rendering.typecheck.ts` 检查无效参数组合不能通过类型检查。

修改渲染后执行 `mise exec -- pnpm verify`，并通过本地预览核对首页、集合、详情、Markdown 引用、键盘与触控行为。正文、集合筛选和排序、关系提取、SEO、订阅及公开 Markdown 仍由各自模块负责，不能由卡片模板决定。
