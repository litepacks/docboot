---
title: Themes & Customization
description: Color presets, anti-flash theme bootstrapping, typography settings, and header control visibility.
order: 4
---

# Themes & Customization

Docboot is styled with a modern, high-contrast developer aesthetic and includes built-in theme presets, reading font controls, and visibility toggles.

---

## 1. Theme Modes

Docboot supports three theme modes:
- `system` (Default): Automatically tracks OS appearance preferences (`prefers-color-scheme`).
- `dark`: High-contrast dark palette tailored for code reading.
- `light`: Clean, crisp daylight reading palette.

### Anti-Flash Bootstrapping
An inline head script checks `localStorage` and system preferences before page render, completely preventing white-flash when loading dark mode.

---

## 2. Six Color Presets

Docboot includes six curated accent palettes designed for developer documentation:

| Preset | Character & Style | Primary Tone |
| :--- | :--- | :--- |
| **`zinc`** (Default) | Minimalist & modern monochrome (Tailwind / Linear aesthetic) | Neutral Zinc |
| **`ocean`** | Deep navy & high-contrast cyan-indigo | Cyan Indigo |
| **`emerald`** | Slate with vibrant mint green (Supabase / Mintlify aesthetic) | Vibrant Mint |
| **`violet`** | Neon amethyst & purple (Vite / Nuxt aesthetic) | Amethyst Purple |
| **`amber`** | Warm obsidian & amber gold (Rust / Astro / Claude aesthetic) | Warm Amber |
| **`rose`** | Modern ruby & coral pink | Vibrant Rose |

You can configure the default preset in `docboot.config.js`:

```javascript title="docboot.config.js"
export default {
  theme: {
    preset: "ocean",       // "zinc" | "ocean" | "emerald" | "violet" | "amber" | "rose"
    defaultMode: "system"  // "system" | "dark" | "light"
  }
};
```

---

## 3. Reader Typography & Font Scaling

Readers can personalize their reading experience directly from the UI:

- **Font Size Scaling**: `A-` / `A+` buttons in the header, breadcrumbs, and right-hand table of contents allow stepping through font sizes (`sm`, `base`, `lg`, `xl`).
- **Font Families**: Support for Sans (`Inter`), Geometric (`Outfit`), Serif (`Editorial`), and System Native fonts (`SF Pro`, `Segoe UI`).

---

## 4. Header Controls Visibility

If you want a minimal header layout without theme switches or font size toggles, you can disable them via configuration:

```javascript title="docboot.config.js"
export default {
  theme: {
    preset: "zinc",
    defaultMode: "dark",
    themeToggle: true,       // false to hide ☀️/🌙 theme toggle icon
    presetMenu: true,        // false to hide 🎨 palette and font customizer
    fontSizeControl: true    // false to hide A- / A+ stepper buttons
  }
};
```

---

## Next Steps

- [PWA & Offline Caching](/guide/pwa) — Progressive Web App capabilities
- [Analytics Integration](/guide/analytics) — Privacy-first analytics setup
- [Configuration Reference](/reference/configuration) — All configuration parameters
