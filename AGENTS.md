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
- `lib/posts.ts` is the content data layer. Keep Markdown parsing, frontmatter normalization, date formatting, article-channel/indexable-content filtering, and feed data behavior centralized there. `lib/post-options.ts` shares `noindex` and `showHeader` parsing with maintenance scripts. `lib/registry.ts` and `lib/markdown-refs.ts` share project/friend registry reading, entry-order preservation, and Markdown data-reference expansion with pages, validation, and published Markdown export.
- `content/projects.json`, `content/friends.json`, and `content/contacts.json` share the Entity schema in `lib/entities.ts`: names, optional titles, links, dates, descriptions, `icon`, and per-kind `extensions`. `lib/registry.ts` validates and normalizes both without field adapters.
- `lib/entity-rendering.ts` is the single HTML renderer for React `Entity` / `EntityList` and Markdown references. Keep inline, card, hover-card, icon, and no-icon variants there; see `docs/entities.md`.
- `public/<slug>/index.md` is the source format for posts. The same directory holds referenced assets.
- `scripts/` contains local maintenance scripts.

## Content Model

Posts are directories under `public/` with an `index.md` file. Public posts should include:

```yaml
---
title: Post title
date: YYYY-MM-DD
summary: Short summary
tags: []
---
```

Optional collection metadata:

```yaml
location: Hangzhou
pinned: true
photography: true
cover: ./cover.webp
```

`cover` is optional. Prefer a local file in the post directory with a relative path such as `./cover.webp`. When present, the cover is used for Open Graph / Twitter sharing. For ordinary posts it also renders after the summary (or other header metadata when no summary exists) and before the body on the article page only; article lists never show covers. Photography posts keep `cover` for sharing metadata but do not render it on the album page. Posts without `cover` keep the original title-first layout and must not use body images as a fallback cover.

Use `hidden: true` to exclude content from article listings, tag statistics, and RSS/Atom. It does not affect indexing, photography, or registered project/friend membership.

`noindex` defaults to `false`. Set `noindex: true` to emit HTML `noindex, follow` and Markdown `X-Robots-Tag: noindex`, and exclude the content from sitemap, `llms.txt`, and JSON-LD. It does not prevent direct access or hide content from article/photography/project collections. Indexable hidden content belongs in sitemap and `llms.txt`; omit unavailable dates rather than inventing them.

`showHeader` defaults to `true`. Set `showHeader: false` to hide the generated title, date, location, tags, and summary while retaining those values for SEO. Covers, body content, and table of contents remain available. Both new fields require actual YAML booleans; strings and null values are invalid. Ordinary posts should omit these default options.

Projects and friends are registered in `content/projects.json` and `content/friends.json`. Registration is enough to display them; they do not need a referencing post. Display projects, friends, and contacts in their JSON registry entry order; `date` and ID do not reorder entities. Entity registries do not support `pinned`. Cite them from Markdown with standard link titles such as `"project:xiaofenshen"` or `"friend:*"`. Do not put `projectId` or other project display fields in post frontmatter.

Both registries use `name`, optional `title`, `url`, `date`, optional `description`, `icon`, and `extensions`. Inline links use `name`; cards and collection metadata use `title ?? name`. `icon` is an HTTPS URL or site-absolute public path; project `cover` is no longer accepted (article frontmatter `cover` is unchanged). Kind-specific fields belong in the JSON object `extensions`, with independent TypeScript interfaces for projects and friends. Extensions do not override shared fields or render automatically.

Local assets referenced by a post should live in the same post directory. Prefer relative paths such as `./image.png`.
The public Markdown URL is `/<slug>.md`. Build copies `public/<slug>/index.md` there, rewrites relative asset paths such as `./cover.webp` to site-absolute `/<slug>/...` URLs, and deletes the copied `out/<slug>/index.md` so it is not a second public document. Source files keep `./` paths. Do not keep a second source file at `public/<slug>.md`.
Photography images must use relative Markdown image paths with non-empty alt text.
A sibling `.mov` / `.MOV` with the same filename as a still image enables Live Photo playback; Markdown should still reference only the still.

## Implementation Rules

- Preserve the current static export model in `next.config.ts`.
- Do not add a CMS, database, server runtime dependency, or dynamic hosting requirement unless explicitly requested.
- Keep article-channel filtering based on `hidden`; photography membership is independent of `hidden`. Registered projects and friends are shown from their registries and do not depend on post references.
- Keep date display stable as `YYYY-MM-DD`.
- Keep tags optional; most existing posts have empty tags.
- Keep homepage articles and photography ordered by post `pinned` first and post date descending. Keep projects, friends, and contacts in their JSON registry entry order. Feeds remain strictly date-ordered.
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

`pnpm build` is the primary verification command. The deployed artifact is `out/`. Its `postbuild` step generates `out/_headers` from site configuration and content metadata; do not add a second handwritten `public/_headers` source. A failed header-generation step must fail the build.

`pnpm validate:content` should pass before shipping. Warnings about missing local images should be investigated but are not currently fatal.

## Known Notes

- `README.md` is the user's GitHub public profile and should remain untouched.
- The current static site target is Cloudflare Pages.
- `my-programmer-growth-journey` currently references a missing local attachment and the validator reports it as a warning.

Contacts use the shared `contact` entity kind in `content/contacts.json`, with `contact:id` / `contact:*` Markdown references and `lib/contacts.ts` loaders. Official site icons are stored in `public/assets/contacts/`; provenance is documented in `docs/entities.md`. Contacts appear on the homepage, through references, and on the standalone `/contacts/` collection route, with the same card layout as projects and friends.
