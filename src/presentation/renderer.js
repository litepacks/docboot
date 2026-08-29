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
        data-h="${slide.hIndex}"
        data-v="${slide.vIndex}"
        data-v-count="${slide.vCount}"
        data-display-index="${slide.displayIndex}"
        data-title="${escapeHtml(slide.title || `Slide ${slide.displayIndex}`)}"
        data-notes="${escapeHtml(slide.notes || '')}"
        aria-hidden="${isFirst ? 'false' : 'true'}"
        ${styleAttr}
      >
        ${slide.html}
      </section>
    `.trim();
  }).join('\n');

  // Render Overview cards
  const overviewCardsHtml = deck.slides.map((slide) => {
    return `
      <div class="docboot-overview-card" data-jump-slide="${slide.index}">
        <span class="docboot-overview-card-badge">#${slide.displayIndex}</span>
        <div class="docboot-overview-card-title">${escapeHtml(slide.title || `Slide ${slide.displayIndex}`)}</div>
      </div>
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
    <div class="docboot-stage-glow"></div>
    <div class="docboot-slide-stage">
      ${slidesHtml}
      <div id="docboot-vertical-nav" class="docboot-vertical-nav" style="display:none;" aria-label="Vertical Slide Navigation"></div>
      ${deck.progress ? '<div id="docboot-presentation-progress" class="docboot-progress-bar" style="width: 0%;"></div>' : ''}
    </div>

    <!-- Laser Pointer & Drawing Pen Overlays -->
    <div id="docboot-laser-pointer"></div>
    <canvas id="docboot-drawing-canvas"></canvas>
    <div id="docboot-drawing-toolbar" class="docboot-drawing-toolbar">
      <span style="font-size:0.75rem;font-weight:700;color:#8b949e;text-transform:uppercase;margin-right:0.25rem;">Ink</span>
      <button class="docboot-color-picker-btn selected" style="background:#ef4444;" data-color="#ef4444" title="Red"></button>
      <button class="docboot-color-picker-btn" style="background:#3b82f6;" data-color="#3b82f6" title="Blue"></button>
      <button class="docboot-color-picker-btn" style="background:#10b981;" data-color="#10b981" title="Green"></button>
      <button class="docboot-color-picker-btn" style="background:#eab308;" data-color="#eab308" title="Yellow"></button>
      <button id="docboot-draw-btn-clear" class="docboot-control-btn" style="width:auto;height:1.6rem;padding:0 0.5rem;font-size:0.75rem;background:#21262d;color:#f0f6fc;margin-left:0.35rem;" title="Clear ink (C)">Clear</button>
      <button id="docboot-draw-btn-close" class="docboot-control-btn" style="width:1.6rem;height:1.6rem;font-size:0.75rem;background:#21262d;color:#f0f6fc;" title="Close Draw (D)">✕</button>
    </div>

    <!-- Floating Navigation Controls Dock -->
    <nav class="docboot-presentation-controls" aria-label="Presentation Navigation">
      <button id="docboot-btn-prev" class="docboot-control-btn" data-tooltip="Previous [←]" aria-label="Previous slide">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </button>
      ${deck.slideNumber ? '<span id="docboot-presentation-counter" class="docboot-slide-counter" aria-live="polite">1 / ' + deck.slideCount + '</span>' : ''}
      <button id="docboot-btn-next" class="docboot-control-btn" data-tooltip="Next [→ / Space]" aria-label="Next slide">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </button>
      <button id="docboot-btn-laser" class="docboot-control-btn" data-tooltip="Laser Pointer [L]" aria-label="Laser Pointer">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="3" fill="currentColor"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2v3m0 14v3m10-10h-3M5 12H2m15.07-7.07l-2.12 2.12M9.05 14.95l-2.12 2.12m0-10.14l2.12 2.12m5.9 5.9l2.12 2.12"/></svg>
      </button>
      <button id="docboot-btn-draw" class="docboot-control-btn" data-tooltip="Draw / Pen [D]" aria-label="Draw Pen">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
      </button>
      <button id="docboot-btn-overview" class="docboot-control-btn" data-tooltip="Overview [O]" aria-label="Slide Overview">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
      </button>
      <button id="docboot-btn-fullscreen" class="docboot-control-btn" data-tooltip="Fullscreen [F]" aria-label="Toggle Fullscreen">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
      </button>
      <button id="docboot-btn-presenter" class="docboot-control-btn" data-tooltip="Presenter [P]" aria-label="Presenter View">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
      </button>
      <button id="docboot-btn-help" class="docboot-control-btn" data-tooltip="Shortcuts [?]" aria-label="Keyboard Shortcuts">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      </button>
      <button id="docboot-btn-theme" class="docboot-control-btn" data-tooltip="Theme [T]" aria-label="Toggle Theme">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
      </button>
    </nav>
  </div>

  <!-- Slide Overview Grid Modal (O / G) -->
  <div id="docboot-overview-modal" aria-label="Slide Overview" role="dialog" aria-modal="true">
    <header class="docboot-overview-header">
      <div class="docboot-overview-title">
        <span>Slide Overview</span>
        <span style="font-size: 0.9rem; color: #8b949e; font-weight: 500;">(${deck.slideCount} slides)</span>
      </div>
      <button id="docboot-overview-btn-close" class="docboot-control-btn" style="background:#21262d;color:#f0f6fc;width:2.2rem;height:2.2rem;" title="Close (Esc)">✕</button>
    </header>
    <div class="docboot-overview-grid">
      ${overviewCardsHtml}
    </div>
  </div>

  <!-- Keyboard Shortcuts Cheat-Sheet Modal (?) -->
  <div id="docboot-help-modal" aria-label="Keyboard Shortcuts" role="dialog" aria-modal="true">
    <div class="docboot-help-dialog">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;">
        <h3 style="margin:0;font-size:1.15rem;font-weight:700;color:#f0f6fc;">Keyboard Shortcuts</h3>
        <button id="docboot-help-btn-close" class="docboot-control-btn" style="background:#21262d;color:#f0f6fc;" title="Close (Esc)">✕</button>
      </div>
      <div class="docboot-help-row"><span>Next slide / Reveal Fragment</span><div><kbd class="docboot-key-badge">→</kbd> <kbd class="docboot-key-badge">Space</kbd> <kbd class="docboot-key-badge">N</kbd></div></div>
      <div class="docboot-help-row"><span>Previous slide / Hide Fragment</span><div><kbd class="docboot-key-badge">←</kbd> <kbd class="docboot-key-badge">P</kbd> <kbd class="docboot-key-badge">H</kbd></div></div>
      <div class="docboot-help-row"><span>Vertical Sub-slides / Scroll</span><div><kbd class="docboot-key-badge">↓</kbd> <kbd class="docboot-key-badge">↑</kbd> <kbd class="docboot-key-badge">J</kbd> <kbd class="docboot-key-badge">K</kbd></div></div>
      <div class="docboot-help-row"><span>Laser Pointer</span><div><kbd class="docboot-key-badge">L</kbd></div></div>
      <div class="docboot-help-row"><span>Draw Pen / Clear Drawing</span><div><kbd class="docboot-key-badge">D</kbd> <kbd class="docboot-key-badge">C</kbd></div></div>
      <div class="docboot-help-row"><span>Slide Overview Grid</span><div><kbd class="docboot-key-badge">O</kbd> <kbd class="docboot-key-badge">G</kbd></div></div>
      <div class="docboot-help-row"><span>Presenter View</span><div><kbd class="docboot-key-badge">P</kbd></div></div>
      <div class="docboot-help-row"><span>Toggle Fullscreen</span><div><kbd class="docboot-key-badge">F</kbd></div></div>
      <div class="docboot-help-row"><span>Toggle Theme</span><div><kbd class="docboot-key-badge">T</kbd></div></div>
      <div class="docboot-help-row"><span>Print to PDF</span><div><kbd class="docboot-key-badge">Cmd/Ctrl + P</kbd></div></div>
    </div>
  </div>

  <!-- Presenter Mode View Modal (P) -->
  <div id="docboot-presenter-view" aria-label="Presenter Mode" role="dialog" aria-modal="true">
    <header class="docboot-presenter-top-bar">
      <div style="font-weight: 700; font-size: 1.1rem; color: #f0f6fc; display: flex; items-center; gap: 0.75rem;">
        <span class="docboot-timer-pulse-dot" style="align-self:center;"></span>
        <span>Presenter Console — <span style="color: #8b949e; font-weight: 500;">${escapeHtml(title)}</span></span>
      </div>
      <div class="docboot-presenter-timer">
        <span>⏱ <span id="docboot-presenter-timer-display">00:00</span></span>
        <button id="docboot-timer-btn-start" class="docboot-control-btn" style="background:#238636;color:#fff;width:auto;padding:0 0.75rem;font-size:0.75rem;font-weight:600;">Start</button>
        <button id="docboot-timer-btn-pause" class="docboot-control-btn" style="background:#d29922;color:#000;width:auto;padding:0 0.75rem;font-size:0.75rem;font-weight:600;">Pause</button>
        <button id="docboot-timer-btn-reset" class="docboot-control-btn" style="background:#da3633;color:#fff;width:auto;padding:0 0.75rem;font-size:0.75rem;font-weight:600;">Reset</button>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <button id="docboot-presenter-btn-popout" class="docboot-control-btn" style="background:#21262d;color:#58a6ff;width:auto;padding:0 0.75rem;font-size:0.75rem;font-weight:600;" title="Open in popout window">Popout ↗</button>
        <span id="docboot-presenter-counter-display" style="font-family:monospace;font-weight:700;color:#38bdf8;">1 / ${deck.slideCount}</span>
        <button id="docboot-presenter-btn-close" class="docboot-control-btn" style="background:#21262d;color:#f0f6fc;" title="Exit Presenter Mode (Esc)">✕</button>
      </div>
    </header>

    <main class="docboot-presenter-main-grid">
      <div class="docboot-presenter-card">
        <div class="docboot-presenter-card-header">
          <span>Current Slide</span>
          <span style="font-size: 0.75rem; color: #38bdf8;">Live Audience View</span>
        </div>
        <div id="docboot-presenter-current" class="docboot-presenter-current-slide-preview"></div>
      </div>
      <div class="docboot-presenter-card">
        <div class="docboot-presenter-card-header">
          <span>Next Slide</span>
          <span style="font-size: 0.75rem; color: #8b949e;">Upcoming</span>
        </div>
        <div id="docboot-presenter-next" class="docboot-presenter-next-slide-preview"></div>
      </div>
      <div class="docboot-presenter-card">
        <div class="docboot-presenter-card-header">
          <span>Speaker Notes</span>
          <div style="display:flex;gap:0.35rem;">
            <button id="docboot-notes-btn-dec" class="docboot-control-btn" style="width:1.6rem;height:1.6rem;font-size:0.75rem;background:#21262d;color:#fff;">A-</button>
            <button id="docboot-notes-btn-inc" class="docboot-control-btn" style="width:1.6rem;height:1.6rem;font-size:0.75rem;background:#21262d;color:#fff;">A+</button>
          </div>
        </div>
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
