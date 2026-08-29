---
title: Project Structure & Routing
description: How Docboot discovers files, generates clean URLs, strips numeric prefixes, and creates automatic category hubs.
order: 3
---

# Project Structure & Routing

Docboot scans your Markdown folder and maps the filesystem structure directly to web routes.

---

## File System to Route Mapping

Consider the following folder layout:

```text
docs/
├── README.md               -> /
├── 01-getting-started.md   -> /getting-started
├── guide/
│   ├── 01-installation.md  -> /guide/installation
│   └── 02-configuration.md -> /guide/configuration
└── api/
    └── runtime.md          -> /api/runtime
```

Docboot automatically derives:

1. **Clean Web Routes**: `README.md` maps to `/`. Subdirectories map to clean URL paths (e.g. `/guide/installation`).
2. **Numeric Prefix Stripping**: Prefixes like `01-` or `02-` control file order in the sidebar without appearing in the URL.
3. **Automatic Page Titles**: Derived from the document's top `# Heading 1`, YAML `title` frontmatter, or humanized file name (`01-getting-started.md` $\rightarrow$ `Getting Started`).
4. **Hierarchical Navigation Sidebar**: Nested folders automatically become collapsible sidebar groups.
5. **Interactive Breadcrumbs**: Breadcrumbs at the top of each page reflect the folder depth.
6. **Previous / Next Links**: Sorted pagination links at the bottom of each page.

---

## Automatic Category Hub Pages

In many projects, subdirectories contain topic documents without a dedicated `index.md` or `README.md` file:

```text
docs/
└── api/
    ├── client.md
    ├── plugins.md
    └── runtime.md
```

When a user visits `/api` (or clicks "API" in the breadcrumbs), Docboot automatically generates a synthetic **Category Hub Page**:
- **Title**: Derived from the folder name (e.g., `API`).
- **Cards Grid**: Displays a card for each child document inside `/api/` with its title and description.
- **Route**: Mounted at `/api` without requiring you to manually create and maintain `docs/api/index.md`.

:::tip Overriding Category Hubs
If you create your own `docs/api/README.md` or `docs/api/index.md`, Docboot renders your custom file instead of the automatic category hub.
:::

---

## Automatic Internal Link Resolution

Docboot normalizes relative Markdown links (`.md` / `.markdown`) into clean web routes at build time:

```markdown
<!-- Inside docs/getting-started/quick-start.md -->
[Installation](../guide/01-installation.md)   -> /guide/installation
[Home](../../README.md)                       -> /
[Section Link](./project-structure.md#hubs)   -> /getting-started/project-structure#hubs
[GitHub](https://github.com/litepacks/docboot)-> External link (unchanged)
```

You can write normal relative paths in your editor, and links will work both when browsing the raw files on GitHub and in the compiled documentation site.

---

## Next Steps

- [Rich Content Primitives](/guide/rich-content) — Enhancing pages with tabs, callouts, and code groups
- [Configuration](/reference/configuration) — Optional configuration overrides
- [Docboot Doctor](/tooling/doctor) — Validating links and route conflicts
