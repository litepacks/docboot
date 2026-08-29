---
title: Why Docboot?
description: Architectural positioning and comparison with traditional documentation frameworks.
order: 2
---

# Why Docboot?

Traditional documentation frameworks are structured as independent software applications. They require initializing a dedicated frontend project, configuring a build pipeline, choosing a UI component framework, and maintaining documentation dependencies over time.

Docboot takes a fundamentally different approach:

> **Traditional tools start with a docs project.**  
> **Docboot starts with the Markdown you already have.**

---

## The Workflow Difference

```text
┌─────────────────────────────────────────────────────────────┐
│                 Framework-First Documentation               │
│                                                             │
│  npm create docs-app ──► Configure Vite/Next ──► Move files │
│  ──► Install React/Vue ──► Maintain Node dependencies       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Docboot Workflow                       │
│                                                             │
│  cd existing-project ──► npx docboot .                      │
└─────────────────────────────────────────────────────────────┘
```

---

## When to Use Docboot

### 1. You Already Have a Markdown Folder
Your repository already has a `docs/` folder or a collection of `.md` files. You want a modern documentation website without creating a separate repository or adding hundreds of megabytes of framework dependencies.

### 2. You Want Zero Required Config
You do not want to define sidebar navigation maps, router configurations, or custom theme templates just to view your documentation. Docboot builds the sidebar, breadcrumbs, titles, table of contents, and search index from your filesystem.

### 3. You Want Rich Content Without JSX
Most technical documentation needs tabs, code groups, callouts, and collapsible details. Docboot provides these as standard Markdown directives (`:::tabs`, `:::code-group`, `:::details`) without requiring MDX or JSX compilers.

### 4. You Value Build-Time Performance & Small Client Runtimes
Docboot parses Markdown and executes syntax highlighting at build time. The resulting static HTML is readable without JavaScript, with a lightweight progressive-enhancement runtime for in-browser search, theme switching, and tabs.

---

## When to Choose a Component-Driven Framework

Docboot is optimized for Markdown-driven technical documentation. If your documentation website requires:
- Complex custom interactive React, Vue, or Svelte widgets embedded throughout pages
- Client-side data fetching directly from internal authenticated APIs
- Full custom layout programming per route

Then an application framework (like Next.js, Nuxt, or Astro) may be a better fit.

---

## Summary Comparison

| Dimension | Framework-First Tools | Docboot |
| :--- | :--- | :--- |
| **Setup Model** | Creates a new documentation project | Points at existing Markdown directory |
| **Initial Dependencies** | Framework (Vite, React, Vue, Webpack) | Zero install via `npx docboot .` |
| **Configuration** | Mandatory router & sidebar configs | Zero-config by default, optional config |
| **Rich Primitives** | Requires MDX / JSX components | Native Markdown directives (`:::tabs`) |
| **Syntax Highlighting** | Often client-side or heavy JS bundler | Build-time pre-compiled HTML |
| **Search** | Algolia / external service or large payload | In-browser MiniSearch (zero per-query requests) |
| **Built-in Tooling** | Requires separate linters / scripts | Built-in `docboot doctor` & `docboot stats` |

---

## Next Steps

- [Quick Start](/getting-started/quick-start) — Run Docboot in under a minute
- [Project Structure & Routing](/getting-started/project-structure) — Understanding automatic discovery and category hubs
- [Architecture & Runtime](/advanced/architecture) — Detailed static build pipeline
