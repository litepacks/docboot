---
title: Configuration Guide
description: Customizing themes, search, and embeds with docboot.config.js
order: 2
---

# Configuration Guide

Docboot works with **zero configuration** by default. When you need customization, create a `docboot.config.js` file in your root folder.

---

## Configuration Example

```javascript title="docboot.config.js"
export default {
  title: "My Awesome Project",
  description: "High-performance developer documentation",
  docs: "./docs",
  out: "./dist",
  repo: "https://github.com/your-username/my-project",
  theme: {
    preset: "ocean",       // "zinc" | "ocean" | "emerald" | "violet" | "amber" | "rose"
    defaultMode: "system"  // "system" | "dark" | "light"
  },
  search: {
    fuzzy: 0.2,
    prefix: true,
    maxResults: 10,
    minQueryLength: 2
  },
  embeds: {
    allowedDomains: [
      "youtube.com",
      "codesandbox.io",
      "stackblitz.com"
    ]
  }
};
```

---

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | `"Documentation"` | Site title shown in header and metadata |
| `description` | `string` | `""` | Default meta description for SEO |
| `docs` | `string` | `"./docs"` | Source directory containing Markdown files |
| `out` | `string` | `"./dist"` | Output directory for compiled static files |
| `repo` | `string` | `""` | GitHub repository URL for header icon link |
| `editLink` | `boolean \| object` | `null` | Enable "Edit this page on GitHub" footer link |
| `sourceLink` | `boolean \| object` | `null` | Enable "View source" footer link |
| `theme.preset`| `string` | `"zinc"` | Accent color palette |
| `theme.defaultMode` | `string` | `"system"` | Default theme mode |

---

## Source Code & Edit Link Shortcuts

### Global Repository Configuration

```javascript title="docboot.config.js"
export default {
  repo: "https://github.com/your-username/my-project",
  editLink: {
    pattern: "https://github.com/your-username/my-project/edit/main/docs/:path",
    text: "Edit this page on GitHub"
  },
  sourceLink: {
    pattern: "https://github.com/your-username/my-project/blob/main/docs/:path",
    text: "View source"
  }
};
```

### Frontmatter Direct Source Code Badge (`source`)

Link directly to the implementation file in your codebase from any documentation page:

```markdown
---
title: Query Builder API
source: src/orm/query-builder.js
---

# Query Builder API
...
```

This displays a sleek `⌥ Source: src/orm/query-builder.js ↗` badge at the top of the page.

---

## Analytics Integration

Docboot provides built-in, zero-latency support for popular privacy-friendly analytics and Google Analytics with automatic SPA pageview tracking on route changes:

```javascript title="docboot.config.js"
export default {
  analytics: {
    // 1. Google Analytics (GA4)
    google: {
      id: "G-XXXXXXXXXX"
    },

    // 2. Plausible Analytics (Privacy-first)
    plausible: {
      domain: "docs.example.com",
      apiHost: "https://plausible.io" // optional self-hosted instance
    },

    // 3. Umami Analytics
    umami: {
      websiteId: "xxxx-xxxx-xxxx",
      src: "https://analytics.umami.is/script.js"
    },

    // 4. Fathom Analytics
    fathom: {
      siteId: "XXXXXX"
    },

    // 5. Microsoft Clarity
    clarity: {
      id: "XXXXXXX"
    },

    // 6. Custom Head Injection
    custom: `<script defer data-custom="my-analytics" src="https://my-cdn.com/tracker.js"></script>`
  }
};
```

---

## Next Steps

- [CLI Reference](/guide/cli)
- [Rich Content Primitives](/guide/rich-content)
- [Mermaid Diagrams](/guide/diagrams)
