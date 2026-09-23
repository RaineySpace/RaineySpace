# Entity 数据与渲染

项目、友链和联系方式分别存放在 `content/projects.json`、`content/friends.json`、`content/contacts.json`，使用同一份 `EntityDefinition`。对象 key 是稳定 ID，文件决定 `kind`，无需在每条记录重复填写。

```json
{
  "example": {
    "name": "显示名称",
    "title": "可选的完整站点或产品标题",
    "url": "https://example.com/",
    "date": "2026-09-23",
    "description": "可选简介",
    "icon": "https://example.com/icon.png",
    "pinned": false,
    "extensions": {
      "repository": "https://github.com/example/project"
    }
  }
}
```

`name`、`url`、`date` 必填；其余字段可省略。`title` 提供时必须是非空字符串。行内使用 `name`，卡片、集合 JSON-LD 和块级 Markdown 导出使用 `title ?? name`。项目原来的 `cover` 已迁移为 `icon`，不再保留别名；文章 frontmatter 的 `cover` 不受影响。`icon` 支持 HTTPS URL 或站点绝对路径，本地文件由内容校验器检查。

`lib/registry.ts` 负责统一校验和排序。加载后的 `Entity` 增加 `id`、`kind`、解析后的 `date` 和 `dateText`；`pinned` 默认 `false`，`extensions` 默认 `{}`。`getProjects()`、`getFriends()`、`getContacts()` 直接返回这份结构，没有 `cover → image → icon` 的转换。排序维持置顶优先、日期倒序、ID 升序。

项目和友链的 `url` 仅接受 HTTP(S)；联系方式还支持单个邮箱的 `mailto:` 链接，可附带 URL 编码的 `subject`、`body` 等查询参数。例如 `"url": "mailto:raineyspace@gmail.com"`，不要在 JSON 值中嵌套 Markdown 链接。邮箱链接在行内、列表卡片、悬浮卡片及 Markdown 导出中使用同一地址，不设置新标签页属性，由浏览器调用邮件应用。

## 各类扩展

`extensions` 是每条 Entity 自己的 JSON 对象，允许字符串、有限数字、布尔值、null、数组和嵌套对象。它不会覆盖公共字段，也不会自动进入卡片、Markdown、摘要或 SEO 文本；它不是存放私密数据的区域。

`lib/entities.ts` 中的 `ProjectExtensions`、`FriendExtensions` 和 `ContactExtensions` 独立定义各自的类型，通过 `EntityExtensionsByKind` 关联。例如，后续真正需要项目仓库地址时，可以为 `ProjectExtensions` 增加 `repository?: string`，再在使用该字段的功能中验证其业务约束。友链可以独立定义自己的 RSS 等字段。当前仅提供扩展容器，不虚构现有数据没有的业务字段。

顶层未知字段仍然报错，以便及时发现 `icon` 等公共字段的拼写错误；专属属性放进 `extensions`。

## 统一组件

单项使用 `app/components/Entity.tsx`，集合使用 `EntityList.tsx`。二者接收同一种 Entity，可混合项目、友链与联系方式；列表 key 使用 `kind:id`。不再为项目和朋友各维护一套卡片或列表适配器。

| 参数 | 默认值 | 行为 |
| --- | --- | --- |
| `variant` | `card` | `inline` 为行内链接，`card` 为列表卡片 |
| `appearance` | `text` | 行内文字链接，保留箭头；`chip` 为无下划线的圆角链接，显示名称；`icon` 为仅图标的圆角链接，不显示名称；`chip` 和 `icon` 均不显示箭头，保留悬停背景 |
| `size` | 行内 `lg` | 仅在 `inline` 模式生效：`sm` / `md` / `lg` 的图标分别为 16 / 20 / 24px，圆角链接内边距四边均为 `6px`；普通文字链接保留正文样式；卡片模式忽略该属性 |
| `showIcon` | 行内 `false`、卡片 `true` | 是否显示图标；关闭时也不显示占位；`appearance="icon"` 始终显示图标 |
| `hoverCard` | `true` | 行内链接有效鼠标悬停或键盘 focus-visible 时是否出现详情卡片 |
| `popoverShowIcon` | `true` | 独立控制悬浮卡片里的图标 |
| `placement` | `auto` | `top` 固定上方，`auto` 根据空间上下避让；均水平避让 |
| `headingLevel` | `h3` | 块级卡片支持 `h2` / `h3`；行内浮层只用 span |
| `newTab` | `true` | 是否在新标签页访问；Markdown 行内引用沿用当前页打开；`mailto:` 链接始终不设置新标签页属性 |

```tsx
// 首页：图标 + 名称，圆角悬停背景，上方详情卡片。
<EntityList items={projects} variant="inline" appearance="chip" showIcon placement="top" />

// 仅图标，保留悬停背景；使用 aria-label 提供链接名称。
<EntityList items={contacts} variant="inline" appearance="icon" size="sm" hoverCard={false} />

// 普通行内引用，不显示图标，悬浮卡片仍显示图标。
<Entity item={friend} variant="inline" />

// 无图标、无悬浮卡片的文字链接。
<Entity item={project} variant="inline" showIcon={false} hoverCard={false} />

// 无图标的集合卡片。
<EntityList items={friends} showIcon={false} headingLevel="h2" />
```

行内圆角链接默认图标 24px、6px 圆角矩形；链接本身为 8px 圆角，内边距四边固定为 6px，仅有效鼠标悬停时增加背景并改变文字颜色；键盘使用可见轮廓，不增加背景。`chip` 保留名称，`icon` 仅显示图标，两者均不显示箭头；只有 `text` 保留箭头及其动效。集合卡片及悬浮卡片固定使用 48px 图标、12px 圆角矩形与 12px 内边距，不受 `size` 影响。图标容器不添加背景。缺少图标或加载失败时显示名称首字；请求隐藏图标则不保留图标空间。

`public/assets/contacts/` 下的联系方式 SVG 使用黑白单色图形，通过共享 `--contact-icon-filter` 在暗色主题中反色，保留即刻图标等黑白组合的内部结构。列表卡片、首页页脚、行内图标和悬浮卡片统一适配，跟随 `html[data-theme]` 支持系统外观与手动切换；无脚本时使用系统配色回退。该规则仅匹配此目录中的 SVG，彩色项目图标、朋友头像和其他图片保持原色。

## Markdown 与页面共用渲染

`lib/entity-rendering.ts` 是唯一 Entity HTML 模板，统一名称选择、图标及占位、外链属性、浮层结构和类名。所有动态文本与属性值均转义；扩展属性不拼接到 HTML。

React 的 `Entity` 通过 `EntityContent` 挂载这份 HTML；Markdown 的 `lib/markdown-refs.ts` 使用同一渲染器。HTML 仅由内部渲染器和已有 Markdown 管线生成。`useEntityPopovers` 为页面、首页介绍和 Markdown 统一连接浮层定位，`lib/entity-chip-popovers.ts` 处理边缘避让。显示和图标失败回退不依赖第二份 React 模板。

浮层按内容自适应宽度，最大 `20rem`（当前为 320px），仅受视口左右各 20px 安全距离限制；实体列表和 Markdown 容器不限制浮层宽度或水平位置。靠近页面边缘时整体平移避让，视口不足时才缩窄。定位同时观察浮层面板尺寸，阅读字号变化时重新避让，防止隐藏面板撑宽触摸视口。

实体浮层与全站统一输入策略共用 `hoverInput`，仅 `(any-hover: hover)` 且当前鼠标操作时启用悬停；键盘 `:focus-visible` 可独立打开并进入浮层链接。手机、平板手指以及触笔直接执行链接，不增加按压背景、不打开浮层；iPad 连接鼠标时，手指操作仍遵循触摸规则。输入切换立即清除悬停效果，列表高亮只跟随鼠标。触摸、触笔及初始或失焦重置的 `none` 模式下浮层退出布局，避免隐藏面板撑宽移动视口并使原页面滚动位置上移；隐藏时不以零宽度覆盖已有定位，切回鼠标或键盘时重新测量定位。无脚本时没有输入模式属性，保留原生键盘焦点预览。

点击实体链接或悬浮卡片中的链接后，浮层立即关闭（包含键盘激活和鼠标中键）。Escape 也可关闭，焦点位于浮层链接时回到触发链接。返回原页面时保持关闭；鼠标从其他元素重新移入，或键盘从其他元素重新聚焦后，可再次显示。关闭不阻止链接跳转。无脚本时保留原生链接和键盘焦点，关闭鼠标增强。

Markdown 引用语法保持不变：独立段落生成卡片，段落内部生成带浮层的文字链接。正文行内不添加图标、胶囊背景或内边距；RSS/Atom 和公开 Markdown 仍导出普通链接、列表与简介。

修改后运行 `pnpm verify`，涵盖 schema、扩展保留、渲染组合、Markdown 一致性、静态构建、SEO 和图片校验。

## 联系方式

`contact` 复用公共 schema、排序和渲染器，当前登记博客、GitHub、B站、即刻和 X 的公开主页；`date` 为登记日期。使用 `getContactById(id)` 或 `getContacts()` 读取。 每个平台可独立填写可选的 `description`，用于说明这个渠道的内容或联系场景；描述显示在卡片和行内链接的悬浮卡片中，也进入块级 Markdown 导出，行内链接仍只显示名称。

```markdown
欢迎在 [GitHub](https://github.com/RaineySpace "contact:github") 找到我。

[全部联系方式](https://rainey.space/ "contact:*")
```

行内引用与独立段落、通配集合、RSS/Atom 及公开 Markdown 导出规则均与其他实体一致。首页 `WELCOME.md` 已使用单项引用，保留原有文字和排列顺序。当前不新增独立联系方式页面。

图标于 2026-09-23 从官方站点获取，保存在 `public/assets/contacts/`。更新图标时核实响应确实为图片；不要保存站点拦截页。

| ID | 官方图标来源 |
| --- | --- |
| blog | https://rainey.space/favicon.ico |
| github | https://github.githubassets.com/favicons/favicon.png |
| bilibili | https://space.bilibili.com/favicon.ico |
| jike | https://web.okjike.com/apple-touch-icon.png |
| x | https://x.com/favicon.ico |

## 联系我页面

`/contacts/` 通过 `lib/contacts.ts` 读取联系方式注册表，复用项目和友链的集合页布局、实体卡片及排序规则。首页页脚以仅图标模式显示联系方式，直接链接到各个渠道。独立集合页提供 metadata 和 JSON-LD，进入 sitemap 与 `llms.txt`，不进入文章列表和订阅，也不提供 `/contacts.md`。`contacts` 是保留路由，不能作为文章 slug。
