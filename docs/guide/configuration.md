---
title: Configuration
description: Customizing themes, search, and integrations with docboot.config.js.
order: 2
---

# Configuration

Docboot operates with **zero configuration** by default. When you need custom branding, analytics, or navigation links, create an optional `docboot.config.js` file in your root folder.

---

## Example Configuration

```javascript title="docboot.config.js"
export default {
  title: "My Awesome Project",
  description: "High-performance developer documentation",
  docs: "./docs",
  out: "./dist",
  repo: "https://github.com/org/my-project",
  theme: {
    preset: "zinc",          // "zinc" | "ocean" | "emerald" | "violet" | "amber" | "rose"
    defaultMode: "system",   // "system" | "dark" | "light"
    themeToggle: true,       // Show light/dark toggle
    presetMenu: true,        // Show color & font customizer
    fontSizeControl: true    // Show text size stepper
  },
  search: {
    fuzzy: 0.2,
    prefix: true,
    maxResults: 10,
    minQueryLength: 2
  },
  editLink: {
    pattern: "https://github.com/org/my-project/edit/main/docs/:path"
  },
  sourceLink: {
    pattern: "https://github.com/org/my-project/blob/main/:path"
  },
  analytics: {
    google: { id: "G-XXXXXXXXXX" },
    plausible: { domain: "docs.example.com" }
  },
  pwa: true
};
```

---

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | `"Documentation"` | Site title in header and metadata |
| `description` | `string` | `""` | Default SEO meta description |
| `docs` | `string` | `"./docs"` | Source directory containing Markdown files |
| `out` | `string` | `"./dist"` | Output directory for static build |
| `repo` | `string` | `""` | GitHub repository URL for header icon link |
| `theme.preset` | `string` | `"zinc"` | Accent color palette |
| `theme.defaultMode` | `string` | `"system"` | Default theme mode on first visit |
| `theme.themeToggle` | `boolean` | `true` | Show dark/light mode toggle button in header |
| `theme.presetMenu` | `boolean` | `true` | Show palette switcher & typography dropdown |
| `theme.fontSizeControl`| `boolean` | `true` | Show text scaling stepper buttons |
| `pwa` | `boolean` | `false` | Enable Progressive Web App offline caching |
| `analytics` | `object` | `{}` | Built-in integrations for popular analytics providers |

---

## Source Code & Edit Link Badges

Link directly to source code or GitHub edit pages:

```javascript title="docboot.config.js"
export default {
  editLink: {
    pattern: "https://github.com/org/my-project/edit/main/docs/:path",
    text: "Edit this page on GitHub"
  },
  sourceLink: {
    pattern: "https://github.com/org/my-project/blob/main/:path",
    text: "View source"
  }
};
```

You can also specify a direct source file in any page's frontmatter:

```markdown
---
title: Query Builder API
source: src/orm/query-builder.js
---
```

This displays a clickable `⌥ Source: src/orm/query-builder.js ↗` badge at the top of the article.

---

## Next Steps

- [Rich Content Primitives](/guide/rich-content) — Tabs, callouts, and details
- [Local Search Architecture](/guide/search) — Client-side search indexing
- [CLI Reference](/tooling/cli) — CLI commands and options
