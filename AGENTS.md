# AGENTS.md

## Project Overview

This repository is a lightweight personal blog built with Next.js App Router and exported as a static site for Cloudflare Pages.

The homepage intro reads root `WELCOME.md`. `README.md` is used only for the GitHub profile; the blog does not read it. Do not edit `README.md` for blog maintenance notes, agent instructions, or implementation summaries.

## Architecture

- `app/` contains Next.js routes and shared layout.
- `app/page.tsx` renders the public homepage list.
- `app/[slug]/page.tsx` renders each Markdown post.
- `app/rss.xml/route.ts` and `app/atom.xml/route.ts` generate feeds.
- `app/sitemap.xml/route.ts` and `app/robots.txt/route.ts` generate SEO metadata files.
- `lib/config.ts` contains site metadata such as `siteUrl`, author, avatar, and title.
- `lib/posts.ts` renders document bodies, images, article views and feeds. `lib/content-index.ts` reads all Markdown metadata before extracting relationships, without recursive rendering. `lib/entity-metadata.ts` centralizes metadata validation; `lib/post-options.ts` and `lib/post-dates.ts` share option/date rules.
- Every entity is a `public/<slug>/index.md` document with `type: article | project | friend | contact`. `lib/entities.ts` defines shared attributes and article-only flags. `lib/markdown-refs.ts` resolves ordinary internal links; `lib/content-paths.ts` shares routes, reserved slugs and asset paths. There are no JSON entity registries.
- `lib/entity-rendering.ts` is the single HTML renderer for React `Entity` / `EntityList` and Markdown references. Public render functions dispatch through `getEntityPresentation(type)` with default templates and exhaustive type overrides; keep concrete templates internal. `EntityRenderOptions` separates card and inline parameters. `EntityDetail` / `EntityHeader` share detail presentation while the route handles content, SEO and redirects; see `docs/entity-rendering-design.md`.
- `Entity` renders HTML on the page's server side; `EntityContent` is the client interaction boundary and only receives HTML. Do not serialize complete `Post` bodies and image lists into client card props.
- `public/<slug>/index.md` is the source format for posts. The same directory holds referenced assets.
- `scripts/` contains local maintenance scripts.

## Content Model

Documents are directories under `public/` with an `index.md` file. A public article includes:

```yaml
---
type: article
title: Post title
date: YYYY-MM-DD
summary: Short summary
tags: []
---
```

Full attribute meanings and rendering rules are in `docs/entities.md`; photography and tag vocabulary are in `docs/content-collections.md`. The directory slug is the identity: do not add metadata `id`, `slug`, `order`, `related`, `description` or `extensions`. All types require `type` and `title`; non-article bodies may be empty. `summary` is the shared description; optional `name` defaults to `title` and is only needed for a distinct short name. Retain `keywords` for SEO independently of visible tags. Unknown fields are errors.

Articles alone support `hidden` and `pinned`. `hidden: true` excludes articles from article lists, tag counts and RSS/Atom; it does not affect access, references, photography or indexing. About, license and test use hidden articles; there is no `page` type. Public articles require `date` and `summary`; hidden articles and other entities may omit dates. Never invent dates from filesystem timestamps.

`noindex` defaults to false; effective indexing exclusion is `noindex || redirect`, applied to HTML, Markdown headers, sitemap, llms.txt and JSON-LD. It does not exclude entities from lists, photos or references. `showHeader` defaults to true and only hides the generated header, leaving cover, body, TOC and relationships. Boolean metadata requires actual YAML booleans.

`url` is an optional HTTP(S) destination; contacts require it and also support mailto. `redirect: true` requires HTTP(S) and redirects the entity HTML route; Markdown and assets remain accessible. New/old collection routes are reserved. Collections use `/article/`, `/project/`, `/friend/`, `/contact/`; old plurals have generated 301 redirects. Entity cards use the local slug, while homepage footer contacts explicitly use their contact URL.

`icon` is an HTTPS URL or site-absolute public path for small graphics. `cover` is optional, preferably a document-relative asset. It appears in details, sharing and hover previews, never in lists. All four types share the default `popover` standard card. With a cover, the preview is 320px wide (clamped to the viewport), with a full-width 16:9 cover capped at 180px high above a padded title and summary, each limited to two lines. Without a cover or on cover load failure, it uses compact 48px media on the left and single-line text on the right. Media falls back to the icon, then the title initial. Covers crop to fill; icons preserve their proportions. Article list cards keep their text layout. The content index supplies derived `coverImage` variants for optimized previews; responsive sizes match the preview width. Missing cover uses the site sharing image for SEO only, never a body-image fallback. Keep local resources beside the document.

Ordinary Markdown links to an entity create references. Inline links preserve author labels and show previews; sole text links in top-level paragraphs expand entities to cards or collections to lists. Query/hash/Markdown-file links keep navigation semantics. Extract references from original Markdown before expansion; deduplicate and ignore self-links. Include hidden/noindex/redirect documents; exclude WELCOME.md, code, image tokens and generated chrome. Expanding a collection does not create edges to members.

Photography is an image-level title marker: `![Description](./photo.jpg "photography")`. Marked images require local relative paths within the document and nonempty alt. Deduplicate per document/path, including when only a later occurrence is marked. The photography page is a flat grid. Sort by EXIF capture time, falling back to document date, then source slug/body order; no article pinning. The homepage shows the first six. Preserve EXIF, image optimization and same-name `.mov` / `.MOV` Live Photo behavior. Old albums are hidden articles with no cover or document-level photography field; retain their images.

The public Markdown URL is `/<slug>.md`. Build publishes it from `index.md`, rewrites relative assets including titled/reference images, expands collection links to Markdown lists, and removes `out/<slug>/index.md`. Source paths stay relative. Do not maintain a second source file.

## Implementation Rules

- Preserve the current static export model in `next.config.ts`.
- Do not add a CMS, database, server runtime dependency, or dynamic hosting requirement unless explicitly requested.
- Keep article filtering based on `type === article && !hidden`; entity collections use type and photography uses image markers. Membership never depends on references.
- Keep date display stable as `YYYY-MM-DD`.
- Keep tags optional; when assigning them, follow the vocabulary in `docs/content-collections.md`.
- Articles use pinned first then date descending. Other entities use date descending, missing dates last, ties by slug. Feeds remain strictly date-ordered. Photography uses its capture-time ordering.
- Keep the visual style lightweight and personal; avoid broad redesigns unless explicitly requested.
- Tailwind CSS 4 uses `@tailwindcss/postcss` and explicitly loads `tailwind.config.ts` from `app/globals.css`. Keep element defaults in `@layer base` so utilities can override them. Preserve photography `transform` matrices used by lightbox opening geometry.
- Do not move Markdown posts out of `public/<slug>/index.md` without an explicit migration request.

## TypeScript and Runtime

- Use Node.js 24.21.0 and pnpm 10.33.0 from `mise.toml`; use `mise exec -- pnpm <command>` if mise is not activated.
- The package is ESM. All owned shared modules, scripts and tests are TypeScript. Relative imports in `lib/` and `scripts/` include `.ts`; `@/*` is for Next.js application code.
- Node executes scripts natively without type checking or custom loaders. Keep shared code erasable (no enums or constructor parameter properties).
- Resolve script locations with `import.meta.url`; resolve content and output from `process.cwd()`.
- `pnpm typecheck` generates Next route types and checks both the application and NodeNext script configuration. Keep both strict and keep generated Next type files untracked.
- Only `eslint.config.mjs` and `postcss.config.mjs` remain JavaScript configuration files. Keep ESLint separate from the Next.js build.

## Commands

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm verify
pnpm build
pnpm validate:content
pnpm optimize:images
pnpm new-post <slug> [title]
pnpm deploy:cf
```

`pnpm build` is the primary verification command. The deployed artifact is `out/`. Its `postbuild` step generates `out/_headers` and `out/_redirects` from content metadata. Do not maintain handwritten public copies. Entity 302 rules match only the exact HTML paths; never redirect assets or `.md`. A failed header-generation step must fail the build.

`pnpm validate:content` should pass before shipping. Warnings about missing local images should be investigated but are not currently fatal.

## Known Notes

- `README.md` is the user's GitHub public profile and should remain untouched.
- The current static site target is Cloudflare Pages.
- Investigate missing-image warnings from the current validator output; photography missing assets are fatal.

Contacts are Markdown entities with `type: contact`. Official icon assets remain in `public/assets/contacts/`; provenance is documented in `docs/entities.md`. Homepage contact actions directly use `url`; the `/contact/` collection and references use local entity details.
