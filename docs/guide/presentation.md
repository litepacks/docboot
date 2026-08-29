---
title: Presentation Mode
description: Write Markdown once, present it as responsive slides with speaker notes, live reload, and static deployment.
order: 6
---

# Presentation Mode

Docboot includes a native, zero-dependency slide presentation mode. It reuses the exact same Markdown compiler, syntax highlighting, Mermaid diagram renderer, callouts, and theme tokens to turn any Markdown file into a presentation deck.

```bash
docboot present talk.md
```

---

## Slide Separation

### 1. Horizontal Rule (`---`)
Insert `---` on its own line between slide blocks:

```markdown
# Docboot

Zero-config docs and presentations.

---

## Architecture

Markdown → Compiler → Static HTML
```

### 2. Explicit Slide Directive (`:::slide`)
Use `:::slide` with optional layout and background attributes:

```markdown
:::slide layout="center" background="./images/cover.jpg"
# Main Title
Welcome to the talk.
:::
```

### 3. Vertical Sub-Slides (`--` or `:::vslide`)
For deep-dives, detailed steps, or long sections, use `--` on its own line (or `:::vslide`) to create **vertical sub-slides** under the same main topic:

```markdown
# 1. Architecture Overview (Slide 1.1)

High-level system design.

--

## 1.1 Compiler Pipeline (Slide 1.2)

Deep dive into Markdown compilation.

--

## 1.2 Theme Pipeline (Slide 1.3)

Deep dive into CSS tokens and Tailwind v4.

---

# 2. Performance (Slide 2.1)

Next horizontal chapter.
```

- **`ArrowRight` / `ArrowLeft`**: Navigate between top-level chapters (`1.x` $\leftrightarrow$ `2.x`).
- **`ArrowDown` / `ArrowUp`**: Navigate between vertical sub-slides (`1.1` $\leftrightarrow$ `1.2` $\leftrightarrow$ `1.3`).
- **Vertical Indicator Dots**: A dynamic indicator appears on the right edge showing vertical depth (`● ○ ○`).
- **Smooth Auto-Scroll**: For slides with long content, pressing `ArrowDown` first smoothly scrolls down within the slide, then advances to the next sub-slide!

### 4. Split Column Layout
Create two-column slides using `::left` and `::right`:

```markdown
:::slide layout="split"

## Core Features

::left
- Zero configuration
- Instant start
- Local search

::right
- Syntax highlighting
- Mermaid diagrams
- Presenter view
:::
```

---

## Speaker Notes (`:::notes`)

Speaker notes are extracted and only visible in **Presenter Mode** (`P` key):

```markdown
## Technical Architecture

Here is the visible slide content.

:::notes
- Emphasize the build-time parallelization.
- Mention zero third-party client dependencies.
:::
```

---

## Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| **`Right Arrow`** / **`Space`** / **`PageDown`** / **`N`** | Next slide |
| **`Left Arrow`** / **`PageUp`** / **`H`** / **`P`** | Previous slide |
| **`Home`** / **`End`** | Jump to first / last slide |
| **`F`** | Toggle Fullscreen |
| **`P`** | Toggle Presenter View (notes, timer & preview) |
| **`T`** | Toggle Dark / Light Theme |
| **`Esc`** | Close Presenter View or Fullscreen |

---

## Presenter View (`P` or `?presenter=1`)

Pressing **`P`** opens a dual-pane presenter interface:
- **Current Slide**: Displays what the audience sees.
- **Next Slide**: Upcoming slide preview.
- **Speaker Notes**: Large legible notes pane for speech delivery.
- **Stopwatch Timer**: Local presentation timer with `Start`, `Pause`, and `Reset` controls.

---

## Static Build & Deployment

Export your presentation as a standalone static bundle:

```bash
docboot present build talk.md
```

Outputs a self-contained `dist-presentation/index.html` that can be deployed to GitHub Pages, Netlify, Vercel, or any static hosting service.

---

## Printing & PDF Export

Docboot includes dedicated `@media print` rules. Press **`Cmd + P`** (or **`Ctrl + P`**) in your browser:
- Each slide renders on a clean 16:9 page.
- Controls, progress bars, and presenter panes are automatically hidden.
- Choose **"Save as PDF"** for zero-dependency slide decks.
