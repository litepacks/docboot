---
title: Directives Reference
description: Syntax cheatsheet for Docboot Markdown directives and extensions.
order: 3
---

# Directives Reference

Docboot extends standard CommonMark and GitHub Flavored Markdown with clean, non-MDX documentation directives.

---

## 1. Callout Blocks

```markdown
:::note Note Title
Standard informative note block.
:::

:::tip Helpful Tip
Optimization or recommended best practice.
:::

:::warning Caution
Important warning or breaking change notice.
:::

:::danger Critical Alert
High risk security or data loss warning.
:::
```

---

## 2. Tabs (`:::tabs`)

````markdown
:::tabs group="sync-group-name"
::tab Tab Label 1
Content for first tab.

::tab Tab Label 2
Content for second tab.
:::
````

---

## 3. Code Groups (`:::code-group`)

````markdown
:::code-group
```javascript [index.js]
console.log('Hello');
```
```typescript [index.ts]
console.log('Hello');
```
:::
````

---

## 4. Collapsible Details (`:::details`)

```markdown
:::details Section Summary Title
Detailed breakdown visible when expanded by user.
:::
```

---

## 5. Embeds (`:::embed`)

```markdown
:::embed youtube
src: https://youtube.com/watch?v=VIDEO_ID
title: Interactive Walkthrough
ratio: 16/9
:::
```

---

## 6. Image Galleries (`:::gallery`)

```markdown
:::gallery
- src: ./screens/overview.png
  alt: Architecture Overview
  caption: System component structure

- src: ./screens/metrics.png
  alt: Performance Metrics
  caption: Sub-second compilation timings
:::
```

---

## 7. Typographic Modifiers

```markdown
:::lead
Enlarged lead paragraph for introductory sections.
:::

:::text-sm
Smaller auxiliary text or legal fine print.
:::
```

---

## Next Steps

- [Rich Content Primitives](/guide/rich-content) — Detailed examples and usage patterns
- [Mermaid Diagrams](/guide/diagrams) — Flowcharts and sequence diagrams
- [CLI Reference](/reference/cli) — CLI commands and flags
