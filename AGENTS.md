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
- `content/projects.json` is the canonical registry for project names, links, dates, descriptions, covers, and pinning.
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
projectId: example-project
```

Use `hidden: true` for pages that should remain directly accessible but excluded from article listings, feeds, and sitemap. It does not hide content marked for photography or associated with a registered project.

Project posts reference a key from `content/projects.json` through `projectId`. Do not duplicate project display metadata in post frontmatter. Registered projects must have at least one referencing post. Project display dates come from the registry `date` field (`YYYY-MM-DD`), not from referencing posts.

Local assets referenced by a post should live in the same post directory. Prefer relative paths such as `./image.png`.
Photography images must use relative Markdown image paths with non-empty alt text.
A sibling `.mov` / `.MOV` with the same filename as a still image enables Live Photo playback; Markdown should still reference only the still.

## Implementation Rules

- Preserve the current static export model in `next.config.js`.
- Do not add a CMS, database, server runtime dependency, or dynamic hosting requirement unless explicitly requested.
- Keep article-channel filtering based on `hidden`; photography and registered-project collection membership is independent.
- Keep date display stable as `YYYY-MM-DD`.
- Keep tags optional; most existing posts have empty tags.
- Keep homepage articles and photography ordered by post `pinned` first and post date descending. Keep projects ordered by registry `pinned` first and their latest referencing post date descending. Feeds remain strictly date-ordered.
- Keep the visual style lightweight and personal; avoid broad redesigns unless explicitly requested.
- Do not move Markdown posts out of `public/<slug>/index.md` without an explicit migration request.

## Commands

```bash
pnpm dev
pnpm build
pnpm validate:content
pnpm optimize:images
pnpm new-post <slug> [title]
pnpm deploy:cf
```

`pnpm build` is the primary verification command. The deployed artifact is `out/`.

`pnpm validate:content` should pass before shipping. Warnings about missing local images should be investigated but are not currently fatal.

## Known Notes

- `README.md` is the user's GitHub public profile and should remain untouched.
- The current static site target is Cloudflare Pages.
- `my-programmer-growth-journey` currently references a missing local attachment and the validator reports it as a warning.
