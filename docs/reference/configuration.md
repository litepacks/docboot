---
title: Configuration Reference
description: Complete docboot.config.js configuration reference categorized by feature.
order: 2
---

# Configuration Reference

Docboot requires **zero configuration** by default. When customization is needed, create a `docboot.config.js` file in your project root.

---

## 1. Site Metadata & Paths

```javascript title="docboot.config.js"
export default {
  title: "My Project Documentation",
  description: "High-performance developer documentation",
  docs: "./docs",           // Source directory (default: "./docs" or ".")
  out: "./dist",            // Output directory (default: "./dist")
  repo: "https://github.com/org/my-project" // Repository link for header
};
```

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | `"Documentation"` | Website title in header and metadata |
| `description` | `string` | `""` | Global fallback SEO meta description |
| `docs` | `string` | `"./docs"` | Path to Markdown source folder |
| `out` | `string` | `"./dist"` | Output directory for static build |
| `repo` | `string` | `""` | GitHub repository URL |

---

## 2. Navigation & Source Links

```javascript title="docboot.config.js"
export default {
  editLink: {
    pattern: "https://github.com/org/my-project/edit/main/docs/:path",
    text: "Edit this page on GitHub"
  },
  sourceLink: {
    pattern: "https://github.com/org/my-project/blob/main/docs/:path",
    text: "View source"
  }
};
```

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `editLink.pattern` | `string` | `null` | URL template for "Edit this page on GitHub" link |
| `editLink.text` | `string` | `"Edit this page on GitHub"` | Display text for the link |
| `sourceLink.pattern` | `string` | `null` | URL template for "View source" link |
| `sourceLink.text` | `string` | `"View source"` | Display text for the link |

---

## 3. Theme & Typography Controls

```javascript title="docboot.config.js"
export default {
  theme: {
    preset: "zinc",          // "zinc" | "ocean" | "emerald" | "violet" | "amber" | "rose"
    defaultMode: "system",   // "system" | "dark" | "light"
    themeToggle: true,       // Show light/dark mode icon
    presetMenu: true,        // Show theme & font customizer menu
    fontSizeControl: true    // Show A- / A+ reading font size stepper
  }
};
```

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `theme.preset` | `string` | `"zinc"` | Accent color palette |
| `theme.defaultMode` | `string` | `"system"` | Default theme mode on first visit |
| `theme.themeToggle` | `boolean` | `true` | Show dark/light mode toggle button in header |
| `theme.presetMenu` | `boolean` | `true` | Show palette switcher & typography dropdown |
| `theme.fontSizeControl` | `boolean` | `true` | Show text scaling `A-` / `A+` buttons |

---

## 4. Local Search

```javascript title="docboot.config.js"
export default {
  search: {
    fuzzy: 0.2,       // Fuzzy matching threshold (0 = exact, 0.2 = default)
    prefix: true,      // Match prefix substrings while typing
    maxResults: 10,    // Maximum number of visible results in modal
    minQueryLength: 2  // Minimum characters before executing search
  }
};
```

---

## 5. Rich Content & Embeds

```javascript title="docboot.config.js"
export default {
  embeds: {
    allowedDomains: [
      "youtube.com",
      "codesandbox.io",
      "stackblitz.com",
      "codepen.io",
      "vimeo.com"
    ]
  }
};
```

---

## 6. Hosting & SEO Base Path

```javascript title="docboot.config.js"
export default {
  base: "/my-project/",              // Custom base path (e.g. GitHub Pages repo name)
  customDomain: "docs.example.com"   // Generates dist/CNAME file
};
```

---

## 7. Analytics

```javascript title="docboot.config.js"
export default {
  analytics: {
    google: { id: "G-XXXXXXXXXX" },
    plausible: { domain: "docs.example.com", apiHost: "https://plausible.io" },
    umami: { websiteId: "xxxx-xxxx", src: "https://analytics.umami.is/script.js" },
    fathom: { siteId: "XXXXXX" },
    clarity: { id: "XXXXXXXXXX" },
    custom: `<script defer src="https://my-cdn.com/analytics.js"></script>`
  }
};
```

---

## 8. Progressive Web App (PWA)

```javascript title="docboot.config.js"
export default {
  pwa: true // Generates manifest.webmanifest and sw.js for offline reading
};
```

---

## 9. Page Provenance & Footer

Docboot automatically infers Git creation dates, last update dates, and GitHub edit URLs at build time without requiring manual date maintenance.

```javascript title="docboot.config.js"
export default {
  footer: {
    pageMeta: true,     // Enable page-level metadata footer
    created: true,      // Show page initial introduction date (from Git or frontmatter)
    updated: true,      // Show page last modified date (from Git or frontmatter)
    editLink: true,     // Automatic "Edit this page" link
    version: true,      // Show Docboot version in site footer
    commit: false,      // Show short commit SHA in site footer
    buildDuration: false, // Show compilation duration in site footer
    branding: true,     // Show "Built with Docboot" branding
    links: [
      { label: "GitHub", href: "https://github.com/litepacks/docboot" },
      { label: "npm", href: "https://www.npmjs.com/package/docboot" }
    ]
  }
};
```

### Frontmatter Overrides

You can override Git-inferred provenance explicitly in any Markdown file's frontmatter:

```markdown
---
title: State Management
created: 2026-08-12
updated: 2026-08-29
editLink: false
---
```

---

## Next Steps

- [CLI Reference](/reference/cli) — CLI commands and flags
- [Directives Reference](/reference/directives) — Markdown extensions
- [Docboot Doctor](/tooling/doctor) — Validating project configuration
