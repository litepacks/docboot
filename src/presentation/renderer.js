import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from '../markdown/highlighter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Presentation Styles & Runtime
const presentationCssPath = path.resolve(__dirname, 'styles.css');
const presentationRuntimePath = path.resolve(__dirname, 'runtime.js');

/**
 * Renders a full HTML presentation document from a compiled presentation deck.
 *
 * @param {object} deck Normalized Presentation Deck from compilePresentation()
 * @param {object} options
 * @param {string} options.css Additional compiled CSS (Tailwind/Tokens)
 * @param {string} options.base Base URL
 * @returns {string} Full HTML document
 */
export function renderPresentation(deck, options = {}) {
  const base = options.base || '/';
  const customCss = options.css || '';
  const presentationCss = fs.readFileSync(presentationCssPath, 'utf-8');
  const presentationRuntime = fs.readFileSync(presentationRuntimePath, 'utf-8');

  const title = deck.title || 'Docboot Presentation';
  const preset = deck.preset || 'zinc';
  const themeClass = deck.theme === 'dark' ? 'dark' : '';
  const ratio = deck.ratio || '16:9';

  // Compute aspect ratio CSS variable
  let aspectRatioVal = '16 / 9';
  if (ratio === '4:3') aspectRatioVal = '4 / 3';
  if (ratio === '16:10') aspectRatioVal = '16 / 10';

  // Render individual slide sections
  const slidesHtml = deck.slides.map((slide, i) => {
    const isFirst = i === 0;
    const activeClass = isFirst ? ' active' : '';
    const layoutClass = ` slide-layout-${slide.layout || 'default'}`;
    const customClass = slide.customClass ? ` ${slide.customClass}` : '';

    let inlineStyles = [];
    if (slide.background) {
      inlineStyles.push(`background-image: url('${slide.background}')`);
      inlineStyles.push('background-size: cover');
      inlineStyles.push('background-position: center');
    }
    if (slide.backgroundColor) {
      inlineStyles.push(`background-color: ${slide.backgroundColor}`);
    }
    const styleAttr = inlineStyles.length > 0 ? ` style="${inlineStyles.join('; ')}"` : '';

    return `
      <section
        id="${slide.id}"
        class="docboot-slide${activeClass}${layoutClass}${customClass}"
        data-index="${slide.index}"
        data-notes="${escapeHtml(slide.notes || '')}"
        aria-hidden="${isFirst ? 'false' : 'true'}"
        ${styleAttr}
      >
        ${slide.html}
      </section>
    `.trim();
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en" class="${themeClass}" data-theme="${preset}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="Docboot Presentation — ${escapeHtml(title)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --slide-aspect-ratio: ${aspectRatioVal};
    }
    ${customCss}
    ${presentationCss}
  </style>
</head>
<body>
  <div class="docboot-presentation-viewport">
    <div class="docboot-slide-stage">
      ${slidesHtml}
      ${deck.progress ? '<div id="docboot-presentation-progress" class="docboot-progress-bar" style="width: 0%;"></div>' : ''}
    </div>

    <!-- Floating Navigation Controls -->
    <nav class="docboot-presentation-controls" aria-label="Presentation Navigation">
      <button id="docboot-btn-prev" class="docboot-control-btn" title="Previous slide (Left Arrow)" aria-label="Previous slide">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </button>
      ${deck.slideNumber ? '<span id="docboot-presentation-counter" class="docboot-slide-counter" aria-live="polite">1 / ' + deck.slideCount + '</span>' : ''}
      <button id="docboot-btn-next" class="docboot-control-btn" title="Next slide (Right Arrow / Space)" aria-label="Next slide">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </button>
      <button id="docboot-btn-fullscreen" class="docboot-control-btn" title="Toggle Fullscreen (F)" aria-label="Toggle Fullscreen">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
      </button>
      <button id="docboot-btn-presenter" class="docboot-control-btn" title="Presenter View (P)" aria-label="Presenter View">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
      </button>
      <button id="docboot-btn-theme" class="docboot-control-btn" title="Toggle Theme (T)" aria-label="Toggle Theme">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
      </button>
    </nav>
  </div>

  <!-- Presenter Mode View Modal (P) -->
  <div id="docboot-presenter-view" aria-label="Presenter Mode" role="dialog" aria-modal="true">
    <header class="docboot-presenter-top-bar">
      <div style="font-weight: 700; font-size: 1.1rem; color: #f0f6fc;">
        Docboot Presenter Mode — <span style="color: #8b949e;">${escapeHtml(title)}</span>
      </div>
      <div class="docboot-presenter-timer">
        <span>⏱ <span id="docboot-presenter-timer-display">00:00</span></span>
        <button id="docboot-timer-btn-start" class="docboot-control-btn" style="background:#238636;color:#fff;width:auto;padding:0 0.6rem;font-size:0.75rem;">Start</button>
        <button id="docboot-timer-btn-pause" class="docboot-control-btn" style="background:#d29922;color:#000;width:auto;padding:0 0.6rem;font-size:0.75rem;">Pause</button>
        <button id="docboot-timer-btn-reset" class="docboot-control-btn" style="background:#da3633;color:#fff;width:auto;padding:0 0.6rem;font-size:0.75rem;">Reset</button>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;">
        <span id="docboot-presenter-counter-display" style="font-family:monospace;font-weight:700;color:#58a6ff;">1 / ${deck.slideCount}</span>
        <button id="docboot-presenter-btn-close" class="docboot-control-btn" style="background:#21262d;color:#f0f6fc;" title="Exit Presenter Mode (Esc)">✕</button>
      </div>
    </header>

    <main class="docboot-presenter-main-grid">
      <div class="docboot-presenter-card">
        <div class="docboot-presenter-card-header">Current Slide</div>
        <div id="docboot-presenter-current" class="docboot-presenter-current-slide-preview"></div>
      </div>
      <div class="docboot-presenter-card">
        <div class="docboot-presenter-card-header">Next Slide</div>
        <div id="docboot-presenter-next" class="docboot-presenter-next-slide-preview"></div>
      </div>
      <div class="docboot-presenter-card">
        <div class="docboot-presenter-card-header">Speaker Notes</div>
        <div id="docboot-presenter-notes" class="docboot-presenter-notes-container"></div>
      </div>
    </main>
  </div>

  <script>
    ${presentationRuntime}
  </script>
</body>
</html>`;
}
