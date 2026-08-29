import { THEME_INIT_SCRIPT } from '../theme/theme-script.js';
import { escapeHtml } from '../markdown/highlighter.js';
import { withBase } from '../config/index.js';
import { renderAnalyticsHead } from './analytics.js';
import { renderPageMetaFooter, renderGlobalFooter } from './footer.js';

/**
 * Generates full standalone HTML page with modern, polished developer UI.
 * @param {object} params
 * @param {object} params.page Current page object { route, title, html, toc, frontmatter, ... }
 * @param {Array} params.pages All site pages
 * @param {Array} params.sidebar Hierarchical sidebar structure
 * @param {object} params.prevNext { prev, next }
 * @param {Array} params.breadcrumbs Array of breadcrumbs
 * @param {object} params.config Site configuration
 * @param {string} params.searchIndexUrl Hashed URL to search index JSON
 * @param {boolean} params.isDev Dev mode flag
 * @param {string|null} params.license Optional license string from package.json
 * @param {string|null} params.commit Optional Git commit SHA
 * @param {number|null} params.buildDuration Optional build duration in ms
 * @returns {string} Complete HTML string
 */
export function renderLayout({
  page,
  pages,
  sidebar,
  prevNext,
  breadcrumbs = [],
  config,
  searchIndexUrl = '/assets/search-index.json',
  isDev = false,
  license = null,
  commit = null,
  buildDuration = null
}) {
  const base = config.base || '/';
  const siteTitle = config.title || 'Documentation';
  const pageTitle = page.route === '/' ? siteTitle : `${page.title} — ${siteTitle}`;
  const pageDesc = page.frontmatter?.description || config.description || '';
  const canonicalUrl = config.siteUrl ? `${config.siteUrl.replace(/\/$/, '')}${withBase(page.route, base)}` : '';
  const githubRepo = config.repo || '';

  // Frontmatter Source Code Link Badge
  let sourceBadgeHtml = '';
  if (page.frontmatter?.source) {
    const rawSource = String(page.frontmatter.source).trim();
    const isFullUrl = rawSource.startsWith('http://') || rawSource.startsWith('https://');
    const sourceUrl = isFullUrl ? rawSource : (config.repo ? `${config.repo.replace(/\/$/, '')}/blob/main/${rawSource.replace(/^\/+/, '')}` : rawSource);
    const sourceText = rawSource;

    sourceBadgeHtml = `
<div class="not-prose my-3 flex items-center gap-2">
  <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted/70 hover:border-accent/40 text-xs font-mono text-muted-foreground hover:text-accent transition-all group">
    <svg class="w-3.5 h-3.5 text-accent/80 group-hover:text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
    <span>Source: <strong class="font-semibold text-foreground group-hover:text-accent">${escapeHtml(sourceText)}</strong></span>
    <svg class="w-3 h-3 text-muted-foreground/60 group-hover:text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
  </a>
</div>`;
  }

  // Page Bottom Metadata & Edit Links
  const pageMetaFooterHtml = renderPageMetaFooter({ page, config });
  const globalFooterHtml = renderGlobalFooter({ config, license, commit, buildDuration });
  const showThemeToggle = config.theme?.themeToggle !== false && config.theme?.allowModeSwitch !== false;
  const showPresetMenu = config.theme?.presetMenu !== false && config.theme?.allowPresetSwitch !== false && config.theme?.fontMenu !== false;
  const showFontSizeControl = config.theme?.fontSizeControl !== false && config.theme?.fontSizeSwitcher !== false;

  const sidebarHtml = renderSidebarHtml(sidebar, page.route, base);
  const tocHtml = renderTocHtml(page.toc || []);
  const breadcrumbsHtml = renderBreadcrumbsHtml(breadcrumbs, base);
  const prevNextHtml = renderPrevNextHtml(prevNext, base);

  return `<!DOCTYPE html>
<html lang="${escapeHtml(config.lang || 'en')}" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  ${pageDesc ? `<meta name="description" content="${escapeHtml(pageDesc)}">` : ''}
  ${canonicalUrl ? `<link rel="canonical" href="${canonicalUrl}">` : ''}
  
  <!-- Google Fonts Preconnect & Load -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" media="print" onload="this.media='all'">
  <noscript>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap">
  </noscript>

  <!-- Favicon & PWA -->
  <link rel="icon" type="image/svg+xml" href="${withBase('/favicon.svg', base)}">
  <link rel="manifest" href="${withBase('/manifest.webmanifest', base)}">
  <script>
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('${withBase('/sw.js', base)}').catch(function() {});
      });
    }
  </script>

  <!-- Open Graph / SEO -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  ${pageDesc ? `<meta property="og:description" content="${escapeHtml(pageDesc)}">` : ''}
  ${canonicalUrl ? `<meta property="og:url" content="${canonicalUrl}">` : ''}
  <meta name="twitter:card" content="summary_large_image">

  <!-- Anti-flash theme bootstrapper -->
  <script>${THEME_INIT_SCRIPT}</script>
  <script>
    window.__DOCBOOT_BASE__ = ${JSON.stringify(base)};
    window.__DOCBOOT_SEARCH_INDEX_URL__ = window.__EUIX_SEARCH_INDEX_URL__ = ${JSON.stringify(searchIndexUrl)};
    window.__DOCBOOT_SEARCH_CONFIG__ = window.__EUIX_SEARCH_CONFIG__ = ${JSON.stringify(config.search || {})};
    ${isDev ? 'window.__DOCBOOT_DEV__ = window.__EUIX_DEV__ = true;' : ''}
  </script>

  <!-- Stylesheet -->
  <link rel="stylesheet" href="${withBase('/assets/docs.css', base)}">

  <!-- Analytics -->
  ${renderAnalyticsHead(config)}
</head>
<body class="bg-background text-foreground min-h-screen flex flex-col antialiased selection:bg-accent/20 selection:text-accent font-sans">

  <!-- Accessible Skip Link -->
  <a href="#main-content" class="docboot-skip-link skip-link">Skip to main content</a>

  <!-- Screen Reader Live Announcer -->
  <div id="docboot-a11y-live" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>

  <!-- Header -->
  <header role="banner" class="sticky top-0 z-30 w-full border-b border-border/80 bg-background/80 backdrop-blur-xl transition-colors">
    <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
      
      <!-- Left: Mobile Toggle & Brand Logo -->
      <div class="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        <button id="docboot-mobile-toggle" type="button" class="docboot-mobile-toggle euix-mobile-toggle md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors" aria-label="Open navigation">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>

        <a href="${withBase('/', base)}" class="flex items-center gap-2.5 font-bold text-foreground tracking-tight text-sm sm:text-base hover:opacity-90 transition-opacity">
          <div class="w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent flex-shrink-0 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
              <path d="M8 7h8"/>
              <path d="M8 11h5"/>
            </svg>
          </div>
          <span class="bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text font-bold">${escapeHtml(siteTitle)}</span>
        </a>
      </div>

      <!-- Center: Desktop Command Palette Search Bar (Cmd+K) -->
      <div class="hidden sm:flex flex-1 max-w-md mx-2 sm:mx-4">
        <button type="button" class="docboot-search-trigger euix-search-trigger w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted/80 text-muted-foreground hover:border-accent/40 text-xs sm:text-sm transition-all shadow-xs group cursor-pointer">
          <div class="flex items-center gap-2.5">
            <svg class="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <span>Search documentation...</span>
          </div>
          <kbd class="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md border border-border bg-background text-[11px] font-mono text-muted-foreground shadow-xs group-hover:border-accent/40 transition-colors">
            <span class="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      <!-- Right: Action Links, Mobile Search Trigger & Theme Selector -->
      <div class="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        <!-- Mobile Search Icon Button -->
        <button type="button" class="docboot-search-trigger euix-search-trigger sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer" aria-label="Search documentation (Cmd+K)">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </button>

        ${githubRepo ? `
        <a href="${githubRepo}" target="_blank" rel="noopener noreferrer" class="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors" aria-label="GitHub Repository">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
        </a>` : ''}

        ${showPresetMenu ? `
        <!-- Theme Preset Color Palette Menu -->
        <div class="relative">
          <button id="docboot-preset-toggle" type="button" class="docboot-preset-toggle euix-preset-toggle p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer" aria-label="Change color theme palette">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>
          </button>
          
          <div id="docboot-preset-menu" class="docboot-preset-menu euix-preset-menu hidden absolute right-0 top-11 w-48 rounded-xl border border-border bg-card-bg shadow-xl p-1.5 z-50 text-xs backdrop-blur-xl">
            <div class="px-2.5 py-1 font-bold uppercase tracking-wider text-[10px] text-muted-foreground select-none">Theme Preset</div>
            <div class="space-y-0.5">
              <button type="button" data-preset="zinc" class="docboot-preset-btn euix-preset-btn w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted/70 text-left transition-colors cursor-pointer">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs"></span>
                  <span class="font-medium text-foreground">Zinc (Default)</span>
                </div>
                <svg class="preset-check w-3.5 h-3.5 text-accent hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              </button>
              <button type="button" data-preset="ocean" class="docboot-preset-btn euix-preset-btn w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted/70 text-left transition-colors cursor-pointer">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-xs"></span>
                  <span class="font-medium text-foreground">Ocean</span>
                </div>
                <svg class="preset-check w-3.5 h-3.5 text-accent hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              </button>
              <button type="button" data-preset="emerald" class="docboot-preset-btn euix-preset-btn w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted/70 text-left transition-colors cursor-pointer">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs"></span>
                  <span class="font-medium text-foreground">Emerald</span>
                </div>
                <svg class="preset-check w-3.5 h-3.5 text-accent hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              </button>
              <button type="button" data-preset="violet" class="docboot-preset-btn euix-preset-btn w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted/70 text-left transition-colors cursor-pointer">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-xs"></span>
                  <span class="font-medium text-foreground">Violet</span>
                </div>
                <svg class="preset-check w-3.5 h-3.5 text-accent hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              </button>
              <button type="button" data-preset="amber" class="docboot-preset-btn euix-preset-btn w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted/70 text-left transition-colors cursor-pointer">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs"></span>
                  <span class="font-medium text-foreground">Amber</span>
                </div>
                <svg class="preset-check w-3.5 h-3.5 text-accent hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              </button>
              <button type="button" data-preset="rose" class="docboot-preset-btn euix-preset-btn w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted/70 text-left transition-colors cursor-pointer">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs"></span>
                  <span class="font-medium text-foreground">Rose</span>
                </div>
                <svg class="preset-check w-3.5 h-3.5 text-accent hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              </button>
            </div>

            <!-- Reading Font Size Switcher -->
            <div class="border-t border-border/80 my-1 pt-1.5 px-1">
              <div class="px-1.5 py-1 font-bold uppercase tracking-wider text-[10px] text-muted-foreground select-none flex items-center justify-between">
                <span>Text Size</span>
                <span id="docboot-font-size-label" class="font-mono text-accent text-[10px] lowercase">base</span>
              </div>
              <div class="grid grid-cols-4 gap-1 p-0.5 bg-muted/40 rounded-lg border border-border/50">
                <button type="button" data-font-size="sm" class="docboot-font-size-btn py-1 text-center font-mono text-[11px] rounded hover:bg-muted/80 text-foreground transition-all cursor-pointer" title="Small (14px)">S</button>
                <button type="button" data-font-size="base" class="docboot-font-size-btn py-1 text-center font-mono text-[11px] rounded hover:bg-muted/80 text-foreground transition-all cursor-pointer" title="Default (16px)">M</button>
                <button type="button" data-font-size="lg" class="docboot-font-size-btn py-1 text-center font-mono text-[11px] rounded hover:bg-muted/80 text-foreground transition-all cursor-pointer" title="Large (18px)">L</button>
                <button type="button" data-font-size="xl" class="docboot-font-size-btn py-1 text-center font-mono text-[11px] rounded hover:bg-muted/80 text-foreground transition-all cursor-pointer" title="Extra Large (20px)">XL</button>
              </div>
            </div>

            <!-- Reading Font Family Switcher -->
            <div class="border-t border-border/80 my-1 pt-1.5 px-1">
              <div class="px-1.5 py-1 font-bold uppercase tracking-wider text-[10px] text-muted-foreground select-none flex items-center justify-between">
                <span>Font Family</span>
                <span id="docboot-font-family-label" class="font-mono text-accent text-[10px] lowercase">sans</span>
              </div>
              <div class="grid grid-cols-4 gap-1 p-0.5 bg-muted/40 rounded-lg border border-border/50">
                <button type="button" data-font-family="sans" class="docboot-font-family-btn py-1 text-center font-mono text-[11px] rounded hover:bg-muted/80 text-foreground transition-all cursor-pointer" title="Inter (Default Sans)">Sans</button>
                <button type="button" data-font-family="display" class="docboot-font-family-btn py-1 text-center font-mono text-[11px] rounded hover:bg-muted/80 text-foreground transition-all cursor-pointer" title="Outfit (Modern Display)">Outfit</button>
                <button type="button" data-font-family="serif" class="docboot-font-family-btn py-1 text-center font-serif text-[11px] rounded hover:bg-muted/80 text-foreground transition-all cursor-pointer" title="Serif (Editorial)">Serif</button>
                <button type="button" data-font-family="system" class="docboot-font-family-btn py-1 text-center font-sans text-[11px] rounded hover:bg-muted/80 text-foreground transition-all cursor-pointer" title="Native System Font">Sys</button>
              </div>
            </div>

          </div>
        </div>` : ''}

        ${showThemeToggle ? `
        <!-- Theme Toggle Button -->
        <button type="button" id="docboot-theme-toggle" class="docboot-theme-toggle euix-theme-toggle p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer" aria-label="Toggle color theme">
          <svg data-theme-icon="light" class="w-4 h-4 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          <svg data-theme-icon="dark" class="w-4 h-4 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
          <svg data-theme-icon="system" class="w-4 h-4 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        </button>` : ''}
      </div>

    </div>
  </header>

  <!-- Main Grid Layout -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex">
    
    <!-- Left Sidebar (Desktop) -->
    <aside id="docboot-sidebar-desktop" aria-label="Sidebar navigation" class="docboot-sidebar-desktop hidden md:block w-64 flex-shrink-0 border-r border-border/60 py-8 pr-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
      ${sidebarHtml}
    </aside>

    <!-- Main Content Column -->
    <main id="main-content" role="main" tabindex="-1" class="flex-1 min-w-0 py-8 md:px-8 lg:px-12 max-w-4xl focus:outline-none">
      <div class="flex items-center justify-between gap-4 mb-4">
        <div class="min-w-0 flex-1">
          ${breadcrumbsHtml}
        </div>
        ${showFontSizeControl ? `
        <div class="not-prose hidden sm:flex items-center gap-0.5 bg-muted/40 border border-border/70 rounded-lg p-0.5 text-xs text-muted-foreground select-none flex-shrink-0">
          <button type="button" class="docboot-font-step-btn px-2 py-0.5 rounded hover:bg-muted hover:text-foreground transition-colors cursor-pointer" data-step="-1" title="Decrease text size (A-)">
            <span class="text-[11px] font-bold">A-</span>
          </button>
          <span class="docboot-font-size-indicator px-1.5 font-mono text-[11px] text-foreground font-semibold">100%</span>
          <button type="button" class="docboot-font-step-btn px-2 py-0.5 rounded hover:bg-muted hover:text-foreground transition-colors cursor-pointer" data-step="1" title="Increase text size (A+)">
            <span class="text-[11px] font-bold">A+</span>
          </button>
        </div>` : ''}
      </div>
      ${sourceBadgeHtml}

      <article role="article" class="prose max-w-none">
        ${page.html}
      </article>

      ${pageMetaFooterHtml}
      ${prevNextHtml}
    </main>

    <!-- Right Sidebar (Table of Contents) -->
    ${tocHtml ? `
    <aside aria-label="Table of contents" class="hidden lg:block w-64 flex-shrink-0 py-8 pl-6 pr-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
      ${showFontSizeControl ? `
      <div class="pb-3 mb-3 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground select-none">
        <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Text size</span>
        <div class="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5 border border-border/60">
          <button type="button" class="docboot-font-step-btn px-2 py-0.5 text-[11px] font-bold rounded hover:bg-muted hover:text-foreground transition-colors cursor-pointer" data-step="-1" title="Smaller font (A-)">A-</button>
          <button type="button" class="docboot-font-step-btn px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-muted hover:text-accent transition-colors cursor-pointer docboot-font-size-indicator" data-step="0" title="Reset font size">100%</button>
          <button type="button" class="docboot-font-step-btn px-2 py-0.5 text-[11px] font-bold rounded hover:bg-muted hover:text-foreground transition-colors cursor-pointer" data-step="1" title="Larger font (A+)">A+</button>
        </div>
      </div>` : ''}

      <div class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-3.5 flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-accent/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/></svg>
        <span>On this page</span>
      </div>
      <nav aria-label="On this page">
        ${tocHtml}
      </nav>
    </aside>` : ''}

  </div>

  ${globalFooterHtml}

  <!-- Mobile Drawer Backdrop -->
  <div id="docboot-mobile-backdrop" class="docboot-mobile-backdrop euix-mobile-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden md:hidden"></div>

  <!-- Mobile Drawer -->
  <div id="docboot-mobile-drawer" class="docboot-mobile-drawer euix-mobile-drawer fixed inset-y-0 left-0 z-50 w-72 bg-sidebar-bg border-r border-border p-6 overflow-y-auto transform -translate-x-full transition-transform duration-200 ease-in-out md:hidden shadow-2xl">
    <div class="flex items-center justify-between pb-4 mb-4 border-b border-border">
      <div class="flex items-center gap-2.5 font-bold text-foreground">
        <div class="w-6 h-6 rounded-lg bg-accent text-accent-foreground flex items-center justify-center font-bold text-xs" aria-hidden="true">▲</div>
        <span>${escapeHtml(siteTitle)}</span>
      </div>
      <button id="docboot-mobile-close" type="button" class="docboot-mobile-close euix-mobile-close p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Close navigation">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    ${sidebarHtml}
  </div>

  <!-- Command Palette Search Modal (Cmd+K) -->
  <div id="docboot-search-modal" role="dialog" aria-modal="true" aria-label="Search documentation" class="docboot-search-modal euix-search-modal fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20 hidden">
    <div id="docboot-search-backdrop" class="docboot-search-backdrop euix-search-backdrop fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"></div>
    <div class="relative mx-auto max-w-2xl rounded-2xl border border-border/80 bg-card-bg shadow-2xl overflow-hidden text-foreground ring-1 ring-white/10">
      <div class="flex items-center border-b border-border/80 px-4 sm:px-5 py-3.5 bg-muted/20 transition-colors focus-within:bg-muted/40">
        <svg class="w-5 h-5 text-accent mr-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="docboot-search-input" type="text" placeholder="Search documentation..." aria-label="Search documentation" aria-autocomplete="list" aria-controls="docboot-search-results" class="docboot-search-input euix-search-input w-full bg-transparent text-base sm:text-[16px] font-normal leading-normal text-foreground placeholder:text-muted-foreground/60 border-0 outline-none ring-0 shadow-none focus:outline-none focus:ring-0" autocomplete="off" spellcheck="false" />
        <button type="button" id="docboot-search-clear" class="hidden p-1 mr-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer" aria-label="Clear search query">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <kbd class="px-2 py-0.5 rounded-md border border-border/80 text-[11px] text-muted-foreground font-mono bg-muted/60 shadow-2xs select-none" aria-label="Escape key to close">ESC</kbd>
      </div>
      <div id="docboot-search-results" role="listbox" aria-label="Search results" class="docboot-search-results euix-search-results max-h-96 overflow-y-auto divide-y divide-border/40 p-2">
        <div class="py-12 px-6 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2 select-none">
          <svg class="w-8 h-8 text-muted-foreground/40 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <span class="font-medium text-foreground/80">Search documentation</span>
          <span class="text-xs text-muted-foreground/70">Type keywords, topics, or CLI commands</span>
        </div>
      </div>
      <div class="px-4 py-2.5 border-t border-border/80 bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground select-none">
        <div class="flex items-center gap-3">
          <span><kbd class="px-1.5 py-0.5 rounded border border-border/80 bg-card-bg shadow-2xs">↑</kbd> <kbd class="px-1.5 py-0.5 rounded border border-border/80 bg-card-bg shadow-2xs">↓</kbd> to navigate</span>
          <span><kbd class="px-1.5 py-0.5 rounded border border-border/80 bg-card-bg shadow-2xs">↵</kbd> to select</span>
        </div>
        <span><kbd class="px-1.5 py-0.5 rounded border border-border/80 bg-card-bg shadow-2xs">ESC</kbd> to close</span>
      </div>
    </div>
  </div>

  <!-- SVG Filters for QA Color Blindness Simulation -->
  <svg class="sr-only" aria-hidden="true" style="position: absolute; width: 0; height: 0;">
    <defs>
      <filter id="docboot-protanopia"><feColorMatrix type="matrix" values="0.567, 0.433, 0, 0, 0 0.558, 0.442, 0, 0, 0 0, 0.242, 0.758, 0, 0 0, 0, 0, 1, 0"/></filter>
      <filter id="docboot-deuteranopia"><feColorMatrix type="matrix" values="0.625, 0.375, 0, 0, 0 0.7, 0.3, 0, 0, 0 0, 0.3, 0.7, 0, 0 0, 0, 0, 1, 0"/></filter>
      <filter id="docboot-tritanopia"><feColorMatrix type="matrix" values="0.95, 0.05, 0, 0, 0 0, 0.433, 0.567, 0, 0 0, 0.475, 0.525, 0, 0 0, 0, 0, 1, 0"/></filter>
    </defs>
  </svg>

  <!-- Scripts -->
  <script src="${withBase('/assets/docs.js', base)}"></script>
</body>
</html>`;
}

function renderSidebarHtml(sidebar, currentRoute, base = '/') {
  let html = '<nav aria-label="Main documentation navigation" class="space-y-6 text-sm">';

  for (const group of sidebar) {
    html += '<div class="space-y-1">';
    if (group.title) {
      html += `<div class="font-bold text-[11px] uppercase tracking-wider text-muted-foreground/70 px-3 py-2 select-none">${escapeHtml(group.title)}</div>`;
    }
    html += '<ul class="space-y-1" role="list">';
    for (const item of group.items) {
      const isActive = item.route === currentRoute;
      const activeClass = isActive
        ? 'bg-accent/10 text-accent font-semibold relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-accent'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium';

      html += `
        <li>
          <a href="${withBase(item.route, base)}" aria-current="${isActive ? 'page' : 'false'}" class="block px-3 py-1.5 rounded-lg text-[13px] transition-all ${activeClass}">
            ${escapeHtml(item.title)}
          </a>
        </li>`;
    }
    html += '</ul></div>';
  }

  html += '</nav>';
  return html;
}

function renderTocHtml(toc) {
  if (!toc || toc.length === 0) return '';

  let html = '<ul class="space-y-0.5 text-[13px] border-l border-border/60 pl-2 font-normal" role="list">';
  for (const item of toc) {
    const indent = item.level === 3 ? 'pl-3' : '';
    html += `
      <li>
        <a href="#${item.id}" class="euix-toc-link block py-1.5 text-muted-foreground hover:text-foreground transition-colors ${indent}" data-toc-id="${item.id}">
          ${escapeHtml(item.title)}
        </a>
      </li>`;
  }
  html += '</ul>';
  return html;
}

function renderBreadcrumbsHtml(breadcrumbs, base = '/') {
  if (!breadcrumbs || breadcrumbs.length <= 1) return '';

  let html = '<nav class="flex items-center gap-2 text-xs text-muted-foreground mb-8" aria-label="Breadcrumb">';
  html += `<a href="${withBase('/', base)}" class="hover:text-foreground transition-colors flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>Docs</a>`;

  for (const crumb of breadcrumbs) {
    html += '<span class="text-border">/</span>';
    if (crumb.isCurrent) {
      html += `<span class="text-foreground font-medium">${escapeHtml(crumb.title)}</span>`;
    } else {
      html += `<a href="${withBase(crumb.route, base)}" class="hover:text-foreground transition-colors">${escapeHtml(crumb.title)}</a>`;
    }
  }

  html += '</nav>';
  return html;
}

function renderPrevNextHtml(prevNext, base = '/') {
  if (!prevNext || (!prevNext.prev && !prevNext.next)) return '';

  return `
<div class="mt-16 pt-8 border-t border-border/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
  ${prevNext.prev ? `
  <a href="${withBase(prevNext.prev.route, base)}" class="group flex flex-col p-4 rounded-xl border border-border/80 hover:border-accent/40 hover:bg-muted/40 transition-all text-left">
    <span class="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
      <svg class="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      Previous
    </span>
    <span class="text-sm font-semibold text-foreground mt-1 group-hover:text-accent transition-colors">${escapeHtml(prevNext.prev.title)}</span>
  </a>` : '<div></div>'}

  ${prevNext.next ? `
  <a href="${withBase(prevNext.next.route, base)}" class="group flex flex-col p-4 rounded-xl border border-border/80 hover:border-accent/40 hover:bg-muted/40 transition-all text-right">
    <span class="text-[11px] text-muted-foreground font-medium flex items-center justify-end gap-1.5">
      Next
      <svg class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
    </span>
    <span class="text-sm font-semibold text-foreground mt-1 group-hover:text-accent transition-colors">${escapeHtml(prevNext.next.title)}</span>
  </a>` : '<div></div>'}
</div>`;
}
