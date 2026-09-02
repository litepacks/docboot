# AGENTS.md — AI Agent Guidelines & Repository Architecture

This document serves as the primary system guide for AI agents and developer tools operating on the **Docboot** codebase (`litepacks/docboot`).

---

## 1. Project Overview & Philosophy

**Docboot** is an ultra-fast, zero-config Markdown documentation generator and static site compiler (SSG) built for modern technical documentation.

- **Zero-Config Developer Experience**: Automatic file discovery, heuristic sidebar organization, and sensible defaults.
- **Client-Side Search**: Pre-indexed MiniSearch engine compiled at build-time with sub-millisecond in-memory fuzzy search and dynamic snippets.
- **Rich Documentation Primitives**: 47+ accessible, Tailwind-styled directives (API endpoints, cards, metrics, hero banners, timelines, accordions, sandboxes, and code previews).
- **Automated Diagnostics**: Built-in WCAG 2.2 AA accessibility audits, link integrity verification, redirect checks, and stale page detection (`docboot doctor`).
- **PWA & Offline Ready**: Service worker caching, dynamic asset versioning, and auto-update notifications.

---

## 2. Codebase Architecture

```
/
├── bin/
│   └── docboot.js               # CLI entrypoint executable
├── src/
│   ├── cli/                     # CLI commands (build, dev, doctor, pages, init, stats, present)
│   ├── compiler/                # HTML layout rendering, static site generator, asset pipeline
│   ├── markdown/                # Markdown parser, frontmatter, Table of Contents, 47+ directives
│   │   └── directives.js        # Core directive engine & AST transforms
│   ├── search/                  # MiniSearch pre-indexing, symbol extraction, fuzzy query engine
│   ├── presentation/            # Slide deck compiler, presenter view, fragment animations
│   ├── accessibility/           # WCAG 2.2 AA diagnostics, landmark validation, heading skips
│   ├── images/                  # Responsive image pipeline, AVIF/WebP generation, SVG inspection
│   └── server/                  # Local dev server, live reload, WebSocket sync
├── docs/                        # Official documentation markdown source files
├── tests/                       # Node.js native test suites (node:test)
│   ├── rich-primitives.test.js  # Directives & rich content test suite
│   ├── search.test.js           # Search engine & indexing test suite
│   ├── accessibility.test.js    # WCAG 2.2 AA compliance suite
│   ├── doctor.test.js           # Diagnostics, stale pages & link integrity
│   └── compiler.test.js         # Site builder, navigation & HTML generation
├── docboot.config.js            # Workspace configuration
└── package.json                 # Project dependencies and scripts
```

---

## 3. Development & Testing Workflow

### Prerequisites
- **Node.js**: `v20.0.0` or higher (`v24.x` recommended).
- **Dependencies**: Use standard `npm test` or `npm run dev`.

### Running Tests
All test suites use Node's native test runner (`node:test` and `node:assert/strict`):

```bash
# Run entire test suite (all 151+ tests)
npm test

# Run a specific test suite
node --test tests/rich-primitives.test.js
node --test tests/search.test.js
node --test tests/doctor.test.js
```

### Static Site Build & Integrity Diagnostics
Always verify changes with the build and doctor commands:

```bash
# Build documentation static bundle to dist/
./bin/docboot.js build

# Run comprehensive health check (broken links, redirects, stale pages)
./bin/docboot.js doctor --stale
```

---

## 4. Markdown Directive Conventions

Directives follow the container syntax `:::type [args] ... :::` with nested `::sub-item` markers:

1. **Sub-Item Splitting**:
   - Use block split `body.split(/(?:^|\r?\n)::subitem\s*/).filter(Boolean)` or regex with newline lookaheads `(?=(?:\r?\n::subitem|\s*$))` to prevent regex backtracking issues.
2. **YAML Fallback**:
   - Directives should support both markdown sub-blocks (`::card`, `::metric`, `::item`) and YAML list arrays (`- title: ...`).
3. **HTML Escaping**:
   - Always escape user strings with `escapeHtml(str)` when injecting into raw HTML attributes or text nodes to prevent XSS.
4. **Tailwind Styling**:
   - Wrap interactive/rich directives in `.not-prose` to prevent `@tailwindcss/typography` default styling from overriding custom UI layouts.
5. **Accessibility**:
   - Provide appropriate `aria-label`, `role`, `aria-hidden="true"`, and semantic HTML tags (`<details>`, `<summary>`, `<time>`, `<kbd>`, `<nav>`).

---

## 5. Doctor & Link Integrity Rules

- **No Broken Links**: `docboot doctor` parses every `[Text](path)` link. Ensure all internal links in `docs/` point to actual existing files or valid absolute URLs.
- **No Redirect Loops**: Ensure `redirects` config does not form cyclical redirect chains.
- **Image References**: All image URLs in `:::image` or markdown `![]()` must resolve to valid local assets or HTTP(S) endpoints.
