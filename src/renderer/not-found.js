import { escapeHtml } from '../markdown/highlighter.js';
import { renderLayout } from './layout.js';
import { formatSegmentName } from '../routes/tree.js';

/**
 * Generates a beautiful, developer-friendly 404 Not Found page.
 * @param {object} params
 * @returns {string} Full HTML markup for 404 page
 */
export function renderNotFoundPage({ pages = [], sidebar = [], config = {}, searchIndexUrl = '', isDev = false }) {
  // Curate top suggested pages (up to 6)
  const suggestedPages = pages
    .filter(p => p.route !== '/' && p.route !== '/404' && !p.frontmatter?.draft)
    .sort((a, b) => {
      const orderA = a.frontmatter?.order ?? 999;
      const orderB = b.frontmatter?.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    })
    .slice(0, 6);

  const notFoundHtml = `
<div class="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-12 sm:py-16 max-w-4xl mx-auto">
  <!-- Glowing 404 Badge -->
  <div class="relative mb-6">
    <div class="absolute -inset-4 bg-gradient-to-r from-accent/20 via-sky-500/20 to-indigo-500/20 rounded-full blur-2xl opacity-60"></div>
    <div class="relative px-4 py-1.5 rounded-full border border-border/80 bg-muted/50 text-xs font-mono font-bold tracking-widest text-accent uppercase select-none shadow-xs">
      404 Error
    </div>
  </div>

  <h1 class="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground mb-4">
    Page Not Found
  </h1>

  <p class="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
    Sorry, the documentation page you are looking for doesn't exist, has been moved, or the link is broken.
  </p>

  <!-- Action Buttons -->
  <div class="flex flex-wrap items-center justify-center gap-3.5 mb-14">
    <a href="/" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:opacity-90 !text-white font-semibold text-sm shadow-md shadow-accent/25 hover:shadow-lg hover:shadow-accent/30 transition-all cursor-pointer">
      <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
      </svg>
      <span class="text-white font-semibold">Back to Home</span>
    </a>

    <button type="button" class="docboot-search-trigger euix-search-trigger inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border/80 bg-card-bg hover:bg-muted/60 text-foreground font-semibold text-sm transition-all shadow-xs cursor-pointer">
      <svg class="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <span>Search Docs</span>
      <kbd class="hidden sm:inline-block ml-1 px-1.5 py-0.5 rounded border border-border/60 text-[10px] text-muted-foreground font-mono bg-muted/40">⌘K</kbd>
    </button>
  </div>

  ${suggestedPages.length > 0 ? `
  <!-- Popular Suggested Documentation Links -->
  <div class="w-full pt-10 border-t border-border/60 text-left">
    <div class="flex items-center justify-between mb-5 select-none">
      <h3 class="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        Suggested Documentation Pages
      </h3>
      <span class="text-xs text-muted-foreground/60 hidden sm:inline-block">Quick navigation</span>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      ${suggestedPages.map(p => {
        const segments = p.route.split('/').filter(Boolean);
        const sectionName = segments.length > 1 ? formatSegmentName(segments[0]) : (p.frontmatter?.category || 'Docs');
        const desc = p.frontmatter?.description || (p.plainText ? p.plainText.slice(0, 110).replace(/^[#\s]+/, '').trim() + '...' : '');

        return `
      <a href="${p.route}" class="group relative flex flex-col justify-between p-4 rounded-2xl border border-border/70 bg-card-bg/50 hover:bg-card-bg hover:border-accent/40 shadow-xs hover:shadow-md transition-all">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/50">
              ${escapeHtml(sectionName)}
            </span>
            <svg class="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
          <h4 class="text-sm font-semibold text-foreground group-hover:text-accent transition-colors leading-snug">
            ${escapeHtml(p.title)}
          </h4>
          ${desc ? `<p class="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">${escapeHtml(desc)}</p>` : ''}
        </div>
      </a>
      `;
      }).join('')}
    </div>
  </div>
  ` : ''}
</div>
`;

  const synthetic404Page = {
    relativePath: '404.md',
    route: '/404',
    title: '404: Page Not Found',
    frontmatter: {
      title: 'Page Not Found — 404',
      description: 'The requested documentation page could not be found.'
    },
    toc: [],
    headings: [],
    html: notFoundHtml
  };

  return renderLayout({
    page: synthetic404Page,
    pages,
    sidebar,
    prevNext: { prev: null, next: null },
    breadcrumbs: [],
    config,
    searchIndexUrl,
    isDev
  });
}
