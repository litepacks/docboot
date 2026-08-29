import { formatDate } from '../metadata/git.js';
import { escapeHtml } from '../markdown/highlighter.js';
import { COMPILER_VERSION } from '../cache/index.js';

/**
 * Renders the compact page-level metadata footer (Created, Updated, Edit Link).
 * 
 * @param {object} params
 * @param {object} params.page Page object with metadata and git info
 * @param {object} params.config Docboot configuration
 * @returns {string} HTML string or empty if no metadata
 */
export function renderPageMetaFooter({ page, config }) {
  const footerConfig = config.footer || {};
  if (footerConfig.pageMeta === false) return '';

  const showCreated = footerConfig.created !== false;
  const showUpdated = footerConfig.updated !== false;
  const showEditLink = footerConfig.editLink !== false && page.frontmatter?.editLink !== false && page.frontmatter?.editUrl !== false;

  // Resolve dates with frontmatter priority
  const rawCreated = page.frontmatter?.created || page.frontmatter?.createdAt || (showCreated ? page.git?.createdAt : null);
  const rawUpdated = page.frontmatter?.updated || page.frontmatter?.updatedAt || (showUpdated ? page.git?.updatedAt : null);

  const formattedCreated = showCreated && rawCreated ? formatDate(rawCreated) : null;
  const formattedUpdated = showUpdated && rawUpdated ? formatDate(rawUpdated) : null;

  const dateItems = [];

  if (formattedCreated && formattedUpdated) {
    if (formattedCreated === formattedUpdated) {
      // Same date: show single meaningful label
      dateItems.push(`<span>Updated <time datetime="${new Date(rawUpdated).toISOString()}">${formattedUpdated}</time></span>`);
    } else {
      dateItems.push(`<span>Created <time datetime="${new Date(rawCreated).toISOString()}">${formattedCreated}</time></span>`);
      dateItems.push(`<span class="text-muted-foreground/40">·</span>`);
      dateItems.push(`<span>Updated <time datetime="${new Date(rawUpdated).toISOString()}">${formattedUpdated}</time></span>`);
    }
  } else if (formattedUpdated) {
    dateItems.push(`<span>Updated <time datetime="${new Date(rawUpdated).toISOString()}">${formattedUpdated}</time></span>`);
  } else if (formattedCreated) {
    dateItems.push(`<span>Created <time datetime="${new Date(rawCreated).toISOString()}">${formattedCreated}</time></span>`);
  }

  // Edit URL & View Source links
  const editUrl = showEditLink ? page.editUrl : null;
  const sourceUrl = page.sourceUrl;
  const editLinkText = config.editLink?.text || 'Edit this page';

  const hasDates = dateItems.length > 0;
  const hasLinks = Boolean(editUrl || sourceUrl);

  if (!hasDates && !hasLinks) {
    return '';
  }

  return `
<div class="not-prose mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
  <div class="flex items-center gap-2 flex-wrap text-muted-foreground/80">
    ${dateItems.join('\n    ')}
  </div>

  <div class="flex items-center gap-4 flex-wrap">
    ${editUrl ? `
    <a href="${editUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-muted-foreground hover:text-accent font-medium transition-colors">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
      <span>${escapeHtml(editLinkText)}</span>
    </a>
    ` : ''}

    ${sourceUrl ? `
    <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-muted-foreground hover:text-accent font-medium transition-colors">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
      <span>View source</span>
    </a>
    ` : ''}
  </div>
</div>`;
}

/**
 * Renders the subtle global site footer.
 * 
 * @param {object} params
 * @param {object} params.config
 * @param {string|null} params.license
 * @param {string|null} params.commit
 * @param {number|null} params.buildDuration
 * @returns {string}
 */
export function renderGlobalFooter({ config, license = null, commit = null, buildDuration = null }) {
  const footerConfig = config.footer || {};
  if (config.footer === false) return '';

  const showVersion = footerConfig.version !== false;
  const showCommit = Boolean(footerConfig.commit && commit);
  const showBuildDuration = Boolean(footerConfig.buildDuration && buildDuration);
  const showBranding = footerConfig.branding !== false;

  const links = [];
  if (Array.isArray(footerConfig.links) && footerConfig.links.length > 0) {
    for (const link of footerConfig.links) {
      if (link.label && link.href) {
        links.push(`<a href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer" class="hover:text-foreground transition-colors">${escapeHtml(link.label)}</a>`);
      }
    }
  } else if (config.repo) {
    links.push(`<a href="${escapeHtml(config.repo)}" target="_blank" rel="noopener noreferrer" class="hover:text-foreground transition-colors">GitHub</a>`);
  }

  return `
<footer class="border-t border-border/60 py-6 text-xs text-muted-foreground bg-muted/10 mt-auto">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
    <div class="flex items-center gap-2 flex-wrap">
      ${showVersion ? `<span>Docboot v${COMPILER_VERSION}</span>` : ''}
      ${license ? `<span class="text-muted-foreground/60">· ${escapeHtml(license)}</span>` : ''}
      ${showCommit ? `<span class="font-mono text-[11px] text-muted-foreground/60">· ${escapeHtml(commit)}</span>` : ''}
      ${showBuildDuration ? `<span class="text-muted-foreground/60">· Built in ${buildDuration}ms</span>` : ''}
    </div>

    <div class="flex items-center gap-4 flex-wrap">
      ${links.join('\n      ')}
      ${showBranding ? `<span class="text-muted-foreground/70">Built with <a href="https://github.com/litepacks/docboot" target="_blank" rel="noopener noreferrer" class="hover:text-foreground font-medium transition-colors">Docboot</a></span>` : ''}
    </div>
  </div>
</footer>`;
}
