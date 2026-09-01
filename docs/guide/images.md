---
title: Image Optimization & Responsive Images
description: Production-ready, zero-config build-time image optimization, modern formats (AVIF & WebP), and responsive <picture> rendering.
order: 6
---

# Image Optimization & Responsive Images

> **Authors write Markdown. Docboot handles production details.**  
> Docboot automatically optimizes images referenced in your Markdown files during build, with zero configuration required.

---

## 1. Basic Markdown Images

You can write normal, standard Markdown images:

```markdown
![Analytics Dashboard](./images/dashboard.png)
```

Docboot automatically:
- Resolves the local source file relative to the Markdown document, `docs/`, or `public/`
- Reads intrinsic `width` and `height` binary headers ahead of time to eliminate **Cumulative Layout Shift (CLS)**
- Generates modern, highly compressed **AVIF** and **WebP** formats alongside original fallbacks
- Generates responsive resolution variants (`480w`, `768w`, `1280w`, `1920w`)
- Renders semantic `<picture>` markup with responsive `srcset` and `sizes`
- Adds `loading="lazy"` and `decoding="async"` for optimal Core Web Vitals
- Hooks into the interactive **Lightbox zoom modal** automatically

```markdown
![Documentation Architecture](./images/architecture.png "System Overview")
```

When a title is provided, Docboot automatically wraps the picture in a semantic `<figure>` with an accessible `<figcaption>`.

---

## 2. Generated HTML Output

Docboot turns standard Markdown into semantic, accessible, responsive HTML:

```html
<figure class="docboot-figure not-prose my-8 text-center">
  <div class="inline-block relative overflow-hidden rounded-lg border border-border bg-card-bg/40 shadow-2xs group">
    <picture>
      <source
        type="image/avif"
        srcset="/assets/images/dashboard.a8f12c.480.avif 480w, /assets/images/dashboard.a8f12c.768.avif 768w, /assets/images/dashboard.a8f12c.1280.avif 1280w"
        sizes="(max-width: 1280px) 100vw, 1280px"
      >
      <source
        type="image/webp"
        srcset="/assets/images/dashboard.a8f12c.480.webp 480w, /assets/images/dashboard.a8f12c.768.webp 768w, /assets/images/dashboard.a8f12c.1280.webp 1280w"
        sizes="(max-width: 1280px) 100vw, 1280px"
      >
      <img
        src="/assets/images/dashboard.a8f12c.768.webp"
        width="1920"
        height="1080"
        loading="lazy"
        decoding="async"
        alt="Analytics Dashboard"
        class="block max-w-full h-auto rounded-lg cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.01]"
        data-docboot-lightbox="true"
        data-lightbox-src="/assets/images/dashboard.a8f12c.1920.webp"
        data-lightbox-alt="Analytics Dashboard"
        data-lightbox-caption="System Overview"
      />
    </picture>
  </div>
  <figcaption class="mt-2.5 text-xs text-muted-foreground font-medium">System Overview</figcaption>
</figure>
```

---

## 3. Responsive Widths & No-Upscaling

Docboot calculates responsive breakpoints suitable for technical documentation:
- `480px` (Mobile screens)
- `768px` (Tablets / split-pane sidebars)
- `1280px` (Standard desktop content area)
- `1920px` (High-density displays & full-width screenshots)

### Strict No-Upscaling Rule
Docboot will **never upscale** images. If your source screenshot is `900px` wide, Docboot generates variants only up to `900px` (e.g. `480px`, `768px`, and `900px`), preventing unnecessary variant bloat and preserving crisp rendering.

---

## 4. Documentation Screenshot Preset

Technical documentation images are primarily:
- UI & Web Application screenshots
- Terminal recordings & code snippets
- System architecture diagrams & logos

Docboot uses a built-in `docs` preset that preserves sharp typography and high-contrast UI borders without blurry lossy compression artifacts.

---

## 5. Explicit Image Directive (`:::image`)

For full control over image layout, custom dimensions, above-the-fold loading, or disabling optimization for pixel art:

```markdown
:::image
src: ./images/hero-banner.png
alt: Docboot Hero Banner
caption: Next-generation documentation engine
width: 800
loading: eager
lightbox: true
:::
```

### Directive Options:
| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `src` | `string` | required | Relative or public image path |
| `alt` | `string` | `""` | Accessible alternative text |
| `caption` | `string` | `""` | Figure caption displayed below image |
| `width` | `number \| string` | auto | Max width constraint (e.g. `600`, `80%`) |
| `loading` | `"lazy" \| "eager"` | `"lazy"` | Above-the-fold hero images can use `eager` |
| `lightbox` / `zoom` | `boolean` | `true` | Enable or disable full-resolution modal zoom |
| `optimize` | `boolean` | `true` | Set to `false` for pixel-art or pre-optimized assets |
| `align` | `"center" \| "left" \| "right"` | `"center"` | Alignment container |

### Disabling Optimization for Pixel Art
```markdown
:::image
src: ./pixel-icon.png
alt: Retro pixel badge
optimize: false
:::
```

---

## 6. Image Galleries (`:::gallery`)

Display multiple screenshots in an accessible, responsive grid with automatic thumbnail generation:

```markdown
:::gallery
- src: ./screens/editor.png
  alt: Visual Editor
  caption: Markdown live editor with split preview

- src: ./screens/dark-mode.png
  alt: Dark Theme
  caption: Built-in accessible dark theme with WCAG 2.2 AA contrast

- src: ./screens/mobile.png
  alt: Mobile Drawer
  caption: Smooth mobile navigation with touch gestures
:::
```

In galleries, Docboot serves lightweight thumbnail variants (`480w`) for the grid cards and links `data-lightbox-src` to the full high-resolution image when the user clicks to zoom.

---

## 7. Vector Graphics (SVG) & Animated Images (GIF)

### Safe Vector Preservation (SVG)
- Vectors remain vectors — SVGs are never rasterized into bitmap formats.
- Safe, deterministic minification removes editor cruft while preserving `viewBox`, `title`, `desc`, `aria-*`, and all styling attributes.

### Animation Preservation (GIF)
- Animated GIFs are preserved and never converted into static frames.
- `docboot doctor` will warn if a legacy GIF exceeds `5MB` so you can consider optimizing animated assets.

---

## 8. Configuration

Docboot works out of the box with zero configuration. You can customize global image settings in `docboot.config.js`:

```javascript
// docboot.config.js
export default {
  images: {
    optimize: true,
    preset: 'docs',
    formats: ['avif', 'webp'],
    widths: [480, 768, 1280, 1920],
    quality: 82,
    lazy: true,
    svg: {
      minify: true
    }
  }
};
```

---

## 9. Build Cache & Deterministic Content Hashing

- All generated image variants receive deterministic content hashes (`[name].[hash].[width].[format]`).
- The build cache (`.docboot/images/`) tracks `sourceHash` + `configHash`. Unchanged images are reused across repeated builds in sub-milliseconds without recompressing.
- Unreferenced or deleted images are automatically pruned.

---

## 10. Health Checks (`docboot doctor`)

Run `docboot doctor` to validate your project's images:

```bash
$ docboot doctor
```

```text
  DOCUMENTATION HEALTH CHECK

  ✔ 42 documentation pages discovered & parsed
  ✔ 38 image references verified
  ✔ 38 optimized variants ready

  ⚠ [Large Source Image] docs/screens/dashboard.png (4280 × 2400, 5.1 MB)
  ⚠ [Large GIF] docs/demo.gif (8.4 MB) - Large animated GIFs impact page load performance.
```

Doctor flags:
- Missing image files
- Missing `alt` attributes (while respecting intentional decorative `alt=""`)
- Oversized source images (> 3000px or > 3MB)
- Large animated GIFs (> 5MB)
- Broken image references

---

## 11. Image Optimization Metrics (`docboot stats`)

Inspect image savings and variant breakdowns:

```bash
$ docboot stats
```

```text
  IMAGE OPTIMIZATION METRICS

  Sources          14
  Variants         42
  Original size    12.4 MB
  Optimized size    3.8 MB
  Saved            69.4%
```
