# AGENTS.md

## Project Overview

This repository is a lightweight personal blog built with Next.js App Router and exported as a static site for Cloudflare Pages.

The GitHub profile `README.md` is not project documentation. Do not edit `README.md` for blog maintenance notes, agent instructions, or implementation summaries.

## Architecture

- `app/` contains Next.js routes and shared layout.
- `app/page.tsx` renders the public homepage list.
- `app/[slug]/page.tsx` renders each Markdown post.
- `app/rss.xml/route.ts` and `app/atom.xml/route.ts` generate feeds.
- `app/sitemap.xml/route.ts` and `app/robots.txt/route.ts` generate SEO metadata files.
- `lib/config.ts` contains site metadata such as `siteUrl`, author, avatar, and title.
- `lib/posts.ts` is the content data layer. Keep Markdown parsing, frontmatter normalization, date formatting, public-post filtering, and feed data behavior centralized there.
- `public/<slug>/index.md` is the source format for posts.
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
project: true
projectUrl: https://example.com
sourceUrl: https://github.com/example/repo
```

Use `hidden: true` for pages that should remain directly accessible but excluded from article listings, feeds, and sitemap. It does not hide content marked for photography or project collections.

Local assets referenced by a post should live in the same post directory. Prefer relative paths such as `./image.png`.
Photography images must use relative Markdown image paths with non-empty alt text.

## Implementation Rules

- Preserve the current static export model in `next.config.js`.
- Do not add a CMS, database, server runtime dependency, or dynamic hosting requirement unless explicitly requested.
- Keep article-channel filtering based on `hidden`; photography and project collection membership is independent.
- Keep date display stable as `YYYY-MM-DD`.
- Keep tags optional; most existing posts have empty tags.
- Keep homepage collections ordered by `pinned` first and post date descending within each group. Feeds remain strictly date-ordered.
- Keep the visual style lightweight and personal; avoid broad redesigns unless explicitly requested.
- Do not move Markdown posts out of `public/<slug>/index.md` without an explicit migration request.

## Commands

```bash
pnpm dev
pnpm build
pnpm validate:content
pnpm new-post <slug> [title]
pnpm deploy:cf
```

`pnpm build` is the primary verification command. The deployed artifact is `out/`.

`pnpm validate:content` should pass before shipping. Warnings about missing local images should be investigated but are not currently fatal.

## Known Notes

- `README.md` is the user's GitHub public profile and should remain untouched.
- The current static site target is Cloudflare Pages.
- `my-programmer-growth-journey` currently references a missing local attachment and the validator reports it as a warning.
