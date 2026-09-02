import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { marked } from 'marked';
import { renderCodeBlock } from './codeblock.js';
import { escapeHtml } from './highlighter.js';
import { inspectBuffer } from '../images/inspect.js';
import { renderPicture } from '../images/renderer.js';
import { computeTargetWidths } from '../images/processor.js';
import { hashString } from '../cache/hasher.js';
import { withBase } from '../config/index.js';
import { generateQrSvg } from './qr.js';

const CALLOUT_CONFIGS = {
  note: {
    title: 'Note',
    icon: `<svg class="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>`,
    containerClass: 'border-l-4 border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 text-foreground',
    titleClass: 'text-blue-600 dark:text-blue-400 font-semibold'
  },
  tip: {
    title: 'Tip',
    icon: `<svg class="w-4 h-4 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>`,
    containerClass: 'border-l-4 border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 text-foreground',
    titleClass: 'text-emerald-600 dark:text-emerald-400 font-semibold'
  },
  warning: {
    title: 'Warning',
    icon: `<svg class="w-4 h-4 text-amber-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>`,
    containerClass: 'border-l-4 border-amber-500 bg-amber-500/5 dark:bg-amber-500/10 text-foreground',
    titleClass: 'text-amber-600 dark:text-amber-400 font-semibold'
  },
  danger: {
    title: 'Danger',
    icon: `<svg class="w-4 h-4 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>`,
    containerClass: 'border-l-4 border-rose-500 bg-rose-500/5 dark:bg-rose-500/10 text-foreground',
    titleClass: 'text-rose-600 dark:text-rose-400 font-semibold'
  }
};

/**
 * Strips leading spaces from every line so Marked never treats generated HTML as indented codeblocks.
 * @param {string} str 
 * @returns {string}
 */
function unindent(str) {
  if (!str) return '';
  return str.split('\n').map(l => l.trimStart()).join('\n');
}

/**
 * Parses block arguments (e.g. `group="package-manager"` or `youtube ratio="16/9"`)
 * @param {string} rawArgs 
 * @returns {object}
 */
export function parseDirectiveArgs(rawArgs = '') {
  const args = { _raw: rawArgs.trim() };
  if (!rawArgs.trim()) return args;

  const keyValRegex = /([a-zA-Z0-9_-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match;
  let remaining = rawArgs;

  while ((match = keyValRegex.exec(rawArgs)) !== null) {
    const key = match[1];
    const val = match[2] ?? match[3] ?? match[4];
    args[key] = val;
    remaining = remaining.replace(match[0], '');
  }

  const positional = remaining.trim().split(/\s+/).filter(Boolean);
  if (positional.length > 0) {
    args._positional = positional;
    args.typeOrTitle = positional.join(' ');
  }

  return args;
}

function transformDirectiveBlock(name, rawArgs, body, config) {
  const type = name.toLowerCase();
  const args = parseDirectiveArgs(rawArgs || '');

  // 1. Standard Callouts
  if (CALLOUT_CONFIGS[type]) {
    return renderCallout(type, args, body);
  }

  // 2. Details / Collapse
  if (type === 'details' || type === 'collapse') {
    return renderDetails(args, body);
  }

  // 3. Tabs & Synced Tabs
  if (type === 'tabs') {
    return renderTabs(args, body);
  }

  // 4. Code Groups
  if (type === 'code-group' || type === 'codegroup') {
    return renderCodeGroup(args, body);
  }

  // 5. Safe Embed / iframe
  if (type === 'embed' || type === 'iframe') {
    return renderEmbed(args, body, config);
  }

  // 6. Explicit Image
  if (type === 'image') {
    return renderExplicitImage(args, body, config);
  }

  // 7. Image Gallery
  if (type === 'gallery') {
    return renderGallery(args, body, config);
  }

  // 8. Before / After Comparison
  if (type === 'compare' || type === 'diff-image') {
    return renderCompare(args, body, config);
  }

  // 9. Steps Primitive
  if (type === 'steps' || type === 'step') {
    return renderSteps(args, body, config);
  }

  // 10. File Tree Primitive
  if (type === 'tree' || type === 'filetree' || type === 'file-tree') {
    return renderFileTree(args, body, config);
  }

  // 11. Terminal Primitive
  if (type === 'terminal' || type === 'console') {
    return renderTerminal(args, body, config);
  }

  // 12. Badges & Status
  if (type === 'badge' || type === 'status') {
    return renderBadge(args, body, config);
  }

  // 13. Version Since
  if (type === 'since' || type === 'version') {
    return renderSince(args, body, config);
  }

  // 14. Deprecated Callout Block
  if (type === 'deprecated') {
    return renderDeprecated(args, body, config);
  }

  // 15. Carousel Walkthrough
  if (type === 'carousel') {
    return renderCarousel(args, body, config);
  }

  // 16. File Download Card
  if (type === 'download' || type === 'file') {
    return renderDownload(args, body, config);
  }

  // 17. QR Code Card
  if (type === 'qr' || type === 'qrcode') {
    return renderQr(args, body, config);
  }

  // 18. Custom Text Size Container (::: text-sm, ::: text-lg, ::: text-xl, ::: text-xs, ::: lead)
  if (type.startsWith('text-') || type === 'lead' || type === 'small' || type === 'large') {
    return renderTextSizeContainer(type, args, body);
  }

  // 19. Slide Directive (Docs mode fallback: renders content as section)
  if (type === 'slide' || type === 'vslide' || type === 'subslide') {
    const layout = args.layout || 'default';
    const bgAttr = args.background ? ` style="background-image: url('${args.background}'); background-size: cover;"` : '';
    const customClass = args.class || '';
    return `<div class="docboot-slide-section docboot-slide-layout-${layout} ${customClass} my-8 py-4 border-b border-border/40"${bgAttr}>\n\n${body}\n\n</div>`;
  }

  // 20. Speaker Notes Directive (Docs mode: omit from public documentation output)
  if (type === 'notes') {
    return '';
  }

  // 21. Split Layout Columns (::left and ::right)
  if (type === 'left' || type === 'right') {
    return `<div class="docboot-col docboot-col-${type} my-4">\n\n${body}\n\n</div>`;
  }

  // 22. Presentation-only container (Docs mode: omit)
  if (type === 'presentation') {
    return '';
  }

  // 23. Incremental Reveal Fragment Directive (:::fragment ... :::)
  if (type === 'fragment') {
    const isSlide = Boolean(config && config.isSlide);
    const animation = args.animation || args.anim || 'fade-up';
    const fragmentClass = isSlide ? `docboot-fragment docboot-fragment-${animation}` : 'docboot-fragment-docs';
    return `<div class="${fragmentClass}">\n\n${body}\n\n</div>`;
  }

  // 24. API Endpoint Primitive (:::endpoint GET /api/v1/users)
  if (type === 'endpoint' || type === 'api' || type === 'route' || type === 'http') {
    return renderEndpoint(args, body, config);
  }

  // 25. Request Block (:::request POST /api/v1/users)
  if (type === 'request' || type === 'req') {
    return renderRequest(args, body, config);
  }

  // 26. Response Block (:::response 200 OK)
  if (type === 'response' || type === 'res') {
    return renderResponse(args, body, config);
  }

  // 27. Parameter List / Table Primitive (:::params, :::parameters, :::args, :::fields, :::headers, :::query)
  if (type === 'params' || type === 'parameters' || type === 'args' || type === 'fields' || type === 'query' || type === 'headers') {
    return renderParams(args, body, config);
  }

  // 28. Single Property Card (:::property, :::prop)
  if (type === 'property' || type === 'prop') {
    return renderProperty(args, body, config);
  }

  // 29. Environment Variable Card (:::env, :::environment, :::env-var)
  if (type === 'env' || type === 'environment' || type === 'env-var') {
    return renderEnv(args, body, config);
  }

  // 30. Configuration Option Card (:::config-option, :::config, :::option)
  if (type === 'config-option' || type === 'config' || type === 'option') {
    return renderConfigOption(args, body, config);
  }

  // 31. Cards Grid & Single Card (:::cards, :::grid, :::card-grid, :::card)
  if (type === 'cards' || type === 'grid' || type === 'card-grid') {
    return renderCards(args, body, config);
  }
  if (type === 'card') {
    return renderCard(args, body, config);
  }

  // 32. Metric / Stat Cards (:::metrics, :::stats, :::stat-grid)
  if (type === 'metrics' || type === 'stats' || type === 'stat-grid') {
    return renderMetrics(args, body, config);
  }

  // 33. Hero & Banner Block (:::hero, :::banner)
  if (type === 'hero' || type === 'banner') {
    return renderHero(args, body, config);
  }

  // 34. Feature Grid (:::features, :::feature-grid)
  if (type === 'features' || type === 'feature-grid') {
    return renderFeatures(args, body, config);
  }

  // 35. Compatibility Matrix (:::compat, :::compatibility, :::support)
  if (type === 'compat' || type === 'compatibility' || type === 'support') {
    return renderCompat(args, body, config);
  }

  // 36. Keyboard Shortcuts (:::shortcut, :::shortcuts, :::kbd)
  if (type === 'shortcut' || type === 'shortcuts' || type === 'kbd') {
    return renderShortcuts(args, body, config);
  }

  // 37. Component Preview (:::preview, :::code-preview, :::example)
  if (type === 'preview' || type === 'code-preview' || type === 'example') {
    return renderPreview(args, body, config);
  }

  // 38. Changelog & Releases (:::changelog, :::release, :::releases)
  if (type === 'changelog' || type === 'release' || type === 'releases') {
    return renderChangelog(args, body, config);
  }

  // 39. Testimonial & Quote (:::testimonial, :::quote, :::review)
  if (type === 'testimonial' || type === 'quote' || type === 'review') {
    return renderTestimonial(args, body, config);
  }

  // 40. Timeline & Roadmaps (:::timeline, :::milestones, :::roadmap, :::history)
  if (type === 'timeline' || type === 'milestones' || type === 'roadmap' || type === 'history') {
    return renderTimeline(args, body, config);
  }

  // 41. FAQ & Accordions (:::faq, :::accordion, :::qna)
  if (type === 'faq' || type === 'accordion' || type === 'qna') {
    return renderFaq(args, body, config);
  }

  // 42. Pricing & Plan Tiers (:::pricing, :::plans, :::tiers)
  if (type === 'pricing' || type === 'plans' || type === 'tiers') {
    return renderPricing(args, body, config);
  }

  // 43. Enhanced Data Table (:::table, :::data-table)
  if (type === 'table' || type === 'data-table') {
    return renderDataTable(args, body, config);
  }

  // 44. Team & Authors (:::team, :::authors, :::contributors, :::author, :::member)
  if (type === 'team' || type === 'authors' || type === 'contributors' || type === 'author' || type === 'member') {
    return renderTeam(args, body, config);
  }

  // 45. Sponsors & Backers (:::sponsors, :::sponsor, :::backers)
  if (type === 'sponsors' || type === 'sponsor' || type === 'backers') {
    return renderSponsors(args, body, config);
  }

  // 46. Feedback & Rating (:::feedback, :::rating, :::vote)
  if (type === 'feedback' || type === 'rating' || type === 'vote') {
    return renderFeedback(args, body, config);
  }

  // 47. Sandbox & Playgrounds (:::sandbox, :::playground, :::stackblitz, :::codesandbox, :::codepen)
  if (type === 'sandbox' || type === 'playground' || type === 'stackblitz' || type === 'codesandbox' || type === 'codepen') {
    return renderSandbox(args, body, config);
  }

  // 48. Interactive JSON Tree Viewer (:::json, :::jsontree, :::json-tree)
  if (type === 'json' || type === 'jsontree' || type === 'json-tree') {
    return renderJsonTree(args, body, config);
  }

  // 49. Dedicated Copy Primitive (:::copy, :::snippet, :::clipboard)
  if (type === 'copy' || type === 'snippet' || type === 'clipboard') {
    return renderCopyPrimitive(args, body, config);
  }

  // Unknown directive - leave unchanged
  return `:::${name}${rawArgs ? ' ' + rawArgs : ''}\n${body}\n:::`;
}

/**
 * Main directive transformer that processes all :::directive blocks,
 * respecting outer code fences so directive examples inside code blocks are preserved.
 * @param {string} markdown 
 * @param {object} config 
 * @returns {string} Transformed markdown with rich HTML components
 */
export function processDirectives(markdown, config = {}) {
  if (!markdown || !markdown.includes(':::')) return markdown;

  const lines = markdown.split(/\r?\n/);
  const resultLines = [];
  let inCodeBlock = false;
  let codeFenceChar = '';
  let codeFenceLen = 0;

  let inDirective = false;
  let directiveName = '';
  let directiveRawArgs = '';
  let directiveBodyLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Check code fence (``` or ~~~)
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch && !inDirective) {
      const fenceStr = fenceMatch[1];
      const char = fenceStr[0];
      const len = fenceStr.length;

      if (!inCodeBlock) {
        inCodeBlock = true;
        codeFenceChar = char;
        codeFenceLen = len;
        resultLines.push(line);
        continue;
      } else if (char === codeFenceChar && len >= codeFenceLen) {
        inCodeBlock = false;
        codeFenceChar = '';
        codeFenceLen = 0;
        resultLines.push(line);
        continue;
      }
    }

    if (inCodeBlock) {
      resultLines.push(line);
      continue;
    }

    // Outside code blocks: check directive opening
    if (!inDirective) {
      // Inline directives replacement on non-block lines
      let transformedLine = line;
      if (transformedLine.includes(':::badge') || transformedLine.includes(':::since') || /:::copy\s+[^:\r\n]+:::/.test(transformedLine)) {
        transformedLine = transformedLine.replace(/:::badge(?:\s+([a-zA-Z0-9_-]+))?/g, (m, status) => {
          return renderBadge({ _positional: [status || 'stable'] }, '', config);
        });
        transformedLine = transformedLine.replace(/:::since(?:\s+([a-zA-Z0-9_.-]+))?/g, (m, ver) => {
          return renderSince({ _positional: [ver || '0.1.0'] }, '', config);
        });
        transformedLine = transformedLine.replace(/:::copy\s+([^:\r\n]+):::/g, (m, snippet) => {
          return renderCopyPrimitive({ _positional: [(snippet || '').trim()], inline: true }, '', config);
        });
      }

      const dirOpenMatch = transformedLine.match(/^:::([a-zA-Z0-9_-]+)(?:[ \t]+([^\r\n]+))?$/);
      if (dirOpenMatch && !['badge', 'since'].includes(dirOpenMatch[1].toLowerCase())) {
        inDirective = true;
        directiveName = dirOpenMatch[1];
        directiveRawArgs = dirOpenMatch[2] || '';
        directiveBodyLines = [];
        continue;
      } else {
        resultLines.push(transformedLine);
      }
    } else {
      // Inside directive: check directive closing
      if (line.trim() === ':::') {
        inDirective = false;
        const rendered = transformDirectiveBlock(directiveName, directiveRawArgs, directiveBodyLines.join('\n'), config);
        resultLines.push(rendered);
        directiveName = '';
        directiveRawArgs = '';
        directiveBodyLines = [];
      } else {
        directiveBodyLines.push(line);
      }
    }
  }

  // If unclosed directive at EOF, flush original lines
  if (inDirective) {
    resultLines.push(`:::${directiveName}${directiveRawArgs ? ' ' + directiveRawArgs : ''}`);
    resultLines.push(...directiveBodyLines);
  }

  return resultLines.join('\n');
}

function renderTextSizeContainer(type, args, body) {
  let sizeClass = 'text-base';
  if (type === 'text-xs' || type === 'small') sizeClass = 'text-xs leading-relaxed';
  else if (type === 'text-sm') sizeClass = 'text-sm leading-relaxed';
  else if (type === 'text-lg' || type === 'large') sizeClass = 'text-lg leading-relaxed font-normal';
  else if (type === 'text-xl') sizeClass = 'text-xl leading-relaxed';
  else if (type === 'text-2xl') sizeClass = 'text-2xl font-semibold leading-snug';
  else if (type === 'lead') sizeClass = 'text-lg sm:text-xl font-medium text-foreground/90 leading-relaxed';

  const innerHtml = marked.parse(body.trim());
  return unindent(`
<div class="docboot-text-block my-4 ${sizeClass} text-foreground/90">
${innerHtml}
</div>
`);
}

function renderCallout(type, args, body) {
  const cfg = CALLOUT_CONFIGS[type];
  const displayTitle = args.typeOrTitle || (args._raw && args._raw.trim()) || cfg.title;
  const innerHtml = marked.parse(body.trim());

  return unindent(`
<div class="docboot-callout my-6 rounded-r-lg p-4 text-sm leading-relaxed ${cfg.containerClass} shadow-2xs">
<div class="flex items-center gap-2 mb-1.5 ${cfg.titleClass}">
${cfg.icon}
<span class="font-semibold">${escapeHtml(displayTitle)}</span>
</div>
<div class="docboot-callout-content text-foreground/85 prose-sm [&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
${innerHtml}
</div>
</div>
`);
}

function renderDetails(args, body) {
  const summaryTitle = args.typeOrTitle || args.title || 'Details';
  const innerHtml = marked.parse(body.trim());

  return unindent(`
<details class="docboot-details group my-6 rounded-lg border border-border bg-card-bg/50 p-4 transition-all duration-200">
<summary class="cursor-pointer font-semibold text-foreground flex items-center justify-between select-none list-none text-sm group-hover:text-accent transition-colors">
<span class="flex items-center gap-2">
<svg class="w-4 h-4 text-muted-foreground group-hover:text-accent transition-transform duration-200 group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
</svg>
${escapeHtml(summaryTitle)}
</span>
</summary>
<div class="docboot-details-content mt-3 pt-3 border-t border-border/40 text-sm text-foreground/90 prose-sm [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
${innerHtml}
</div>
</details>
`);
}

function renderTabs(args, body) {
  const group = args.group ? ` data-tab-group="${escapeHtml(args.group)}"` : '';
  
  // Extract ::tab [name]
  const tabRegex = /::tab(?:[ \t]+([^\r\n]+))?\r?\n([\s\S]*?)(?=(?:::tab|\s*$))/g;
  const tabs = [];
  let tabMatch;

  while ((tabMatch = tabRegex.exec(body)) !== null) {
    const label = (tabMatch[1] || 'Tab').trim();
    const content = tabMatch[2].trim();
    tabs.push({ label, content });
  }

  if (tabs.length === 0) {
    return unindent(`<div class="docboot-tabs my-6 p-4 rounded-lg border border-border bg-card-bg text-sm">${marked.parse(body)}</div>`);
  }

  const tabId = 'tabs-' + Math.random().toString(36).substring(2, 9);

  let tabButtons = '';
  let tabPanels = '';

  tabs.forEach((tab, index) => {
    const isFirst = index === 0;
    const activeClass = isFirst
      ? 'border-accent text-accent font-semibold bg-card-bg'
      : 'border-transparent text-muted-foreground hover:text-foreground font-medium';
    const hiddenClass = isFirst ? '' : 'hidden';

    tabButtons += `
<button type="button" role="tab" aria-selected="${isFirst ? 'true' : 'false'}" tabindex="${isFirst ? '0' : '-1'}" aria-controls="${tabId}-panel-${index}" id="${tabId}-tab-${index}" class="docboot-tab-btn px-4 py-2 text-xs transition-all border-b-2 -mb-px rounded-t-md select-none ${activeClass}" data-tab-index="${index}" data-tab-label="${escapeHtml(tab.label)}">
${escapeHtml(tab.label)}
</button>`;

    const parsedContent = marked.parse(tab.content);
    tabPanels += `
<div role="tabpanel" tabindex="0" id="${tabId}-panel-${index}" aria-labelledby="${tabId}-tab-${index}" class="docboot-tab-panel p-4 text-sm ${hiddenClass}" data-tab-index="${index}">
<div class="prose-sm [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>pre]:my-0 [&_.euix-codeblock]:my-0 [&_.docboot-codeblock]:my-0">
${parsedContent}
</div>
</div>`;
  });

  return unindent(`
<div class="docboot-tabs not-prose my-6 rounded-lg border border-border bg-card-bg/60 shadow-2xs overflow-hidden"${group}>
<div class="docboot-tab-list flex border-b border-border bg-muted/30 px-2 pt-2 gap-1 overflow-x-auto" role="tablist" aria-label="Tabs">
${tabButtons}
</div>
<div class="docboot-tab-panels">
${tabPanels}
</div>
</div>
`);
}

function renderCodeGroup(args, body) {
  const codeBlockRegex = /```([a-zA-Z0-9_-]+)?(?:[ \t]+(?:\[([^\]]+)\]|title="([^"]+)"|([^\r\n]+)))?\r?\n([\s\S]*?)\r?\n```/g;
  const tabs = [];
  let match;

  while ((match = codeBlockRegex.exec(body)) !== null) {
    const lang = match[1] || 'text';
    const label = (match[2] || match[3] || match[4] || lang).trim();
    const code = match[5];
    tabs.push({ lang, label, code });
  }

  if (tabs.length === 0) {
    return unindent(`<div class="my-6">${marked.parse(body)}</div>`);
  }

  const tabId = 'codegroup-' + Math.random().toString(36).substring(2, 9);
  let tabButtons = '';
  let tabPanels = '';

  tabs.forEach((tab, index) => {
    const isFirst = index === 0;
    const activeClass = isFirst
      ? 'text-accent font-semibold border-accent bg-[#161b22]'
      : 'text-[#8b949e] hover:text-[#e6edf3] font-medium border-transparent';
    const hiddenClass = isFirst ? '' : 'hidden';

    tabButtons += `
<button type="button" role="tab" aria-selected="${isFirst ? 'true' : 'false'}" tabindex="${isFirst ? '0' : '-1'}" aria-controls="${tabId}-panel-${index}" id="${tabId}-tab-${index}" class="docboot-tab-btn px-3.5 py-2 text-xs transition-all border-b-2 -mb-px rounded-t-md select-none ${activeClass}" data-tab-index="${index}" data-tab-label="${escapeHtml(tab.label)}">
${escapeHtml(tab.label)}
</button>`;

    const renderedCode = renderCodeBlock(tab.code, tab.lang);
    tabPanels += `
<div role="tabpanel" tabindex="0" id="${tabId}-panel-${index}" aria-labelledby="${tabId}-tab-${index}" class="docboot-tab-panel ${hiddenClass}" data-tab-index="${index}">
${renderedCode}
</div>`;
  });

  return unindent(`
<div class="docboot-tabs docboot-code-group not-prose my-6 rounded-lg border border-border/90 bg-[#0d1117] shadow-md shadow-black/10 overflow-hidden">
<div class="docboot-tab-list flex border-b border-[#21262d] bg-[#161b22] px-3 pt-2 gap-1 overflow-x-auto" role="tablist">
<div class="flex items-center gap-1.5 mr-2 self-center">
<span class="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/80 inline-block"></span>
<span class="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/80 inline-block"></span>
<span class="w-2.5 h-2.5 rounded-full bg-[#27c93f]/80 inline-block"></span>
</div>
${tabButtons}
</div>
<div class="docboot-tab-panels [&_.euix-codeblock]:my-0 [&_.euix-codeblock]:rounded-none [&_.euix-codeblock]:border-0 [&_.euix-codeblock>div:first-child]:hidden [&_.docboot-codeblock]:my-0 [&_.docboot-codeblock]:rounded-none [&_.docboot-codeblock]:border-0 [&_.docboot-codeblock>div:first-child]:hidden">
${tabPanels}
</div>
</div>
`);
}

function parseYamlOrProps(body) {
  try {
    const parsed = yaml.parse(body);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (e) {}

  const result = {};
  const lines = body.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      result[key] = val;
    }
  }
  return result;
}

function renderEmbed(args, body, config = {}) {
  const data = parseYamlOrProps(body);
  const src = data.src || args.src || '';
  const title = data.title || args.title || 'Embedded Content';
  const ratio = data.ratio || args.ratio || '16/9';
  const height = data.height || args.height;
  const preset = (args._positional && args._positional[0]) || '';

  if (!src) {
    return unindent(`
<div class="my-6 p-4 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-mono">
⚠ Missing <code>src</code> in embed directive.
</div>`);
  }

  const allowedDomains = (config.embeds && config.embeds.allowedDomains) || [
    'codesandbox.io',
    'stackblitz.com',
    'youtube.com',
    'www.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
    'youtu.be',
    'vimeo.com',
    'player.vimeo.com',
    'codepen.io'
  ];

  let embedUrl = src;
  let parsedUrl;
  try {
    parsedUrl = new URL(src);
  } catch (err) {
    return unindent(`
<div class="my-6 p-4 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono">
✗ Invalid embed URL: <code>${escapeHtml(src)}</code>
</div>`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isAllowed = allowedDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));

  if (!isAllowed) {
    return unindent(`
<div class="my-6 p-4 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono">
✗ Blocked embed domain: <code>${escapeHtml(hostname)}</code> (Not in allowedDomains list)
</div>`);
  }

  if (preset === 'youtube' || hostname.includes('youtube.com') || hostname === 'youtu.be') {
    let videoId = '';
    if (hostname === 'youtu.be') {
      videoId = parsedUrl.pathname.replace(/^\/+/, '');
    } else if (parsedUrl.searchParams.has('v')) {
      videoId = parsedUrl.searchParams.get('v');
    } else if (parsedUrl.pathname.includes('/embed/')) {
      videoId = parsedUrl.pathname.split('/embed/')[1];
    }
    if (videoId) {
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
    }
  } else if (preset === 'vimeo' || hostname.includes('vimeo.com')) {
    const videoId = parsedUrl.pathname.split('/').filter(Boolean).pop();
    if (videoId && !hostname.includes('player.vimeo.com')) {
      embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }
  }

  const styleAttr = height
    ? `style="height: ${height}px;"`
    : `style="aspect-ratio: ${ratio}; width: 100%;"`;

  return unindent(`
<div class="docboot-embed not-prose my-6 rounded-lg border border-border bg-card-bg/50 shadow-2xs overflow-hidden w-full">
<iframe
src="${escapeHtml(embedUrl)}"
title="${escapeHtml(title)}"
loading="lazy"
sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
referrerpolicy="strict-origin-when-cross-origin"
allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
allowfullscreen
class="w-full border-0 block"
${styleAttr}
></iframe>
</div>
`);
}

function renderExplicitImage(args, body, config = {}) {
  const data = parseYamlOrProps(body);
  const src = data.src || args.src || '';
  const alt = data.alt || args.alt || '';
  const caption = data.caption || args.caption || '';
  const zoom = data.zoom !== false && args.zoom !== 'false' && data.lightbox !== false && args.lightbox !== 'false';
  const rawWidth = data.width || args.width;
  const quality = data.quality ? Number(data.quality) : (config.images?.quality || 82);
  const loading = data.loading || args.loading || 'lazy';
  const fetchpriority = data.fetchpriority || args.fetchpriority || null;
  const optimize = data.optimize !== false && data.optimize !== 'false' && args.optimize !== 'false' && config.images?.optimize !== false;
  const align = data.align || args.align || 'center';
  const base = config.base || '/';

  if (!src) {
    return unindent(`<div class="my-6 p-4 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 text-xs font-mono">⚠ Missing <code>src</code> in image directive.</div>`);
  }

  const isExternal = src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//') || src.startsWith('data:') || src.startsWith('#');
  const widthStyle = rawWidth ? (String(rawWidth).match(/^[0-9]+$/) ? `max-width: ${rawWidth}px;` : `max-width: ${rawWidth};`) : '';
  const alignClass = align === 'left' ? 'text-left' : (align === 'right' ? 'text-right' : 'text-center mx-auto');

  if (isExternal) {
    const lightboxAttr = zoom ? ` data-docboot-lightbox="true" data-lightbox-src="${escapeHtml(src)}" data-lightbox-alt="${escapeHtml(alt)}" data-lightbox-caption="${escapeHtml(caption)}"` : '';
    const isEager = loading === 'eager';
    const loadingAttr = isEager ? 'loading="eager"' : 'loading="lazy"';
    const priorityAttr = isEager ? ' fetchpriority="high"' : (fetchpriority ? ` fetchpriority="${fetchpriority}"` : '');
    const cursorClass = zoom ? 'cursor-zoom-in ' : '';

    return unindent(`
<figure class="docboot-figure not-prose my-8 ${alignClass}">
<div class="inline-block relative overflow-hidden rounded-lg border border-border bg-card-bg/40 shadow-2xs group">
<img
src="${escapeHtml(src)}"
alt="${escapeHtml(alt)}"
${loadingAttr}
decoding="async"${priorityAttr}
class="block max-w-full h-auto rounded-lg ${cursorClass}transition-transform duration-300 group-hover:scale-[1.01]"
style="${widthStyle}"${lightboxAttr}
/>
</div>
${caption ? `<figcaption class="mt-2.5 text-xs text-muted-foreground font-medium tracking-tight">${escapeHtml(caption)}</figcaption>` : ''}
</figure>
`);
  }

  // Local image resolution
  const rootDir = config.rootDir || process.cwd();
  const docsDir = config.docsDir || path.resolve(rootDir, 'docs');
  const currentRelativePath = config.relativePath || '';
  const cleanSrc = src.split('?')[0].split('#')[0];

  let diskPath = null;
  if (currentRelativePath) {
    const mdDir = path.dirname(path.join(docsDir, currentRelativePath));
    const p1 = path.resolve(mdDir, cleanSrc);
    if (fs.existsSync(p1) && fs.statSync(p1).isFile()) diskPath = p1;
  }
  if (!diskPath) {
    const p2 = path.resolve(docsDir, cleanSrc.replace(/^\/+/, ''));
    if (fs.existsSync(p2) && fs.statSync(p2).isFile()) diskPath = p2;
  }
  if (!diskPath) {
    const p3 = path.resolve(rootDir, 'public', cleanSrc.replace(/^\/+/, ''));
    if (fs.existsSync(p3) && fs.statSync(p3).isFile()) diskPath = p3;
  }
  if (!diskPath) {
    const p4 = path.resolve(rootDir, cleanSrc.replace(/^\/+/, ''));
    if (fs.existsSync(p4) && fs.statSync(p4).isFile()) diskPath = p4;
  }

  if (!diskPath || !fs.existsSync(diskPath)) {
    const lightboxAttr = zoom ? ` data-docboot-lightbox="true" data-lightbox-src="${escapeHtml(src)}" data-lightbox-alt="${escapeHtml(alt)}" data-lightbox-caption="${escapeHtml(caption)}"` : '';
    const cursorClass = zoom ? 'cursor-zoom-in ' : '';
    return unindent(`
<figure class="docboot-figure not-prose my-8 ${alignClass}">
<div class="inline-block relative overflow-hidden rounded-lg border border-border bg-card-bg/40 shadow-2xs group">
<img
src="${escapeHtml(src)}"
alt="${escapeHtml(alt)}"
loading="lazy"
decoding="async"
class="block max-w-full h-auto rounded-lg ${cursorClass}transition-transform duration-300 group-hover:scale-[1.01]"
style="${widthStyle}"${lightboxAttr}
/>
</div>
${caption ? `<figcaption class="mt-2.5 text-xs text-muted-foreground font-medium tracking-tight">${escapeHtml(caption)}</figcaption>` : ''}
</figure>
`);
  }

  try {
    const buffer = fs.readFileSync(diskPath);
    const meta = inspectBuffer(buffer);
    const parsedFile = path.parse(diskPath);
    const baseName = (parsedFile.name || 'image').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
    const fileHash = hashString(buffer.toString('binary')).slice(0, 8);

    if (meta.format === 'svg') {
      const svgUrl = withBase(`/assets/images/${baseName}.${fileHash}.svg`, base);
      const widthAttr = meta.width ? ` width="${meta.width}"` : '';
      const heightAttr = meta.height ? ` height="${meta.height}"` : '';
      const lightboxAttr = zoom ? ` data-docboot-lightbox="true" data-lightbox-src="${svgUrl}" data-lightbox-alt="${escapeHtml(alt)}" data-lightbox-caption="${escapeHtml(caption)}"` : '';
      const cursorClass = zoom ? 'cursor-zoom-in ' : '';

      return unindent(`
<figure class="docboot-figure not-prose my-8 ${alignClass}">
<div class="inline-block relative overflow-hidden rounded-lg border border-border bg-card-bg/40 shadow-2xs group">
<img
src="${svgUrl}"
alt="${escapeHtml(alt)}"${widthAttr}${heightAttr}
loading="${loading === 'eager' ? 'eager' : 'lazy'}"
decoding="async"${loading === 'eager' ? ' fetchpriority="high"' : ''}
class="block max-w-full h-auto rounded-lg ${cursorClass}transition-transform duration-300 group-hover:scale-[1.01]"
style="${widthStyle}"${lightboxAttr}
/>
</div>
${caption ? `<figcaption class="mt-2.5 text-xs text-muted-foreground font-medium tracking-tight">${escapeHtml(caption)}</figcaption>` : ''}
</figure>
`);
    }

    if (meta.format === 'gif' && meta.isAnimated) {
      const gifUrl = withBase(`/assets/images/${baseName}.${fileHash}.gif`, base);
      const widthAttr = meta.width ? ` width="${meta.width}"` : '';
      const heightAttr = meta.height ? ` height="${meta.height}"` : '';
      const lightboxAttr = zoom ? ` data-docboot-lightbox="true" data-lightbox-src="${gifUrl}" data-lightbox-alt="${escapeHtml(alt)}" data-lightbox-caption="${escapeHtml(caption)}"` : '';
      const cursorClass = zoom ? 'cursor-zoom-in ' : '';

      return unindent(`
<figure class="docboot-figure not-prose my-8 ${alignClass}">
<div class="inline-block relative overflow-hidden rounded-lg border border-border bg-card-bg/40 shadow-2xs group">
<img
src="${gifUrl}"
alt="${escapeHtml(alt)}"${widthAttr}${heightAttr}
loading="${loading === 'eager' ? 'eager' : 'lazy'}"
decoding="async"${loading === 'eager' ? ' fetchpriority="high"' : ''}
class="block max-w-full h-auto rounded-lg ${cursorClass}transition-transform duration-300 group-hover:scale-[1.01]"
style="${widthStyle}"${lightboxAttr}
/>
</div>
${caption ? `<figcaption class="mt-2.5 text-xs text-muted-foreground font-medium tracking-tight">${escapeHtml(caption)}</figcaption>` : ''}
</figure>
`);
    }

    if (optimize && (meta.format === 'png' || meta.format === 'jpeg' || meta.format === 'webp' || meta.format === 'avif') && meta.width) {
      const configuredWidths = config.images?.widths || [480, 768, 1280, 1920];
      const targetWidths = computeTargetWidths(meta.width, configuredWidths);
      const configuredFormats = config.images?.formats || ['avif', 'webp'];
      const targetFormats = Array.from(new Set([...configuredFormats, 'webp']));

      const variants = [];
      for (const fmt of targetFormats) {
        for (const w of targetWidths) {
          const targetHeight = meta.height ? Math.round((w / meta.width) * meta.height) : null;
          const variantName = `${baseName}.${fileHash}.${w}.${fmt}`;
          variants.push({
            width: w,
            height: targetHeight,
            format: fmt,
            url: `/assets/images/${variantName}`
          });
        }
      }

      const webpVariants = variants.filter(v => v.format === 'webp');
      const largestWebp = webpVariants[webpVariants.length - 1] || variants[variants.length - 1];
      const displayVariant = webpVariants.find(v => v.width >= 768) || largestWebp;

      const imageRecord = {
        src: displayVariant.url,
        displaySrc: displayVariant.url,
        lightboxSrc: largestWebp.url,
        width: meta.width,
        height: meta.height,
        format: meta.format,
        variants,
        optimize: true
      };

      const picHtml = renderPicture(imageRecord, {
        alt,
        title: caption,
        caption,
        base,
        lightbox: zoom,
        loading,
        fetchpriority,
        style: widthStyle
      });

      return unindent(`
<figure class="docboot-figure not-prose my-8 ${alignClass}">
<div class="inline-block relative overflow-hidden rounded-lg border border-border bg-card-bg/40 shadow-2xs group">
${picHtml}
</div>
${caption ? `<figcaption class="mt-2.5 text-xs text-muted-foreground font-medium tracking-tight">${escapeHtml(caption)}</figcaption>` : ''}
</figure>
`);
    }

    // Passthrough
    const widthAttr = meta.width ? ` width="${meta.width}"` : '';
    const heightAttr = meta.height ? ` height="${meta.height}"` : '';
    const lightboxAttr = zoom ? ` data-docboot-lightbox="true" data-lightbox-src="${escapeHtml(src)}" data-lightbox-alt="${escapeHtml(alt)}" data-lightbox-caption="${escapeHtml(caption)}"` : '';
    const cursorClass = zoom ? 'cursor-zoom-in ' : '';

    return unindent(`
<figure class="docboot-figure not-prose my-8 ${alignClass}">
<div class="inline-block relative overflow-hidden rounded-lg border border-border bg-card-bg/40 shadow-2xs group">
<img
src="${escapeHtml(src)}"
alt="${escapeHtml(alt)}"${widthAttr}${heightAttr}
loading="${loading === 'eager' ? 'eager' : 'lazy'}"
decoding="async"${loading === 'eager' ? ' fetchpriority="high"' : ''}
class="block max-w-full h-auto rounded-lg ${cursorClass}transition-transform duration-300 group-hover:scale-[1.01]"
style="${widthStyle}"${lightboxAttr}
/>
</div>
${caption ? `<figcaption class="mt-2.5 text-xs text-muted-foreground font-medium tracking-tight">${escapeHtml(caption)}</figcaption>` : ''}
</figure>
`);
  } catch (_) {
    const lightboxAttr = zoom ? ` data-docboot-lightbox="true" data-lightbox-src="${escapeHtml(src)}" data-lightbox-alt="${escapeHtml(alt)}" data-lightbox-caption="${escapeHtml(caption)}"` : '';
    return unindent(`
<figure class="docboot-figure not-prose my-8 ${alignClass}">
<div class="inline-block relative overflow-hidden rounded-lg border border-border bg-card-bg/40 shadow-2xs group">
<img
src="${escapeHtml(src)}"
alt="${escapeHtml(alt)}"
loading="lazy"
decoding="async"
class="block max-w-full h-auto rounded-lg cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.01]"
style="${widthStyle}"${lightboxAttr}
/>
</div>
${caption ? `<figcaption class="mt-2.5 text-xs text-muted-foreground font-medium tracking-tight">${escapeHtml(caption)}</figcaption>` : ''}
</figure>
`);
  }
}

function renderGallery(args, body, config = {}) {
  let items = [];

  try {
    const parsed = yaml.parse(body);
    if (Array.isArray(parsed)) {
      items = parsed;
    }
  } catch (e) {}

  if (items.length === 0) {
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    items = lines.map(line => {
      if (typeof line === 'string') {
        const clean = line.replace(/^-\s*/, '');
        return { src: clean, alt: '', caption: '' };
      }
      return line;
    });
  }

  if (items.length === 0) {
    return unindent(`<div class="my-6 p-4 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 text-xs font-mono">⚠ Empty gallery directive.</div>`);
  }

  const galleryId = 'gallery-' + Math.random().toString(36).substring(2, 9);
  const base = config.base || '/';
  const rootDir = config.rootDir || process.cwd();
  const docsDir = config.docsDir || path.resolve(rootDir, 'docs');
  const currentRelativePath = config.relativePath || '';

  let cardsHtml = '';
  items.forEach((item, index) => {
    const src = item.src || (typeof item === 'string' ? item : '');
    const alt = item.alt || '';
    const caption = item.caption || '';
    const isExternal = src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//') || src.startsWith('data:') || src.startsWith('#');

    let displaySrc = src;
    let highResSrc = src;

    if (!isExternal) {
      const cleanSrc = src.split('?')[0].split('#')[0];
      let diskPath = null;
      if (currentRelativePath) {
        const mdDir = path.dirname(path.join(docsDir, currentRelativePath));
        const p1 = path.resolve(mdDir, cleanSrc);
        if (fs.existsSync(p1) && fs.statSync(p1).isFile()) diskPath = p1;
      }
      if (!diskPath) {
        const p2 = path.resolve(docsDir, cleanSrc.replace(/^\/+/, ''));
        if (fs.existsSync(p2) && fs.statSync(p2).isFile()) diskPath = p2;
      }
      if (!diskPath) {
        const p3 = path.resolve(rootDir, 'public', cleanSrc.replace(/^\/+/, ''));
        if (fs.existsSync(p3) && fs.statSync(p3).isFile()) diskPath = p3;
      }
      if (!diskPath) {
        const p4 = path.resolve(rootDir, cleanSrc.replace(/^\/+/, ''));
        if (fs.existsSync(p4) && fs.statSync(p4).isFile()) diskPath = p4;
      }

      if (diskPath && fs.existsSync(diskPath)) {
        try {
          const buffer = fs.readFileSync(diskPath);
          const meta = inspectBuffer(buffer);
          const parsedFile = path.parse(diskPath);
          const baseName = (parsedFile.name || 'image').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
          const fileHash = hashString(buffer.toString('binary')).slice(0, 8);

          if (meta.format === 'svg') {
            displaySrc = withBase(`/assets/images/${baseName}.${fileHash}.svg`, base);
            highResSrc = displaySrc;
          } else if (meta.format === 'gif' && meta.isAnimated) {
            displaySrc = withBase(`/assets/images/${baseName}.${fileHash}.gif`, base);
            highResSrc = displaySrc;
          } else if (meta.width) {
            // Thumbnail variant for gallery card (e.g. 480w)
            const targetWidths = computeTargetWidths(meta.width, config.images?.widths || [480, 768, 1280, 1920]);
            const thumbWidth = targetWidths[0] || 480;
            const fullWidth = targetWidths[targetWidths.length - 1] || meta.width;

            displaySrc = withBase(`/assets/images/${baseName}.${fileHash}.${thumbWidth}.webp`, base);
            highResSrc = withBase(`/assets/images/${baseName}.${fileHash}.${fullWidth}.webp`, base);
          }
        } catch (_) {}
      }
    }

    cardsHtml += `
<figure class="group relative overflow-hidden rounded-lg border border-border bg-card-bg/40 shadow-2xs hover:border-accent/50 hover:shadow-md transition-all">
<div class="overflow-hidden aspect-video sm:aspect-square bg-muted/20 flex items-center justify-center">
<img
src="${escapeHtml(displaySrc)}"
alt="${escapeHtml(alt)}"
loading="lazy"
decoding="async"
class="w-full h-full object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-105"
data-docboot-lightbox="true"
data-lightbox-src="${escapeHtml(highResSrc)}"
data-lightbox-alt="${escapeHtml(alt)}"
data-lightbox-caption="${escapeHtml(caption)}"
data-gallery-id="${galleryId}"
data-gallery-index="${index}"
/>
</div>
${caption ? `<figcaption class="p-2.5 text-xs text-muted-foreground font-medium truncate">${escapeHtml(caption)}</figcaption>` : ''}
</figure>`;
  });

  return unindent(`
<div class="docboot-gallery not-prose my-8">
<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
${cardsHtml}
</div>
</div>
`);
}

/**
 * Helper to resolve image paths for directives.
 */
function resolveDirectiveImage(src, config = {}) {
  const rootDir = config.rootDir || process.cwd();
  const docsDir = config.docsDir || rootDir;
  const base = config.base || '/';
  let displaySrc = withBase(src, base);
  let highResSrc = displaySrc;

  if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
    const cleanSrc = src.split('?')[0].split('#')[0];
    let diskPath = null;

    if (config.currentFilePath) {
      const p1 = path.resolve(path.dirname(config.currentFilePath), cleanSrc);
      if (fs.existsSync(p1) && fs.statSync(p1).isFile()) diskPath = p1;
    }
    if (!diskPath) {
      const p2 = path.resolve(docsDir, cleanSrc.replace(/^\/+/, ''));
      if (fs.existsSync(p2) && fs.statSync(p2).isFile()) diskPath = p2;
    }
    if (!diskPath) {
      const p3 = path.resolve(rootDir, 'public', cleanSrc.replace(/^\/+/, ''));
      if (fs.existsSync(p3) && fs.statSync(p3).isFile()) diskPath = p3;
    }
    if (!diskPath) {
      const p4 = path.resolve(rootDir, cleanSrc.replace(/^\/+/, ''));
      if (fs.existsSync(p4) && fs.statSync(p4).isFile()) diskPath = p4;
    }

    if (diskPath && fs.existsSync(diskPath)) {
      try {
        const buffer = fs.readFileSync(diskPath);
        const meta = inspectBuffer(buffer);
        const parsedFile = path.parse(diskPath);
        const baseName = (parsedFile.name || 'image').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
        const fileHash = hashString(buffer.toString('binary')).slice(0, 8);

        if (meta.format === 'svg') {
          displaySrc = withBase(`/assets/images/${baseName}.${fileHash}.svg`, base);
          highResSrc = displaySrc;
        } else if (meta.format === 'gif' && meta.isAnimated) {
          displaySrc = withBase(`/assets/images/${baseName}.${fileHash}.gif`, base);
          highResSrc = displaySrc;
        } else if (meta.width) {
          const targetWidths = computeTargetWidths(meta.width, config.images?.widths || [480, 768, 1280, 1920]);
          const mediumWidth = targetWidths[Math.min(1, targetWidths.length - 1)] || targetWidths[0] || meta.width;
          const fullWidth = targetWidths[targetWidths.length - 1] || meta.width;
          displaySrc = withBase(`/assets/images/${baseName}.${fileHash}.${mediumWidth}.webp`, base);
          highResSrc = withBase(`/assets/images/${baseName}.${fileHash}.${fullWidth}.webp`, base);
        }
      } catch (_) {}
    }
  }

  return { displaySrc, highResSrc };
}

/**
 * 8. Before / After Image Comparison Slider (:::compare)
 */
function renderCompare(args, body, config) {
  let parsed = {};
  if (body.trim().startsWith('{') || body.trim().includes(':')) {
    try {
      parsed = yaml.parse(body) || {};
    } catch (_) {}
  }

  const beforeSrc = args.before || parsed.before || '';
  const afterSrc = args.after || parsed.after || '';
  const beforeLabel = args.beforeLabel || args.before_label || parsed.beforeLabel || parsed.before_label || 'Before';
  const afterLabel = args.afterLabel || args.after_label || parsed.afterLabel || parsed.after_label || 'After';
  const alt = args.alt || parsed.alt || 'Before and After Image Comparison';
  const beforeAlt = args.beforeAlt || args.before_alt || parsed.beforeAlt || parsed.before_alt || `${alt} - ${beforeLabel}`;
  const afterAlt = args.afterAlt || args.after_alt || parsed.afterAlt || parsed.after_alt || `${alt} - ${afterLabel}`;
  const caption = args.caption || parsed.caption || args.title || parsed.title || '';

  const beforeResolved = resolveDirectiveImage(beforeSrc, config);
  const afterResolved = resolveDirectiveImage(afterSrc, config);

  return unindent(`
<figure class="docboot-compare not-prose my-8 select-none" data-docboot-compare="true">
  <div class="relative overflow-hidden rounded-xl border border-border bg-card-bg/60 shadow-md">
    <div class="docboot-compare-container relative w-full overflow-hidden aspect-video touch-none cursor-ew-resize">
      <!-- After Image (Background Layer) -->
      <div class="docboot-compare-after absolute inset-0 w-full h-full pointer-events-none">
        <img
          src="${escapeHtml(afterResolved.displaySrc)}"
          alt="${escapeHtml(afterAlt)}"
          loading="lazy"
          decoding="async"
          class="w-full h-full object-cover pointer-events-none"
        />
        <span class="absolute bottom-3 right-3 px-2.5 py-1 rounded text-xs font-semibold tracking-wide bg-black/70 text-white backdrop-blur-xs shadow-xs pointer-events-none">${escapeHtml(afterLabel)}</span>
      </div>
      <!-- Before Image (Clipped Overlay Layer) -->
      <div class="docboot-compare-before absolute inset-0 w-full h-full overflow-hidden pointer-events-none" style="clip-path: inset(0 50% 0 0); -webkit-clip-path: inset(0 50% 0 0);">
        <img
          src="${escapeHtml(beforeResolved.displaySrc)}"
          alt="${escapeHtml(beforeAlt)}"
          loading="lazy"
          decoding="async"
          class="w-full h-full object-cover pointer-events-none"
        />
        <span class="absolute bottom-3 left-3 px-2.5 py-1 rounded text-xs font-semibold tracking-wide bg-black/70 text-white backdrop-blur-xs shadow-xs pointer-events-none">${escapeHtml(beforeLabel)}</span>
      </div>
      <!-- Draggable Handle -->
      <div class="docboot-compare-handle absolute top-0 bottom-0 w-1 bg-white shadow-xl cursor-ew-resize flex items-center justify-center -translate-x-1/2 focus:outline-hidden focus:ring-2 focus:ring-accent z-10 touch-none" style="left: 50%;" role="slider" aria-label="Image comparison slider" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" tabindex="0">
        <div class="w-8 h-8 rounded-full bg-white dark:bg-slate-900 border-2 border-accent shadow-lg flex items-center justify-center text-accent pointer-events-none">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m9 18-6-6 6-6M15 6l6 6-6 6"/></svg>
        </div>
      </div>
    </div>
  </div>
  ${caption ? `<figcaption class="mt-2.5 text-center text-xs text-muted-foreground font-medium">${escapeHtml(caption)}</figcaption>` : ''}
</figure>
`);
}

/**
 * 9. Steps Primitive (:::steps ... ::step Title ... :::)
 */
function renderSteps(args, body, config) {
  // Match `::step <Title>\n<body>\n::` or `### <Title>\n<body>`
  const stepRegex = /::step(?:\s+([^\r\n]+))?\r?\n([\s\S]*?)(?:\r?\n::|$)/gi;
  const steps = [];
  let match;

  while ((match = stepRegex.exec(body)) !== null) {
    const stepTitle = (match[1] || '').trim() || `Step ${steps.length + 1}`;
    const stepBody = (match[2] || '').trim();
    steps.push({ title: stepTitle, content: stepBody });
  }

  // Fallback: if no ::step sub-blocks found, split by numbered list or headings
  if (steps.length === 0) {
    const lines = body.split('\n');
    let curTitle = '';
    let curLines = [];

    for (const line of lines) {
      if (/^(?:###|\d+\.)\s+(.+)$/.test(line)) {
        if (curTitle || curLines.length > 0) {
          steps.push({ title: curTitle || 'Step', content: curLines.join('\n') });
          curLines = [];
        }
        curTitle = line.replace(/^(?:###|\d+\.)\s+/, '').trim();
      } else {
        curLines.push(line);
      }
    }
    if (curTitle || curLines.length > 0) {
      steps.push({ title: curTitle || 'Step', content: curLines.join('\n') });
    }
  }

  if (steps.length === 0) {
    steps.push({ title: 'Step 1', content: body.trim() });
  }

  const stepsHtml = steps.map((step, idx) => {
    const isLast = idx === steps.length - 1;
    const parsedStepBody = marked.parse(step.content);

    return `
<li class="docboot-step relative pl-10 pb-8 last:pb-2 group">
  ${!isLast ? '<div class="docboot-step-line absolute left-[15px] top-[32px] bottom-0 w-0.5 bg-border group-last:hidden" aria-hidden="true"></div>' : ''}
  <div class="docboot-step-badge docboot-step-number absolute left-0 top-0 w-8 h-8 rounded-full bg-accent/15 border-2 border-accent text-accent font-bold text-xs flex items-center justify-center shadow-2xs select-none">${idx + 1}</div>
  <div class="docboot-step-content pt-0.5">
    <h4 class="text-base font-semibold text-foreground tracking-tight m-0 mb-2">${escapeHtml(step.title)}</h4>
    <div class="docboot-step-body text-sm text-foreground/90 space-y-2 leading-relaxed">${parsedStepBody}</div>
  </div>
</li>`;
  }).join('\n');

  return unindent(`
<div class="docboot-steps not-prose my-8">
  <ol class="list-none p-0 m-0 space-y-0">
    ${stepsHtml}
  </ol>
</div>
`);
}

/**
 * 10. File Tree Primitive (:::tree)
 */
function renderFileTree(args, body, config) {
  const lines = body.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
  const items = [];

  for (const rawLine of lines) {
    // Count leading spaces to determine depth
    const indentMatch = rawLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    const depth = Math.floor(indent / 2);
    const name = rawLine.trim().replace(/^[-*]\s+/, '');
    const isDir = name.endsWith('/') || !name.includes('.');
    const cleanName = name.replace(/\/$/, '');

    items.push({ name: cleanName, isDir, depth });
  }

  const treeRows = items.map((item, idx) => {
    const ext = item.name.includes('.') ? item.name.split('.').pop().toLowerCase() : '';
    let iconSvg = '';

    if (item.isDir) {
      iconSvg = `<svg class="w-4 h-4 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`;
    } else if (['js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs', 'py', 'go', 'rs', 'php', 'java', 'c', 'cpp'].includes(ext)) {
      iconSvg = `<svg class="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
    } else if (['json', 'yaml', 'yml', 'toml', 'env', 'config', 'lock'].includes(ext)) {
      iconSvg = `<svg class="w-4 h-4 text-purple-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
    } else if (['md', 'mdx', 'txt', 'pdf', 'doc'].includes(ext)) {
      iconSvg = `<svg class="w-4 h-4 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    } else if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'avif'].includes(ext)) {
      iconSvg = `<svg class="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
    } else {
      iconSvg = `<svg class="w-4 h-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    }

    const paddingLeft = item.depth * 20;

    return `
<div class="docboot-tree-item flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/30 transition-colors" style="padding-left: ${paddingLeft + 8}px;">
  ${iconSvg}
  <span class="docboot-tree-name ${item.isDir ? 'font-semibold text-foreground' : 'text-foreground/80'}">${escapeHtml(item.name)}${item.isDir ? '/' : ''}</span>
</div>`;
  }).join('\n');

  return unindent(`
<div class="docboot-file-tree not-prose my-6 rounded-lg border border-border bg-card-bg/40 font-mono text-xs p-3 overflow-x-auto shadow-2xs">
  <div class="flex items-center gap-2 px-2 py-1.5 border-b border-border/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground select-none">
    <svg class="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
    <span>Project Structure</span>
  </div>
  <div class="py-2">
    ${treeRows}
  </div>
</div>
`);
}

/**
 * 11. Terminal Session Primitive (:::terminal)
 */
function renderTerminal(args, body, config) {
  const lines = body.trim().split(/\r?\n/);
  const commands = [];
  const renderedLines = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      renderedLines.push('<div class="h-3"></div>');
      continue;
    }

    if (trimmed.startsWith('$ ') || trimmed.startsWith('# ') || trimmed.startsWith('> ')) {
      const promptSymbol = trimmed.charAt(0);
      const cmdText = trimmed.slice(2);
      commands.push(cmdText);
      renderedLines.push(`
<div class="docboot-terminal-prompt flex items-start gap-2.5 font-mono text-xs">
  <span class="text-accent font-bold select-none shrink-0">${escapeHtml(promptSymbol)}</span>
  <span class="text-foreground font-semibold">${escapeHtml(cmdText)}</span>
</div>`);
    } else if (trimmed.startsWith('✓ ') || trimmed.startsWith('+ ')) {
      renderedLines.push(`
<div class="docboot-terminal-output flex items-start gap-2.5 font-mono text-xs text-emerald-400">
  <span class="font-bold select-none shrink-0">✓</span>
  <span>${escapeHtml(trimmed.slice(2))}</span>
</div>`);
    } else if (trimmed.startsWith('⚠ ') || trimmed.startsWith('! ')) {
      renderedLines.push(`
<div class="docboot-terminal-output flex items-start gap-2.5 font-mono text-xs text-amber-400">
  <span class="font-bold select-none shrink-0">⚠</span>
  <span>${escapeHtml(trimmed.slice(2))}</span>
</div>`);
    } else if (trimmed.startsWith('✕ ') || trimmed.startsWith('✗ ') || trimmed.startsWith('ERR') || trimmed.startsWith('Error')) {
      renderedLines.push(`
<div class="docboot-terminal-output flex items-start gap-2.5 font-mono text-xs text-rose-400">
  <span class="font-bold select-none shrink-0">✕</span>
  <span>${escapeHtml(trimmed)}</span>
</div>`);
    } else {
      renderedLines.push(`
<div class="docboot-terminal-output font-mono text-xs text-muted-foreground/90 pl-5">
  ${escapeHtml(rawLine)}
</div>`);
    }
  }

  const copyPayload = commands.length > 0 ? commands.join('\n') : body.trim();
  const title = args.title || 'Terminal';

  return unindent(`
<div class="docboot-terminal not-prose my-6 rounded-lg border border-[#21262d] bg-[#0d1117] text-[#e6edf3] shadow-md shadow-black/20 overflow-hidden text-xs font-mono" data-docboot-terminal="true" data-command="${escapeHtml(copyPayload)}">
  <div class="flex items-center justify-between px-4 py-2.5 border-b border-[#21262d] bg-[#161b22] select-none">
    <div class="flex items-center gap-2">
      <div class="flex items-center gap-1.5 mr-2">
        <span class="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/80 inline-block"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/80 inline-block"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-[#27c93f]/80 inline-block"></span>
      </div>
      <span class="font-medium text-[#8b949e] tracking-tight text-[11px]">${escapeHtml(title)}</span>
    </div>
    <button type="button" class="docboot-copy-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-all cursor-pointer" data-code="${escapeHtml(copyPayload)}" aria-label="Copy terminal commands">
      <span class="copy-icon"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></span>
      <span class="copied-icon hidden"><svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>
      <span class="copy-text text-[11px] font-medium">Copy</span>
    </button>
  </div>
  <div class="p-4 space-y-1.5 overflow-x-auto leading-relaxed">
    ${renderedLines.join('\n')}
  </div>
</div>
`);
}

/**
 * 12. Badges & Status (:::badge <status>)
 */
function renderBadge(args, body, config) {
  const status = (args.typeOrTitle || args._positional?.[0] || body.trim() || 'stable').toLowerCase();
  const label = args.label || status.toUpperCase();

  const configs = {
    stable: {
      colorClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      icon: `<svg class="w-3 h-3 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`
    },
    beta: {
      colorClass: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
      icon: `<svg class="w-3 h-3 text-cyan-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`
    },
    experimental: {
      colorClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
      icon: `<svg class="w-3 h-3 text-purple-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4.5 3h15M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3M6 14h12"/></svg>`
    },
    deprecated: {
      colorClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      icon: `<svg class="w-3 h-3 text-rose-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    },
    planned: {
      colorClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      icon: `<svg class="w-3 h-3 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
    }
  };

  const currentConfig = configs[status] || {
    colorClass: 'bg-accent/15 text-accent border-accent/30',
    icon: `<svg class="w-3 h-3 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>`
  };

  return `<span class="docboot-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentConfig.colorClass} select-none align-middle not-prose">${currentConfig.icon}<span>${escapeHtml(label)}</span></span>`;
}

/**
 * 13. Version Since (:::since 0.4.0)
 */
function renderSince(args, body, config) {
  const version = (args.version || args.typeOrTitle || args._positional?.[0] || body.trim() || '0.1.0').replace(/^v/i, '');
  return `<span class="docboot-badge-since inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-border/80 bg-muted/40 text-muted-foreground select-none align-middle not-prose"><svg class="w-3 h-3 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><circle cx="7" cy="7" r=".5" fill="currentColor"/></svg><span>v${escapeHtml(version)}</span></span>`;
}

/**
 * 14. Deprecated Callout Block (:::deprecated)
 */
function renderDeprecated(args, body, config) {
  const since = args.since || args.version || '';
  const parsedBody = body.trim() ? marked.parse(body.trim()) : '<p>This feature has been deprecated and will be removed in a future release.</p>';

  return unindent(`
<div class="docboot-deprecated not-prose my-6 p-4 rounded-lg border-l-4 border-rose-500 bg-rose-500/10 text-foreground shadow-2xs">
  <div class="flex items-center gap-2 font-semibold text-rose-600 dark:text-rose-400 text-sm mb-1.5">
    <svg class="w-4 h-4 text-rose-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <span>Deprecated in v${escapeHtml(since.replace(/^v/i, '') || '2.0.0')}</span>
  </div>
  <div class="text-sm text-foreground/90 leading-relaxed">${parsedBody}</div>
</div>
`);
}

/**
 * 15. Carousel Walkthrough (:::carousel)
 */
function renderCarousel(args, body, config) {
  let slides = [];
  try {
    const parsed = yaml.parse(body);
    if (Array.isArray(parsed)) slides = parsed;
    else if (parsed?.slides && Array.isArray(parsed.slides)) slides = parsed.slides;
  } catch (_) {}

  if (slides.length === 0) {
    slides = [{ src: '', alt: 'Slide 1', caption: body.trim() }];
  }

  const carouselId = 'carousel-' + Math.random().toString(36).slice(2, 9);
  const slidesHtml = slides.map((slide, idx) => {
    const src = slide.src || slide.image || '';
    const alt = slide.alt || `Slide ${idx + 1}`;
    const caption = slide.caption || slide.title || '';
    const resolved = resolveDirectiveImage(src, config);
    const isFirst = idx === 0;

    return `
<div class="docboot-carousel-slide ${isFirst ? 'block' : 'hidden'} relative aspect-video bg-muted/20 flex items-center justify-center overflow-hidden" data-slide-index="${idx}">
  <img
    src="${escapeHtml(resolved.displaySrc)}"
    alt="${escapeHtml(alt)}"
    ${isFirst ? 'loading="eager"' : 'loading="lazy"'}
    decoding="async"
    class="w-full h-full object-cover cursor-zoom-in transition-transform duration-300"
    data-docboot-lightbox="true"
    data-lightbox-src="${escapeHtml(resolved.highResSrc)}"
    data-lightbox-alt="${escapeHtml(alt)}"
    data-lightbox-caption="${escapeHtml(caption)}"
  />
  ${caption ? `<div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white text-xs font-medium">${escapeHtml(caption)}</div>` : ''}
</div>`;
  }).join('\n');

  return unindent(`
<div class="docboot-carousel not-prose my-8 rounded-xl border border-border bg-card-bg/40 shadow-sm overflow-hidden select-none" id="${carouselId}" data-docboot-carousel="true" data-slide-count="${slides.length}">
  <div class="relative overflow-hidden">
    ${slidesHtml}
    <!-- Controls Overlay -->
    <div class="absolute top-3 right-3 flex items-center gap-2">
      <span class="docboot-carousel-counter px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-black/70 text-white backdrop-blur-xs shadow-xs">1 / ${slides.length}</span>
    </div>
    <button type="button" class="docboot-carousel-prev absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer shadow-md focus:outline-hidden" aria-label="Previous slide">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <button type="button" class="docboot-carousel-next absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer shadow-md focus:outline-hidden" aria-label="Next slide">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  </div>
</div>
`);
}

/**
 * 16. File Download Card (:::download)
 */
function renderDownload(args, body, config) {
  let parsed = {};
  if (body.trim().startsWith('{') || body.trim().includes(':')) {
    try {
      parsed = yaml.parse(body) || {};
    } catch (_) {}
  }

  const src = args.src || args.file || args._positional?.[0] || parsed.src || parsed.file || '';
  const label = args.label || args.title || parsed.label || parsed.title || 'Download File';
  const description = args.description || parsed.description || '';
  const rootDir = config.rootDir || process.cwd();
  const docsDir = config.docsDir || rootDir;
  const base = config.base || '/';

  let resolvedUrl = withBase(src.replace(/^\.\//, ''), base);
  let fileSizeStr = '';
  let ext = '';

  if (src && !src.startsWith('http://') && !src.startsWith('https://')) {
    const cleanSrc = src.split('?')[0].split('#')[0];
    let diskPath = null;
    if (config.currentFilePath) {
      const p1 = path.resolve(path.dirname(config.currentFilePath), cleanSrc);
      if (fs.existsSync(p1) && fs.statSync(p1).isFile()) diskPath = p1;
    }
    if (!diskPath) {
      const p2 = path.resolve(docsDir, cleanSrc.replace(/^\/+/, ''));
      if (fs.existsSync(p2) && fs.statSync(p2).isFile()) diskPath = p2;
    }
    if (!diskPath) {
      const p3 = path.resolve(rootDir, 'public', cleanSrc.replace(/^\/+/, ''));
      if (fs.existsSync(p3) && fs.statSync(p3).isFile()) diskPath = p3;
    }

    if (diskPath && fs.existsSync(diskPath)) {
      try {
        const stat = fs.statSync(diskPath);
        const kb = stat.size / 1024;
        fileSizeStr = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
        ext = path.extname(diskPath).replace(/^\./, '').toUpperCase();
      } catch (_) {}
    }
  }

  const filename = args.filename || path.basename(src) || 'file';
  ext = ext || (filename.includes('.') ? filename.split('.').pop().toUpperCase() : 'FILE');

  return unindent(`
<div class="docboot-download not-prose my-6 flex items-center justify-between p-4 rounded-xl border border-border bg-card-bg/60 shadow-2xs hover:border-accent/40 transition-all">
  <div class="flex items-center gap-3.5 min-w-0">
    <div class="w-10 h-10 rounded-lg bg-accent/15 text-accent border border-accent/30 flex items-center justify-center font-bold text-xs shrink-0 select-none">
      ${escapeHtml(ext)}
    </div>
    <div class="min-w-0">
      <div class="font-semibold text-foreground text-sm truncate">${escapeHtml(label)}</div>
      <div class="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
        <span class="font-mono">${escapeHtml(filename)}</span>
        ${fileSizeStr ? `<span>•</span><span>${fileSizeStr}</span>` : ''}
      </div>
      ${description ? `<p class="text-xs text-muted-foreground/90 mt-1">${escapeHtml(description)}</p>` : ''}
    </div>
  </div>
  <a href="${escapeHtml(resolvedUrl)}" download="${escapeHtml(filename)}" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-accent text-accent-foreground hover:opacity-90 transition-opacity shadow-xs shrink-0 ml-4 no-underline">
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    <span>Download</span>
  </a>
</div>
`);
}

/**
 * 17. QR Code Primitive (:::qr)
 */
function renderQr(args, body, config) {
  let parsed = {};
  if (body.trim().startsWith('{') || body.trim().includes(':')) {
    try {
      parsed = yaml.parse(body) || {};
    } catch (_) {}
  }

  const url = (args.url || args._positional?.[0] || parsed.url || body.trim() || '').trim();
  const label = args.label || args.title || parsed.label || parsed.title || 'Scan QR Code';
  const qrSvg = generateQrSvg(url, { size: 140, margin: 2, color: 'currentColor' });

  return unindent(`
<div class="docboot-qr not-prose my-6 inline-flex flex-col items-center p-5 rounded-xl border border-border bg-card-bg/60 shadow-xs text-center">
  <div class="p-3 bg-white text-slate-900 rounded-lg shadow-2xs border border-border/40 mb-3">
    ${qrSvg}
  </div>
  <div class="text-xs font-semibold text-foreground mb-1">${escapeHtml(label)}</div>
  <div class="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="hover:text-accent transition-colors underline truncate max-w-[220px]">${escapeHtml(url)}</a>
    <button type="button" class="docboot-copy-btn p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer" data-code="${escapeHtml(url)}" aria-label="Copy QR URL">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
    </button>
  </div>
</div>
`);
}

/**
 * Helper to parse key-value lines at the top of a directive body,
 * leaving remaining content as Markdown description.
 */
function parseKeyValueBlock(body = '') {
  const lines = body.split(/\r?\n/);
  const metadata = {};
  const descLines = [];
  let inDesc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inDesc) {
      descLines.push(line);
      continue;
    }

    const match = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (match) {
      const key = match[1];
      let val = match[2].trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (/^\d+$/.test(val)) val = parseInt(val, 10);
      else if (/^\d+\.\d+$/.test(val)) val = parseFloat(val);
      else if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      }
      metadata[key] = val;
    } else if (line.trim() === '') {
      if (Object.keys(metadata).length > 0) {
        inDesc = true;
      }
    } else {
      inDesc = true;
      descLines.push(line);
    }
  }

  return { metadata, description: descLines.join('\n').trim() };
}

/**
 * 24. API Endpoint Primitive (:::endpoint GET /api/v1/users)
 */
function renderEndpoint(args, body, config) {
  const { metadata, description: bodyDesc } = parseKeyValueBlock(body);

  const rawTokens = (args._positional || []).concat();
  let method = (args.method || metadata.method || (rawTokens.length > 0 && /^[a-zA-Z]+$/.test(rawTokens[0]) ? rawTokens.shift() : 'GET')).toUpperCase();
  let pathStr = (args.path || metadata.path || rawTokens.join(' ') || args.typeOrTitle || '/').trim();

  if (!pathStr && method.startsWith('/')) {
    pathStr = method;
    method = 'GET';
  }

  const auth = args.auth || metadata.auth || '';
  const status = args.status || metadata.status || '';
  const description = args.description || args.title || metadata.description || metadata.title || '';

  const METHOD_COLORS = {
    GET: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    POST: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    PUT: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    PATCH: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
    DELETE: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    HEAD: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    OPTIONS: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    WS: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    WSS: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    GRAPHQL: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30'
  };

  const badgeClass = METHOD_COLORS[method] || 'bg-muted text-foreground border-border/80';
  const highlightedPath = escapeHtml(pathStr).replace(/(:\w+|\{\w+\})/g, '<span class="text-accent font-bold">$1</span>');

  let authBadge = '';
  if (auth) {
    authBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted/80 text-muted-foreground border border-border/60"><svg class="w-3 h-3 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg><span>${escapeHtml(auth)}</span></span>`;
  }

  let statusBadge = '';
  if (status) {
    statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">${escapeHtml(status)}</span>`;
  }

  let innerHtml = '';
  if (bodyDesc.trim()) {
    const processedBody = processDirectives(bodyDesc.trim(), config);
    innerHtml = marked.parse(processedBody);
  }

  return unindent(`
<div class="docboot-endpoint not-prose my-8 rounded-xl border border-border bg-card/60 overflow-hidden shadow-2xs">
  <div class="docboot-endpoint-header flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 bg-muted/35 border-b border-border">
    <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
      <span class="docboot-method-badge font-mono font-bold text-xs px-2.5 py-1 rounded-md uppercase tracking-wider border shadow-2xs select-none ${badgeClass}">${escapeHtml(method)}</span>
      <div class="font-mono text-xs sm:text-sm font-semibold text-foreground tracking-tight select-all truncate">${highlightedPath}</div>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      ${authBadge}
      ${statusBadge}
      <button type="button" class="docboot-copy-btn p-1.5 rounded-lg border border-border/70 bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs" data-code="${escapeHtml(pathStr)}" aria-label="Copy endpoint path">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      </button>
    </div>
  </div>
  ${description ? `<div class="px-4 pt-3 text-xs sm:text-sm text-muted-foreground font-medium">${escapeHtml(description)}</div>` : ''}
  ${innerHtml ? `<div class="docboot-endpoint-content p-4 space-y-4 text-sm">${innerHtml}</div>` : ''}
</div>
`);
}

/**
 * 25. Request Block (:::request)
 */
function renderRequest(args, body, config) {
  const method = (args._positional?.[0] || args.method || 'REQUEST').toUpperCase();
  const pathStr = (args._positional?.slice(1).join(' ') || args.path || '').trim();
  const title = args.title || 'Request';

  let innerHtml = '';
  if (body.trim()) {
    const processedBody = processDirectives(body.trim(), config);
    innerHtml = marked.parse(processedBody);
  }

  return unindent(`
<div class="docboot-request not-prose my-6 rounded-xl border border-border bg-card/60 overflow-hidden shadow-2xs">
  <div class="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/30 border-b border-border text-xs">
    <div class="flex items-center gap-2 font-medium text-foreground">
      <svg class="w-3.5 h-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
      <span class="font-semibold">${escapeHtml(title)}</span>
      ${pathStr ? `<span class="font-mono text-muted-foreground font-normal">${escapeHtml(method)} ${escapeHtml(pathStr)}</span>` : ''}
    </div>
    <span class="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider select-none">HTTP Payload</span>
  </div>
  <div class="p-4 text-sm leading-relaxed">${innerHtml}</div>
</div>
`);
}

/**
 * 26. Response Block (:::response 200 OK)
 */
function renderResponse(args, body, config) {
  const statusRaw = (args._positional?.join(' ') || args.status || '200 OK').trim();
  const statusMatch = statusRaw.match(/^(\d{3})(?:\s+(.*))?$/);
  const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 200;
  const statusText = (statusMatch && statusMatch[2]) ? statusMatch[2] : (statusCode === 200 ? 'OK' : statusCode === 201 ? 'Created' : statusCode === 204 ? 'No Content' : statusCode === 400 ? 'Bad Request' : statusCode === 401 ? 'Unauthorized' : statusCode === 404 ? 'Not Found' : statusCode === 500 ? 'Internal Server Error' : '');

  let statusBadgeClass = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  if (statusCode >= 300 && statusCode < 400) {
    statusBadgeClass = 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30';
  } else if (statusCode >= 400 && statusCode < 500) {
    statusBadgeClass = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
  } else if (statusCode >= 500) {
    statusBadgeClass = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
  }

  const contentType = args.type || args['content-type'] || 'application/json';

  let innerHtml = '';
  if (body.trim()) {
    const processedBody = processDirectives(body.trim(), config);
    innerHtml = marked.parse(processedBody);
  }

  return unindent(`
<div class="docboot-response not-prose my-6 rounded-xl border border-border bg-card/60 overflow-hidden shadow-2xs">
  <div class="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/30 border-b border-border text-xs">
    <div class="flex items-center gap-2.5">
      <span class="inline-flex items-center gap-1.5 font-mono font-bold text-xs px-2 py-0.5 rounded-md border ${statusBadgeClass}">
        <span>${statusCode}</span>
        ${statusText ? `<span class="font-medium opacity-90">${escapeHtml(statusText)}</span>` : ''}
      </span>
      <span class="font-mono text-[11px] text-muted-foreground hidden sm:inline">${escapeHtml(contentType)}</span>
    </div>
    <span class="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider select-none">Response</span>
  </div>
  <div class="p-4 text-sm leading-relaxed">${innerHtml}</div>
</div>
`);
}

/**
 * 27. Parameter List / Table Primitive (:::params)
 */
function renderParams(args, body, config) {
  let paramList = [];

  if (body.trim().startsWith('-') || (body.trim().includes(':') && !body.includes('```'))) {
    try {
      const parsed = yaml.parse(body);
      if (Array.isArray(parsed)) {
        paramList = parsed;
      } else if (parsed && typeof parsed === 'object') {
        paramList = Object.entries(parsed).map(([key, val]) => {
          if (typeof val === 'object' && val !== null) {
            return { name: key, ...val };
          }
          return { name: key, description: String(val) };
        });
      }
    } catch (_) {}
  }

  if (paramList.length === 0 && body.trim()) {
    const lines = body.trim().split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim().replace(/^[-*]\s+/, '');
      if (!trimmed) continue;
      const match = trimmed.match(/^`?([a-zA-Z0-9_.[\]-]+)`?(?:\s*\(([^)]+)\))?\s*:\s*(.*)$/);
      if (match) {
        const name = match[1];
        const metaStr = match[2] || '';
        const desc = match[3] || '';
        const isReq = /\brequired\b/i.test(metaStr);
        const defMatch = metaStr.match(/default:\s*([^\s,)]+)/i);
        const typeMatch = metaStr.replace(/\brequired\b|\boptional\b|default:[^,)]+/gi, '').replace(/[, ]+/g, ' ').trim();
        paramList.push({
          name,
          type: typeMatch || 'string',
          required: isReq,
          default: defMatch ? defMatch[1] : undefined,
          description: desc
        });
      } else {
        paramList.push({ name: trimmed, description: '' });
      }
    }
  }

  const title = args.title || (args._positional?.[0] ? args._positional.join(' ') : 'Parameters');

  let rowsHtml = '';
  for (const p of paramList) {
    const name = p.name || 'param';
    const type = p.type || 'string';
    const isRequired = p.required === true || p.required === 'true' || p.required === 'required';
    const defaultValue = p.default !== undefined ? String(p.default) : (p.defaultValue !== undefined ? String(p.defaultValue) : undefined);
    const desc = p.description || p.desc || '';
    const enumVals = Array.isArray(p.enum) ? p.enum : [];

    let enumChips = '';
    if (enumVals.length > 0) {
      enumChips = enumVals.map(v => `<code class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/80 border border-border/60 text-foreground">${escapeHtml(String(v))}</code>`).join(' ');
    }

    const renderedDesc = desc ? marked.parseInline(desc) : '';

    rowsHtml += `
<div class="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 hover:bg-muted/20 transition-colors">
  <div class="space-y-1.5 min-w-0 flex-1">
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-mono font-bold text-foreground text-xs sm:text-sm tracking-tight select-all">${escapeHtml(name)}</span>
      <span class="font-mono text-[11px] px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground border border-border/60 font-medium">${escapeHtml(type)}</span>
      ${isRequired 
        ? '<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 uppercase tracking-wider">Required</span>' 
        : '<span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border/40 lowercase">optional</span>'}
      ${defaultValue !== undefined 
        ? `<span class="font-mono text-[11px] text-muted-foreground flex items-center gap-1">default: <code class="px-1.5 py-0.2 rounded bg-muted border border-border/60 text-foreground text-[10px] font-semibold">${escapeHtml(defaultValue)}</code></span>` 
        : ''}
    </div>
    ${renderedDesc ? `<div class="text-xs text-muted-foreground/90 leading-relaxed">${renderedDesc}</div>` : ''}
    ${enumChips ? `<div class="flex flex-wrap items-center gap-1.5 pt-0.5"><span class="text-[11px] text-muted-foreground font-medium">Options:</span>${enumChips}</div>` : ''}
  </div>
</div>`;
  }

  return unindent(`
<div class="docboot-params not-prose my-6 rounded-xl border border-border bg-card/40 overflow-hidden shadow-2xs">
  ${title ? `<div class="px-4 py-2.5 bg-muted/30 border-b border-border text-xs font-semibold text-foreground flex items-center gap-2 select-none"><svg class="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7"/></svg><span>${escapeHtml(title)}</span></div>` : ''}
  <div class="divide-y divide-border/60">
    ${rowsHtml}
  </div>
</div>
`);
}

/**
 * 28. Single Property Card (:::property)
 */
function renderProperty(args, body, config) {
  const { metadata, description: bodyDesc } = parseKeyValueBlock(body);

  const name = args.name || args._positional?.[0] || metadata.name || 'property';
  const type = args.type || metadata.type || 'string';
  const isRequired = args.required === 'true' || args.required === true || metadata.required === true || metadata.required === 'true';
  const defaultValue = args.default !== undefined ? args.default : metadata.default;
  const description = bodyDesc || args.description || metadata.description || '';

  let innerDescHtml = '';
  if (description) {
    innerDescHtml = marked.parse(processDirectives(description, config));
  }

  return unindent(`
<div class="docboot-property not-prose my-6 p-4 rounded-xl border border-border bg-card/40 shadow-2xs space-y-2.5">
  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="font-mono font-bold text-foreground text-sm tracking-tight select-all">${escapeHtml(name)}</span>
      <span class="font-mono text-xs px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground border border-border/60 font-medium">${escapeHtml(type)}</span>
      ${isRequired 
        ? '<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 uppercase tracking-wider">Required</span>' 
        : '<span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border/40 lowercase">optional</span>'}
    </div>
    ${defaultValue !== undefined 
      ? `<span class="font-mono text-[11px] text-muted-foreground flex items-center gap-1">default: <code class="px-1.5 py-0.2 rounded bg-muted border border-border/60 text-foreground text-[10px] font-semibold">${escapeHtml(String(defaultValue))}</code></span>` 
      : ''}
  </div>
  ${innerDescHtml ? `<div class="text-xs sm:text-sm text-muted-foreground/90 leading-relaxed">${innerDescHtml}</div>` : ''}
</div>
`);
}

/**
 * 29. Environment Variable Card (:::env)
 */
function renderEnv(args, body, config) {
  const { metadata, description: bodyDesc } = parseKeyValueBlock(body);

  const name = args.name || args._positional?.[0] || metadata.name || 'ENV_VAR';
  const type = args.type || metadata.type || 'string';
  const isRequired = args.required === 'true' || args.required === true || metadata.required === true;
  const defaultValue = args.default !== undefined ? args.default : metadata.default;
  const description = bodyDesc || args.description || metadata.description || '';

  let innerDescHtml = '';
  if (description) {
    innerDescHtml = marked.parse(processDirectives(description, config));
  }

  return unindent(`
<div class="docboot-env not-prose my-6 p-4 rounded-xl border border-border bg-card/40 shadow-2xs space-y-2.5">
  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
    <div class="flex items-center gap-2 flex-wrap">
      <div class="w-6 h-6 rounded-md bg-accent/15 text-accent border border-accent/25 flex items-center justify-center font-mono font-bold text-[11px] shrink-0 select-none">$_</div>
      <span class="font-mono font-bold text-foreground text-sm tracking-tight select-all">${escapeHtml(name)}</span>
      <span class="font-mono text-xs px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground border border-border/60 font-medium">${escapeHtml(type)}</span>
      ${isRequired 
        ? '<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 uppercase tracking-wider">Required</span>' 
        : '<span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border/40 lowercase">optional</span>'}
    </div>
    <div class="flex items-center gap-2">
      ${defaultValue !== undefined 
        ? `<span class="font-mono text-[11px] text-muted-foreground flex items-center gap-1">default: <code class="px-1.5 py-0.2 rounded bg-muted border border-border/60 text-foreground text-[10px] font-semibold">${escapeHtml(String(defaultValue))}</code></span>` 
        : ''}
      <button type="button" class="docboot-copy-btn p-1 rounded-md border border-border/70 bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs" data-code="${escapeHtml(name)}" aria-label="Copy environment variable name">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      </button>
    </div>
  </div>
  ${innerDescHtml ? `<div class="text-xs sm:text-sm text-muted-foreground/90 leading-relaxed">${innerDescHtml}</div>` : ''}
</div>
`);
}

/**
 * 30. Configuration Option Card (:::config-option)
 */
function renderConfigOption(args, body, config) {
  const { metadata, description: bodyDesc } = parseKeyValueBlock(body);

  const name = args.name || args._positional?.[0] || metadata.name || 'option';
  const type = args.type || metadata.type || 'string';
  const isRequired = args.required === 'true' || args.required === true || metadata.required === true;
  const defaultValue = args.default !== undefined ? args.default : metadata.default;
  const description = bodyDesc || args.description || metadata.description || '';
  const enumVals = Array.isArray(metadata.enum) ? metadata.enum : (Array.isArray(args.enum) ? args.enum : []);

  let innerDescHtml = '';
  if (description) {
    innerDescHtml = marked.parse(processDirectives(description, config));
  }

  let enumChips = '';
  if (enumVals.length > 0) {
    enumChips = enumVals.map(v => `<code class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/80 border border-border/60 text-foreground">${escapeHtml(String(v))}</code>`).join(' ');
  }

  return unindent(`
<div class="docboot-config-option not-prose my-6 p-4 rounded-xl border border-border bg-card/40 shadow-2xs space-y-2.5">
  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
    <div class="flex items-center gap-2 flex-wrap">
      <div class="w-6 h-6 rounded-md bg-accent/15 text-accent border border-accent/25 flex items-center justify-center font-mono font-bold text-[11px] shrink-0 select-none">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
      </div>
      <span class="font-mono font-bold text-foreground text-sm tracking-tight select-all">${escapeHtml(name)}</span>
      <span class="font-mono text-xs px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground border border-border/60 font-medium">${escapeHtml(type)}</span>
      ${isRequired 
        ? '<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 uppercase tracking-wider">Required</span>' 
        : '<span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border/40 lowercase">optional</span>'}
    </div>
    <div class="flex items-center gap-2">
      ${defaultValue !== undefined 
        ? `<span class="font-mono text-[11px] text-muted-foreground flex items-center gap-1">default: <code class="px-1.5 py-0.2 rounded bg-muted border border-border/60 text-foreground text-[10px] font-semibold">${escapeHtml(String(defaultValue))}</code></span>` 
        : ''}
      <button type="button" class="docboot-copy-btn p-1 rounded-md border border-border/70 bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs" data-code="${escapeHtml(name)}" aria-label="Copy config key">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      </button>
    </div>
  </div>
  ${innerDescHtml ? `<div class="text-xs sm:text-sm text-muted-foreground/90 leading-relaxed">${innerDescHtml}</div>` : ''}
  ${enumChips ? `<div class="flex flex-wrap items-center gap-1.5 pt-1"><span class="text-[11px] text-muted-foreground font-medium">Allowed values:</span>${enumChips}</div>` : ''}
</div>
`);
}

/**
 * Common SVG & Emoji Icon Resolver
 */
function renderDirectiveIcon(iconStr, extraClass = 'w-5 h-5') {
  if (!iconStr) return '';
  const trimmed = iconStr.trim();
  if (!trimmed) return '';

  const ICONS = {
    zap: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
    bolt: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
    rocket: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.41m5.96 5.96a14.926 14.926 0 01-5.84 1.83m0 0L4.5 21.5l1.5-5.25m3.75 0a14.926 14.926 0 01-1.83-5.84m0 0a6 6 0 017.38-5.84"/></svg>`,
    search: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`,
    shield: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
    cpu: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2m-6-2v2M15 20v2m-6-2v2M2 15h2m-2-6h2M20 15h2m-2-6h2"/></svg>`,
    terminal: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
    globe: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
    box: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`,
    package: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`,
    feather: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5zM16 8L2 22M17.5 15H9"/></svg>`,
    lock: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
    code: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>`,
    sparkles: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>`,
    star: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    heart: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
    check: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    gear: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
    book: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,
    layers: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    database: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
    server: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
    cloud: `<svg class="${extraClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>`
  };

  const key = trimmed.toLowerCase();
  if (ICONS[key]) {
    return ICONS[key];
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('./')) {
    return `<img src="${escapeHtml(trimmed)}" alt="Icon" class="${extraClass} object-contain select-none" />`;
  }

  return `<span class="text-xl leading-none select-none">${escapeHtml(trimmed)}</span>`;
}

/**
 * 31. Cards Grid Primitive (:::cards)
 */
function renderCards(args, body, config) {
  const cols = args.cols || args._positional?.[0] || '3';
  let gridColsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  if (cols === '1') gridColsClass = 'grid-cols-1';
  else if (cols === '2') gridColsClass = 'grid-cols-1 sm:grid-cols-2';
  else if (cols === '4') gridColsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  const cardRegex = /::card(?:\s+([^\r\n]+))?\r?\n([\s\S]*?)(?=(?:::card|\s*$))/gi;
  const cards = [];
  let match;

  while ((match = cardRegex.exec(body)) !== null) {
    const rawHeader = (match[1] || '').trim();
    const subBody = (match[2] || '').trim().replace(/::$/, '').trim();
    const cardArgs = parseDirectiveArgs(rawHeader);
    const { metadata, description: bodyDesc } = parseKeyValueBlock(subBody);

    const title = cardArgs.title || cardArgs.typeOrTitle || cardArgs._positional?.join(' ') || metadata.title || 'Card';
    const href = cardArgs.href || cardArgs.to || cardArgs.url || metadata.href || metadata.to || metadata.url || '';
    const icon = cardArgs.icon || metadata.icon || '';
    const badge = cardArgs.badge || metadata.badge || '';
    const desc = bodyDesc || cardArgs.description || metadata.description || '';

    cards.push({ title, href, icon, badge, desc });
  }

  // Fallback: check YAML list of cards
  if (cards.length === 0 && (body.trim().startsWith('-') || body.trim().startsWith('['))) {
    try {
      const parsed = yaml.parse(body);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            cards.push({
              title: item.title || item.name || 'Card',
              href: item.href || item.to || item.url || '',
              icon: item.icon || '',
              badge: item.badge || '',
              desc: item.description || item.desc || ''
            });
          }
        }
      }
    } catch (_) {}
  }

  let cardsHtml = '';
  for (const c of cards) {
    const iconHtml = renderDirectiveIcon(c.icon, 'w-5 h-5');
    const badgeHtml = c.badge ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/15 text-accent border border-accent/25 select-none">${escapeHtml(c.badge)}</span>` : '';
    const innerDescHtml = c.desc ? marked.parse(processDirectives(c.desc, config)) : '';

    if (c.href) {
      cardsHtml += `
<a href="${escapeHtml(c.href)}" class="docboot-card group relative flex flex-col justify-between p-5 rounded-xl border border-border bg-card/60 hover:bg-card hover:border-accent/60 shadow-2xs hover:shadow-md transition-all duration-200 -translate-y-0 hover:-translate-y-0.5 no-underline">
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      ${iconHtml ? `<div class="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent group-hover:scale-105 transition-transform shrink-0">${iconHtml}</div>` : '<div></div>'}
      ${badgeHtml}
    </div>
    <h3 class="font-semibold text-base text-foreground group-hover:text-accent transition-colors flex items-center justify-between gap-2 m-0">
      <span>${escapeHtml(c.title)}</span>
      <svg class="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
    </h3>
    ${innerDescHtml ? `<div class="text-xs sm:text-sm text-muted-foreground leading-relaxed prose-sm [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">${innerDescHtml}</div>` : ''}
  </div>
</a>`;
    } else {
      cardsHtml += `
<div class="docboot-card relative flex flex-col justify-between p-5 rounded-xl border border-border bg-card/60 shadow-2xs space-y-3 hover:border-border/80 transition-colors">
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      ${iconHtml ? `<div class="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">${iconHtml}</div>` : '<div></div>'}
      ${badgeHtml}
    </div>
    <h3 class="font-semibold text-base text-foreground m-0">${escapeHtml(c.title)}</h3>
    ${innerDescHtml ? `<div class="text-xs sm:text-sm text-muted-foreground leading-relaxed prose-sm [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">${innerDescHtml}</div>` : ''}
  </div>
</div>`;
    }
  }

  return unindent(`
<div class="docboot-cards not-prose my-8 grid ${gridColsClass} gap-4 sm:gap-5">
  ${cardsHtml}
</div>
`);
}

/**
 * Standalone Single Card Primitive (:::card)
 */
function renderCard(args, body, config) {
  const { metadata, description: bodyDesc } = parseKeyValueBlock(body);
  const title = args.title || args.typeOrTitle || args._positional?.join(' ') || metadata.title || 'Card';
  const href = args.href || args.to || args.url || metadata.href || metadata.to || metadata.url || '';
  const icon = args.icon || metadata.icon || '';
  const badge = args.badge || metadata.badge || '';
  const desc = bodyDesc || args.description || metadata.description || '';

  const iconHtml = renderDirectiveIcon(icon, 'w-5 h-5');
  const badgeHtml = badge ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/15 text-accent border border-accent/25 select-none">${escapeHtml(badge)}</span>` : '';
  const innerDescHtml = desc ? marked.parse(processDirectives(desc, config)) : '';

  if (href) {
    return unindent(`
<a href="${escapeHtml(href)}" class="docboot-card not-prose my-6 group relative flex flex-col justify-between p-5 rounded-xl border border-border bg-card/60 hover:bg-card hover:border-accent/60 shadow-2xs hover:shadow-md transition-all duration-200 no-underline block">
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      ${iconHtml ? `<div class="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent group-hover:scale-105 transition-transform shrink-0">${iconHtml}</div>` : '<div></div>'}
      ${badgeHtml}
    </div>
    <h3 class="font-semibold text-base text-foreground group-hover:text-accent transition-colors flex items-center justify-between gap-2 m-0">
      <span>${escapeHtml(title)}</span>
      <svg class="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
    </h3>
    ${innerDescHtml ? `<div class="text-xs sm:text-sm text-muted-foreground leading-relaxed prose-sm [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">${innerDescHtml}</div>` : ''}
  </div>
</a>
`);
  }

  return unindent(`
<div class="docboot-card not-prose my-6 relative flex flex-col justify-between p-5 rounded-xl border border-border bg-card/60 shadow-2xs space-y-3">
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      ${iconHtml ? `<div class="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">${iconHtml}</div>` : '<div></div>'}
      ${badgeHtml}
    </div>
    <h3 class="font-semibold text-base text-foreground m-0">${escapeHtml(title)}</h3>
    ${innerDescHtml ? `<div class="text-xs sm:text-sm text-muted-foreground leading-relaxed prose-sm [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">${innerDescHtml}</div>` : ''}
  </div>
</div>
`);
}

/**
 * 32. Metric / KPI Stat Cards (:::metrics, :::stats)
 */
function renderMetrics(args, body, config) {
  const cols = args.cols || args._positional?.[0] || '3';
  let gridColsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  if (cols === '1') gridColsClass = 'grid-cols-1';
  else if (cols === '2') gridColsClass = 'grid-cols-1 sm:grid-cols-2';
  else if (cols === '4') gridColsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  const metricRegex = /::metric(?:\s+([^\r\n]+))?\r?\n([\s\S]*?)(?=(?:::metric|\s*$))/gi;
  const metrics = [];
  let match;

  while ((match = metricRegex.exec(body)) !== null) {
    const rawHeader = (match[1] || '').trim();
    const subBody = (match[2] || '').trim().replace(/::$/, '').trim();
    const metricArgs = parseDirectiveArgs(rawHeader);

    let val = '';
    let label = '';
    let desc = '';
    let trend = metricArgs.trend || metricArgs.change || '';

    const headerTokens = (metricArgs._positional || []).concat();
    if (headerTokens.length >= 2) {
      val = headerTokens[0];
      label = headerTokens.slice(1).join(' ');
      desc = subBody;
    } else if (headerTokens.length === 1) {
      const single = headerTokens[0];
      const bodyLines = subBody.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (bodyLines.length > 0) {
        // If single token looks like value (starts with digit/symbol/percentage), single is val and line 1 is label
        if (/^[\d+~><$€£¥#]/.test(single)) {
          val = single;
          label = bodyLines[0];
          desc = bodyLines.slice(1).join('\n');
        } else {
          label = single;
          val = bodyLines[0];
          desc = bodyLines.slice(1).join('\n');
        }
      } else {
        val = single;
        label = '';
      }
    } else {
      const bodyLines = subBody.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (bodyLines.length >= 2) {
        val = bodyLines[0];
        label = bodyLines[1];
        desc = bodyLines.slice(2).join('\n');
      } else if (bodyLines.length === 1) {
        val = bodyLines[0];
      }
    }

    metrics.push({ value: val, label, trend, desc });
  }

  // Fallback: check YAML list of metrics
  if (metrics.length === 0 && (body.trim().startsWith('-') || body.trim().startsWith('['))) {
    try {
      const parsed = yaml.parse(body);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            metrics.push({
              value: item.value || item.val || '',
              label: item.label || item.title || item.name || '',
              trend: item.trend || item.change || '',
              desc: item.description || item.desc || ''
            });
          }
        }
      }
    } catch (_) {}
  }

  let itemsHtml = '';
  for (const m of metrics) {
    let trendBadge = '';
    if (m.trend) {
      const isPositive = m.trend.startsWith('+') || m.trend.includes('▲');
      const isNegative = m.trend.startsWith('-') || m.trend.includes('▼');
      const badgeColor = isNegative 
        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' 
        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      const arrow = isNegative ? '▼ ' : (isPositive ? '▲ ' : '');
      trendBadge = `<span class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${badgeColor} select-none">${arrow}${escapeHtml(m.trend.replace(/^[▲▼]\s*/, ''))}</span>`;
    }

    const descHtml = m.desc ? marked.parseInline(m.desc) : '';

    itemsHtml += `
<div class="docboot-metric-card p-5 rounded-xl border border-border bg-card/60 shadow-2xs flex flex-col justify-between space-y-2.5 hover:border-border/80 transition-colors">
  <div class="flex items-baseline justify-between gap-3">
    <div class="font-mono text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight select-all">${escapeHtml(m.value)}</div>
    ${trendBadge}
  </div>
  ${m.label ? `<div class="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider select-none">${escapeHtml(m.label)}</div>` : ''}
  ${descHtml ? `<div class="text-xs text-muted-foreground/90 leading-relaxed pt-1.5 border-t border-border/40">${descHtml}</div>` : ''}
</div>`;
  }

  return unindent(`
<div class="docboot-metrics not-prose my-8 grid ${gridColsClass} gap-4 sm:gap-5">
  ${itemsHtml}
</div>
`);
}

/**
 * 33. Hero & Banner Block (:::hero)
 */
function renderHero(args, body, config) {
  const { metadata, description: bodyDesc } = parseKeyValueBlock(body);

  const title = args.title || metadata.title || args.typeOrTitle || '';
  const badge = args.badge || metadata.badge || '';
  const tagline = args.tagline || args.subtitle || metadata.tagline || metadata.subtitle || '';
  const primaryText = args.primaryText || args.primary_text || metadata.primaryText || metadata.primary_text || '';
  const primaryLink = args.primaryLink || args.primary_link || metadata.primaryLink || metadata.primary_link || '#';
  const secondaryText = args.secondaryText || args.secondary_text || metadata.secondaryText || metadata.secondary_text || '';
  const secondaryLink = args.secondaryLink || args.secondary_link || metadata.secondaryLink || metadata.secondary_link || '#';
  const align = args.align || metadata.align || 'center';

  const alignClass = align === 'left' ? 'text-left items-start' : 'text-center items-center';

  let badgeHtml = '';
  if (badge) {
    badgeHtml = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent/15 text-accent border border-accent/25 shadow-2xs select-none">${escapeHtml(badge)}</span>`;
  }

  let buttonsHtml = '';
  if (primaryText || secondaryText) {
    buttonsHtml = `
<div class="flex flex-wrap items-center ${align === 'left' ? 'justify-start' : 'justify-center'} gap-3 pt-2">
  ${primaryText ? `<a href="${escapeHtml(primaryLink)}" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-contrast font-semibold text-sm hover:opacity-95 shadow-xs transition-all no-underline">${escapeHtml(primaryText)} <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></a>` : ''}
  ${secondaryText ? `<a href="${escapeHtml(secondaryLink)}" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-muted/80 hover:bg-muted text-foreground border border-border font-medium text-sm transition-all no-underline">${escapeHtml(secondaryText)}</a>` : ''}
</div>`;
  }

  let innerContentHtml = '';
  if (bodyDesc.trim()) {
    innerContentHtml = marked.parse(processDirectives(bodyDesc.trim(), config));
  }

  return unindent(`
<div class="docboot-hero not-prose my-8 sm:my-12 p-6 sm:p-10 md:p-12 rounded-2xl border border-border/80 bg-gradient-to-b from-accent/10 via-card/50 to-card/80 shadow-xs flex flex-col ${alignClass} space-y-4">
  ${badgeHtml}
  ${title ? `<h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight leading-tight m-0">${escapeHtml(title)}</h1>` : ''}
  ${tagline ? `<p class="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed m-0">${escapeHtml(tagline)}</p>` : ''}
  ${buttonsHtml}
  ${innerContentHtml ? `<div class="w-full pt-4 text-left text-sm">${innerContentHtml}</div>` : ''}
</div>
`);
}

/**
 * 34. Feature Grid (:::features)
 */
function renderFeatures(args, body, config) {
  const cols = args.cols || args._positional?.[0] || '3';
  let gridColsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  if (cols === '1') gridColsClass = 'grid-cols-1';
  else if (cols === '2') gridColsClass = 'grid-cols-1 sm:grid-cols-2';
  else if (cols === '4') gridColsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  const featRegex = /::feature(?:\s+([^\r\n]+))?\r?\n([\s\S]*?)(?=(?:::feature|\s*$))/gi;
  const features = [];
  let match;

  while ((match = featRegex.exec(body)) !== null) {
    const rawHeader = (match[1] || '').trim();
    const subBody = (match[2] || '').trim().replace(/::$/, '').trim();
    const featArgs = parseDirectiveArgs(rawHeader);
    const { metadata, description: bodyDesc } = parseKeyValueBlock(subBody);

    const title = featArgs.title || featArgs.typeOrTitle || featArgs._positional?.join(' ') || metadata.title || 'Feature';
    const icon = featArgs.icon || metadata.icon || '';
    const desc = bodyDesc || featArgs.description || metadata.description || '';

    features.push({ title, icon, desc });
  }

  // Fallback: check YAML list of features
  if (features.length === 0 && (body.trim().startsWith('-') || body.trim().startsWith('['))) {
    try {
      const parsed = yaml.parse(body);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            features.push({
              title: item.title || item.name || 'Feature',
              icon: item.icon || '',
              desc: item.description || item.desc || ''
            });
          }
        }
      }
    } catch (_) {}
  }

  let itemsHtml = '';
  for (const f of features) {
    const iconHtml = renderDirectiveIcon(f.icon, 'w-5 h-5');
    const descHtml = f.desc ? marked.parse(processDirectives(f.desc, config)) : '';

    itemsHtml += `
<div class="docboot-feature-card p-5 rounded-xl border border-border bg-card/60 shadow-2xs space-y-3 hover:border-accent/40 transition-colors">
  ${iconHtml ? `<div class="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">${iconHtml}</div>` : ''}
  <h3 class="font-semibold text-base text-foreground m-0">${escapeHtml(f.title)}</h3>
  ${descHtml ? `<div class="text-xs sm:text-sm text-muted-foreground leading-relaxed prose-sm [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">${descHtml}</div>` : ''}
</div>`;
  }

  return unindent(`
<div class="docboot-features not-prose my-8 grid ${gridColsClass} gap-4 sm:gap-5">
  ${itemsHtml}
</div>
`);
}

/**
 * 35. Compatibility Matrix Primitive (:::compat)
 */
function renderCompat(args, body, config) {
  const title = args.title || (args._positional?.length ? args._positional.join(' ') : 'Compatibility & Support');
  let items = [];

  if (body.trim().startsWith('-') || body.trim().startsWith('[')) {
    try {
      const parsed = yaml.parse(body);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            items.push({
              platform: item.platform || item.name || 'Platform',
              version: String(item.version || item.support || 'Yes'),
              status: item.status || ''
            });
          }
        }
      }
    } catch (_) {}
  }

  if (items.length === 0 && body.trim()) {
    const lines = body.trim().split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^`?([a-zA-Z0-9_.\s-]+)`?\s*:\s*(.*)$/);
      if (match) {
        items.push({
          platform: match[1].trim(),
          version: match[2].trim(),
          status: ''
        });
      }
    }
  }

  const PLATFORM_ICONS = {
    chrome: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg>`,
    firefox: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0110 10c0 4-2.5 7.5-6 9-1-2-1-4 0-6s1-4-1-5c-2 2-2 5-1 7-3-1.5-5-4.5-5-8a10 10 0 013-7z"/></svg>`,
    safari: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
    edge: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
    opera: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="7"/></svg>`,
    node: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l9 5v10l-9 5-9-5V7l9-5z"/><polyline points="12 22 12 12 21 7"/><polyline points="12 12 3 7"/></svg>`,
    'node.js': `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l9 5v10l-9 5-9-5V7l9-5z"/><polyline points="12 22 12 12 21 7"/><polyline points="12 12 3 7"/></svg>`,
    deno: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
    bun: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
    ios: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="20" x="5" y="2" rx="3"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    android: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10v7a2 2 0 002 2h12a2 2 0 002-2v-7"/><path d="M7 6l-2-3M17 6l2-3"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/></svg>`,
    linux: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a5 5 0 00-5 5c0 2 1 3 1 5-2 1-3 3-3 5a3 3 0 003 3h8a3 3 0 003-3c0-2-1-4-3-5 0-2 1-3 1-5a5 5 0 00-5-5z"/></svg>`,
    macos: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20.94c1.88 0 2.94-1.06 4.38-1.06 1.41 0 2.38 1.06 4.25 1.06 2.06 0 3.75-1.5 4.88-3.13-2.38-1.38-2.75-4.63-.38-6.19-1.25-1.88-3.19-2.06-4.25-2.06-1.5 0-2.88.94-3.88.94-1 0-2.19-.94-3.75-.94-2.19 0-4.38 1.5-5.38 3.63-1.63 3.38-.44 8.44 1.75 11.38.94 1.38 2.06 2.38 3.38 2.38z"/><path d="M14.5 5.5c.88-1.13 1.5-2.69 1.31-4.25-1.38.06-2.94.94-3.81 2.06-.75.88-1.44 2.44-1.25 3.94 1.5.12 3-.88 3.75-1.75z"/></svg>`,
    windows: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></svg>`
  };

  let cardsHtml = '';
  for (const item of items) {
    const key = item.platform.toLowerCase().replace(/[^a-z0-9.]/g, '');
    const iconHtml = PLATFORM_ICONS[key] || renderDirectiveIcon(item.platform, 'w-4 h-4') || `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/></svg>`;
    const valLower = item.version.toLowerCase().trim();

    let badgeClass = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    let label = item.version;

    if (valLower === 'yes' || valLower === 'true' || valLower === 'supported' || valLower === 'full') {
      label = '✓ Yes';
    } else if (valLower === 'no' || valLower === 'false' || valLower === 'unsupported') {
      badgeClass = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
      label = '✕ No';
    } else if (valLower.includes('partial') || valLower.includes('experimental')) {
      badgeClass = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      label = '⚠ ' + item.version;
    }

    cardsHtml += `
<div class="flex flex-col items-center justify-between p-3 rounded-xl border border-border/80 bg-card/60 text-center gap-2 hover:border-border transition-colors">
  <div class="flex items-center gap-1.5 text-muted-foreground">
    ${iconHtml}
    <span class="text-xs font-semibold text-foreground truncate max-w-[90px]">${escapeHtml(item.platform)}</span>
  </div>
  <span class="font-mono text-xs font-bold px-2 py-0.5 rounded-md border ${badgeClass} select-all">${escapeHtml(label)}</span>
</div>`;
  }

  return unindent(`
<div class="docboot-compat not-prose my-6 rounded-xl border border-border bg-card/40 shadow-2xs overflow-hidden">
  ${title ? `<div class="px-4 py-2.5 bg-muted/30 border-b border-border text-xs font-semibold text-foreground flex items-center gap-2 select-none"><svg class="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span>${escapeHtml(title)}</span></div>` : ''}
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
    ${cardsHtml}
  </div>
</div>
`);
}

/**
 * Helper to render styled 3D keycaps
 */
function renderKeyCombo(comboStr) {
  if (!comboStr) return '';
  const tokens = comboStr.trim().split(/\s*\+\s*|\s+/);
  return tokens.map((token, idx) => {
    let clean = token.trim();
    if (!clean) return '';
    if (clean.toLowerCase() === 'cmd' || clean.toLowerCase() === 'command') clean = '⌘ Cmd';
    if (clean.toLowerCase() === 'ctrl' || clean.toLowerCase() === 'control') clean = 'Ctrl';
    if (clean.toLowerCase() === 'alt' || clean.toLowerCase() === 'option') clean = '⌥ Alt';
    if (clean.toLowerCase() === 'shift') clean = '⇧ Shift';
    if (clean.toLowerCase() === 'enter' || clean.toLowerCase() === 'return') clean = '↵ Enter';
    if (clean.toLowerCase() === 'esc' || clean.toLowerCase() === 'escape') clean = 'Esc';

    const kbd = `<kbd class="docboot-kbd inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 text-[11px] font-mono font-bold bg-muted text-foreground border border-border border-b-2 rounded-md shadow-2xs select-all">${escapeHtml(clean)}</kbd>`;
    return idx === 0 ? kbd : `<span class="text-muted-foreground/80 text-[10px] font-bold mx-0.5 select-none">+</span>${kbd}`;
  }).join(' ');
}

/**
 * 36. Keyboard Shortcut Primitive (:::shortcut, :::shortcuts)
 */
function renderShortcuts(args, body, config) {
  const title = args.title || (args._positional?.length ? args._positional.join(' ') : 'Keyboard Shortcuts');
  let items = [];

  if (body.trim().startsWith('-') || body.trim().startsWith('[')) {
    try {
      const parsed = yaml.parse(body);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            items.push({
              action: item.action || item.name || item.title || 'Action',
              mac: item.mac || item.macos || item.apple || item.keys || '',
              windows: item.windows || item.win || item.linux || item.pc || '',
              description: item.description || item.desc || ''
            });
          }
        }
      }
    } catch (_) {}
  }

  if (items.length === 0 && body.trim()) {
    const { metadata, description: bodyDesc } = parseKeyValueBlock(body);
    const macKeys = metadata.mac || metadata.macos || metadata.apple || '';
    const winKeys = metadata.windows || metadata.win || metadata.pc || metadata.linux || '';

    if (macKeys || winKeys) {
      items.push({
        action: args.title || args._positional?.join(' ') || 'Shortcut',
        mac: macKeys,
        windows: winKeys,
        description: bodyDesc || metadata.description || ''
      });
    } else {
      const lines = body.trim().split(/\r?\n/);
      for (const line of lines) {
        const match = line.match(/^`?([a-zA-Z0-9_.\s-]+)`?\s*:\s*(.*)$/);
        if (match) {
          items.push({
            action: match[1].trim(),
            mac: match[2].trim(),
            windows: '',
            description: ''
          });
        }
      }
    }
  }

  let rowsHtml = '';
  for (const item of items) {
    const macCombo = item.mac ? renderKeyCombo(item.mac) : '';
    const winCombo = item.windows ? renderKeyCombo(item.windows) : '';

    rowsHtml += `
<div class="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
  <div class="space-y-0.5 min-w-0">
    <div class="font-medium text-xs sm:text-sm text-foreground">${escapeHtml(item.action)}</div>
    ${item.description ? `<div class="text-xs text-muted-foreground">${escapeHtml(item.description)}</div>` : ''}
  </div>
  <div class="flex flex-wrap items-center gap-3 shrink-0">
    ${macCombo ? `<div class="flex items-center gap-1.5"><span class="text-[10px] uppercase font-semibold text-muted-foreground select-none">Mac</span>${macCombo}</div>` : ''}
    ${winCombo ? `<div class="flex items-center gap-1.5"><span class="text-[10px] uppercase font-semibold text-muted-foreground select-none">Win/Linux</span>${winCombo}</div>` : ''}
  </div>
</div>`;
  }

  return unindent(`
<div class="docboot-shortcuts not-prose my-6 rounded-xl border border-border bg-card/40 shadow-2xs overflow-hidden">
  ${title ? `<div class="px-4 py-2.5 bg-muted/30 border-b border-border text-xs font-semibold text-foreground flex items-center gap-2 select-none"><svg class="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/></svg><span>${escapeHtml(title)}</span></div>` : ''}
  <div class="divide-y divide-border/60">
    ${rowsHtml}
  </div>
</div>
`);
}

/**
 * 37. Interactive Component Preview Primitive (:::preview, :::code-preview)
 */
function renderPreview(args, body, config) {
  const title = args.title || (args._positional?.length ? args._positional.join(' ') : 'Interactive Preview');

  let previewCode = '';
  let sourceCode = '';
  let lang = 'html';

  const fenceMatch = body.match(/```([a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)\r?\n```/);
  if (fenceMatch) {
    lang = fenceMatch[1] || 'html';
    sourceCode = fenceMatch[2].trim();
    previewCode = body.replace(/```[a-zA-Z0-9_-]*\r?\n[\s\S]*?\r?\n```/, '').trim() || sourceCode;
  } else {
    previewCode = body.trim();
    sourceCode = body.trim();
  }

  const processedPreview = marked.parse(processDirectives(previewCode, config));
  const renderedCodeBlock = marked.parse(`\`\`\`${lang}\n${sourceCode}\n\`\`\``);

  return unindent(`
<div class="docboot-preview not-prose my-8 rounded-xl border border-border bg-card/50 overflow-hidden shadow-2xs">
  <div class="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/30 border-b border-border text-xs">
    <div class="flex items-center gap-2 font-medium text-foreground">
      <div class="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
      <span class="font-semibold">${escapeHtml(title)}</span>
    </div>
    <span class="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider select-none">Live Canvas</span>
  </div>
  <div class="docboot-preview-canvas p-6 sm:p-8 bg-background/50 flex items-center justify-center min-h-[120px] overflow-x-auto">
    <div class="w-full flex justify-center items-center">
      ${processedPreview}
    </div>
  </div>
  <details class="docboot-preview-code border-t border-border group bg-muted/15">
    <summary class="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-between select-none list-none transition-colors">
      <span class="flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        <span>View Source Code</span>
      </span>
      <span class="font-mono text-[10px] text-muted-foreground lowercase">${escapeHtml(lang)}</span>
    </summary>
    <div class="p-3 bg-muted/25 border-t border-border/50 text-xs">
      ${renderedCodeBlock}
    </div>
  </details>
</div>
`);
}

/**
 * 38. Changelog & Release Notes Primitive (:::changelog, :::release)
 */
function renderChangelog(args, body, config) {
  const version = args.version || args._positional?.[0] || 'Release';
  const date = args.date || args.released || args._positional?.[1] || '';
  const title = args.title || '';

  const CATEGORY_STYLES = {
    added: { label: 'Added', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
    changed: { label: 'Changed', color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30' },
    fixed: { label: 'Fixed', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
    deprecated: { label: 'Deprecated', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' },
    removed: { label: 'Removed', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' },
    security: { label: 'Security', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' }
  };

  const sectionRegex = /::(added|changed|fixed|deprecated|removed|security)(?:[ \t]+([^\r\n]*))?\r?\n([\s\S]*?)(?=(?:\r?\n::(?:added|changed|fixed|deprecated|removed|security)|\s*$))/gi;
  const sections = [];
  let match;

  while ((match = sectionRegex.exec(body)) !== null) {
    const typeKey = (match[1] || '').toLowerCase();
    const subTitle = (match[2] || '').trim();
    const sectionBody = (match[3] || '').trim().replace(/::$/, '').trim();
    sections.push({ typeKey, subTitle, content: sectionBody });
  }

  let sectionsHtml = '';
  if (sections.length > 0) {
    for (const s of sections) {
      const cat = CATEGORY_STYLES[s.typeKey] || { label: s.typeKey.toUpperCase(), color: 'bg-muted text-foreground border-border' };
      const contentHtml = marked.parse(processDirectives(s.content, config));

      sectionsHtml += `
<div class="space-y-2">
  <div class="flex items-center gap-2">
    <span class="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${cat.color} select-none">${escapeHtml(cat.label)}</span>
    ${s.subTitle ? `<span class="text-xs font-semibold text-foreground">${escapeHtml(s.subTitle)}</span>` : ''}
  </div>
  <div class="text-xs sm:text-sm text-muted-foreground prose-sm [&>ul]:my-1 [&>ul]:pl-5 [&>li]:my-0.5 [&>p]:my-1 leading-relaxed">${contentHtml}</div>
</div>`;
    }
  } else {
    sectionsHtml = `<div class="text-xs sm:text-sm text-muted-foreground prose-sm leading-relaxed">${marked.parse(processDirectives(body.trim(), config))}</div>`;
  }

  return unindent(`
<div class="docboot-changelog not-prose my-8 rounded-xl border border-border bg-card/40 p-5 sm:p-6 shadow-2xs space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
    <div class="flex items-center gap-2.5">
      <span class="font-mono font-extrabold text-sm sm:text-base px-2.5 py-1 rounded-lg bg-accent/15 text-accent border border-accent/25 select-all">${escapeHtml(version)}</span>
      ${title ? `<span class="font-semibold text-sm sm:text-base text-foreground">${escapeHtml(title)}</span>` : ''}
    </div>
    ${date ? `<span class="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>${escapeHtml(date)}</span></span>` : ''}
  </div>
  <div class="space-y-4 pt-1">
    ${sectionsHtml}
  </div>
</div>
`);
}

/**
 * 39. Testimonial & Quote Primitive (:::testimonial, :::quote)
 */
function renderTestimonial(args, body, config) {
  const { metadata, description: bodyDesc } = parseKeyValueBlock(body);

  const author = args.author || metadata.author || args.name || metadata.name || '';
  const title = args.title || metadata.title || args.role || metadata.role || args.company || metadata.company || '';
  const avatar = args.avatar || metadata.avatar || args.image || metadata.image || '';
  const url = args.url || metadata.url || args.href || metadata.href || '';
  const quoteText = bodyDesc || args.quote || metadata.quote || '';

  const initials = author.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || '★';
  const innerQuoteHtml = quoteText ? marked.parse(processDirectives(quoteText, config)) : '';

  let avatarHtml = `<div class="w-10 h-10 rounded-full bg-accent/15 text-accent border border-accent/25 flex items-center justify-center font-bold text-xs shrink-0 select-none">${escapeHtml(initials)}</div>`;
  if (avatar) {
    avatarHtml = `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(author)}" class="w-10 h-10 rounded-full object-cover border border-border shrink-0 select-none" />`;
  }

  return unindent(`
<div class="docboot-testimonial not-prose my-8 p-6 sm:p-7 rounded-2xl border border-border bg-card/60 shadow-2xs space-y-4 hover:border-border/80 transition-colors">
  <svg class="w-8 h-8 text-accent/30 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>
  <div class="text-base sm:text-lg italic text-foreground/90 font-medium leading-relaxed prose-sm [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
    ${innerQuoteHtml}
  </div>
  <div class="flex items-center gap-3 pt-2 border-t border-border/50">
    ${avatarHtml}
    <div class="min-w-0 flex-1">
      <div class="font-semibold text-sm text-foreground flex items-center gap-2">
        <span>${escapeHtml(author)}</span>
        ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-accent transition-colors"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></a>` : ''}
      </div>
      ${title ? `<div class="text-xs text-muted-foreground truncate">${escapeHtml(title)}</div>` : ''}
    </div>
  </div>
</div>
`);
}

/**
 * 40. Timeline & Roadmaps Primitive (:::timeline)
 */
function renderTimeline(args, body, config) {
  const title = args.title || (args._positional?.length ? args._positional.join(' ') : '');
  const items = [];

  const itemRegex = /::item(?:\s+([^\r\n]+))?\r?\n([\s\S]*?)(?=(?:\r?\n::item|\s*$))/gi;
  let match;

  while ((match = itemRegex.exec(body)) !== null) {
    const rawHeader = (match[1] || '').trim();
    const subBody = (match[2] || '').trim().replace(/::$/, '').trim();

    let date = '';
    let itemTitle = '';

    if (rawHeader.includes('—') || rawHeader.includes(' - ') || rawHeader.includes(': ')) {
      const parts = rawHeader.split(/\s*—\s*|\s+-\s+|\s*:\s*/);
      date = parts[0].trim();
      itemTitle = parts.slice(1).join(' - ').trim();
    } else {
      date = rawHeader;
    }

    items.push({ date, title: itemTitle, body: subBody });
  }

  // Fallback YAML list
  if (items.length === 0 && (body.trim().startsWith('-') || body.trim().startsWith('['))) {
    try {
      const parsed = yaml.parse(body);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            items.push({
              date: item.date || item.time || item.milestone || '',
              title: item.title || item.name || '',
              body: item.description || item.desc || item.content || ''
            });
          }
        }
      }
    } catch (_) {}
  }

  let itemsHtml = '';
  for (const it of items) {
    const renderedBody = it.body ? marked.parse(processDirectives(it.body, config)) : '';

    itemsHtml += `
<div class="relative group">
  <div class="absolute -left-[33px] sm:-left-[41px] top-1.5 w-4 h-4 rounded-full bg-accent border-4 border-background shadow-2xs group-hover:scale-125 transition-transform"></div>
  <div class="space-y-1.5">
    <div class="flex flex-wrap items-center gap-2">
      ${it.date ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-accent/15 text-accent border border-accent/25 select-all">${escapeHtml(it.date)}</span>` : ''}
      ${it.title ? `<h3 class="font-bold text-sm sm:text-base text-foreground m-0">${escapeHtml(it.title)}</h3>` : ''}
    </div>
    ${renderedBody ? `<div class="text-xs sm:text-sm text-muted-foreground leading-relaxed prose-sm [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:my-1 [&>ul]:pl-5 [&>li]:my-0.5">${renderedBody}</div>` : ''}
  </div>
</div>`;
  }

  return unindent(`
<div class="docboot-timeline-container not-prose my-8 space-y-4">
  ${title ? `<div class="text-sm font-bold text-foreground mb-4">${escapeHtml(title)}</div>` : ''}
  <div class="docboot-timeline relative border-l-2 border-border/80 ml-3 sm:ml-4 pl-6 sm:pl-8 space-y-8">
    ${itemsHtml}
  </div>
</div>
`);
}

/**
 * 41. FAQ & Accordions Primitive (:::faq, :::accordion)
 */
function renderFaq(args, body, config) {
  const title = args.title || (args._positional?.length ? args._positional.join(' ') : '');
  const items = [];

  const faqRegex = /::(?:q|question|item)(?:\s+([^\r\n]+))?\r?\n([\s\S]*?)(?=(?:\r?\n::(?:q|question|item)|\s*$))/gi;
  let match;

  while ((match = faqRegex.exec(body)) !== null) {
    const q = (match[1] || '').trim();
    const a = (match[2] || '').trim().replace(/::$/, '').trim();
    items.push({ question: q, answer: a });
  }

  // Fallback YAML list
  if (items.length === 0 && (body.trim().startsWith('-') || body.trim().startsWith('['))) {
    try {
      const parsed = yaml.parse(body);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            items.push({
              question: item.q || item.question || item.title || '',
              answer: item.a || item.answer || item.description || item.desc || ''
            });
          }
        }
      }
    } catch (_) {}
  }

  let itemsHtml = '';
  for (const it of items) {
    const renderedAnswer = it.answer ? marked.parse(processDirectives(it.answer, config)) : '';

    itemsHtml += `
<details class="docboot-faq-item group p-4 sm:p-5 hover:bg-muted/15 transition-colors" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
  <summary class="cursor-pointer font-semibold text-xs sm:text-sm text-foreground flex items-center justify-between gap-3 select-none list-none group-hover:text-accent transition-colors" itemprop="name">
    <span>${escapeHtml(it.question)}</span>
    <svg class="w-4 h-4 text-muted-foreground group-hover:text-accent transition-transform duration-200 group-open:rotate-180 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
  </summary>
  <div class="mt-3 pt-3 border-t border-border/40 text-xs sm:text-sm text-muted-foreground leading-relaxed prose-sm [&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:my-1 [&>ul]:pl-5 [&>li]:my-0.5" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
    <div itemprop="text">${renderedAnswer}</div>
  </div>
</details>`;
  }

  return unindent(`
<div class="docboot-faq not-prose my-8 rounded-xl border border-border bg-card/40 divide-y divide-border/60 shadow-2xs overflow-hidden" itemscope itemtype="https://schema.org/FAQPage">
  ${title ? `<div class="px-5 py-3.5 bg-muted/30 border-b border-border text-xs sm:text-sm font-bold text-foreground flex items-center gap-2 select-none"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>${escapeHtml(title)}</span></div>` : ''}
  ${itemsHtml}
</div>
`);
}

/**
 * 42. Pricing & Plan Tiers Primitive (:::pricing, :::plans)
 */
function renderPricing(args, body, config) {
  const cols = args.cols || args._positional?.[0] || '3';
  let gridColsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  if (cols === '1') gridColsClass = 'grid-cols-1';
  else if (cols === '2') gridColsClass = 'grid-cols-1 sm:grid-cols-2';
  else if (cols === '4') gridColsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  const planRegex = /::plan(?:\s+([^\r\n]+))?\r?\n([\s\S]*?)(?=(?:\r?\n::plan|\s*$))/gi;
  const plans = [];
  let match;

  while ((match = planRegex.exec(body)) !== null) {
    const rawHeader = (match[1] || '').trim();
    const subBody = (match[2] || '').trim().replace(/::$/, '').trim();
    const planArgs = parseDirectiveArgs(rawHeader);
    const { metadata, description: bodyDesc } = parseKeyValueBlock(subBody);

    const name = planArgs.name || planArgs.title || planArgs.typeOrTitle || planArgs._positional?.join(' ') || metadata.name || 'Plan';
    const price = planArgs.price || metadata.price || '$0';
    const period = planArgs.period || metadata.period || '';
    const badge = planArgs.badge || metadata.badge || '';
    const isPopular = planArgs.popular === 'true' || planArgs.popular === true || metadata.popular === true || metadata.popular === 'true';
    const desc = bodyDesc || planArgs.description || metadata.description || '';

    plans.push({ name, price, period, badge, isPopular, body: desc });
  }

  // Fallback YAML list
  if (plans.length === 0 && (body.trim().startsWith('-') || body.trim().startsWith('['))) {
    try {
      const parsed = yaml.parse(body);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            plans.push({
              name: item.name || item.title || 'Plan',
              price: item.price || '$0',
              period: item.period || '',
              badge: item.badge || '',
              isPopular: item.popular === true,
              body: item.description || item.desc || ''
            });
          }
        }
      }
    } catch (_) {}
  }

  let cardsHtml = '';
  for (const p of plans) {
    const renderedBody = p.body ? marked.parse(processDirectives(p.body, config)) : '';
    const popularClass = p.isPopular 
      ? 'border-accent ring-2 ring-accent/30 bg-card shadow-md -translate-y-1' 
      : 'border-border bg-card/60 shadow-2xs hover:border-border/80';

    cardsHtml += `
<div class="docboot-pricing-card relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl border transition-all duration-200 space-y-5 ${popularClass}">
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <h3 class="font-bold text-lg text-foreground m-0">${escapeHtml(p.name)}</h3>
      ${p.badge ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent/15 text-accent border border-accent/25 select-none">${escapeHtml(p.badge)}</span>` : (p.isPopular ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent text-accent-contrast select-none">Popular</span>' : '')}
    </div>
    <div class="flex items-baseline gap-1.5 pt-1">
      <span class="font-mono text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight select-all">${escapeHtml(p.price)}</span>
      ${p.period ? `<span class="text-xs text-muted-foreground font-medium">${escapeHtml(p.period)}</span>` : ''}
    </div>
    <div class="text-xs sm:text-sm text-muted-foreground leading-relaxed prose-sm border-t border-border/50 pt-4 [&>ul]:my-1 [&>ul]:pl-0 [&>ul]:list-none [&>ul>li]:my-1.5 [&>ul>li]:flex [&>ul>li]:items-center [&>ul>li]:gap-2 [&>ul>li]:before:content-['✓'] [&>ul>li]:before:text-accent [&>ul>li]:before:font-bold [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
      ${renderedBody}
    </div>
  </div>
</div>`;
  }

  return unindent(`
<div class="docboot-pricing not-prose my-8 grid ${gridColsClass} gap-5 sm:gap-6">
  ${cardsHtml}
</div>
`);
}

/**
 * 43. Enhanced Data Table Primitive (:::table)
 */
function renderDataTable(args, body, config) {
  const title = args.title || (args._positional?.length ? args._positional.join(' ') : '');
  const renderedTable = marked.parse(processDirectives(body.trim(), config));

  return unindent(`
<div class="docboot-data-table not-prose my-8 rounded-xl border border-border bg-card/40 shadow-2xs overflow-hidden">
  ${title ? `<div class="px-4 py-2.5 bg-muted/30 border-b border-border text-xs font-semibold text-foreground flex items-center gap-2 select-none"><svg class="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg><span>${escapeHtml(title)}</span></div>` : ''}
  <div class="overflow-x-auto w-full p-1">
    <div class="docboot-table-wrapper [&>table]:w-full [&>table]:text-xs sm:[&>table]:text-sm [&>table]:border-collapse [&>table_th]:px-4 [&>table_th]:py-3 [&>table_th]:bg-muted/35 [&>table_th]:font-semibold [&>table_th]:text-foreground [&>table_th]:border-b [&>table_th]:border-border [&>table_td]:px-4 [&>table_td]:py-2.5 [&>table_td]:border-b [&>table_td]:border-border/50 [&>table_tr:last-child_td]:border-b-0 [&>table_tr:hover]:bg-muted/15 [&>table_tr:nth-child(even)]:bg-muted/5 transition-colors">
      ${renderedTable}
    </div>
  </div>
</div>
`);
}

/**
 * 44. Team & Authors Primitive (:::team, :::authors, :::author)
 */
function renderTeam(args, body, config) {
  const cols = args.cols || (args._positional?.[0] && !isNaN(Number(args._positional[0])) ? args._positional[0] : '3');
  let gridColsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  if (cols === '1') gridColsClass = 'grid-cols-1';
  else if (cols === '2') gridColsClass = 'grid-cols-1 sm:grid-cols-2';
  else if (cols === '4') gridColsClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  const memberRegex = /::(?:member|author|contributor)(?:\s+([^\r\n]+))?\r?\n([\s\S]*?)(?=(?:\r?\n::(?:member|author|contributor)|\s*$))/gi;
  const members = [];
  let match;

  while ((match = memberRegex.exec(body)) !== null) {
    const rawHeader = (match[1] || '').trim();
    const subBody = (match[2] || '').trim().replace(/::$/, '').trim();
    const memArgs = parseDirectiveArgs(rawHeader);
    const { metadata, description: bodyDesc } = parseKeyValueBlock(subBody);

    const name = memArgs.name || memArgs.title || memArgs.typeOrTitle || memArgs._positional?.join(' ') || metadata.name || 'Team Member';
    const role = memArgs.role || memArgs.title || metadata.role || metadata.title || '';
    const avatar = memArgs.avatar || memArgs.image || metadata.avatar || metadata.image || '';
    const github = memArgs.github || metadata.github || '';
    const twitter = memArgs.twitter || memArgs.x || metadata.twitter || metadata.x || '';
    const linkedin = memArgs.linkedin || metadata.linkedin || '';
    const website = memArgs.url || memArgs.website || memArgs.href || metadata.url || metadata.website || '';
    const bio = bodyDesc || memArgs.description || metadata.description || '';

    members.push({ name, role, avatar, github, twitter, linkedin, website, bio });
  }

  // Fallback single author / YAML list
  if (members.length === 0 && (body.trim().startsWith('-') || body.trim().startsWith('['))) {
    try {
      const parsed = yaml.parse(body);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            members.push({
              name: item.name || item.title || 'Team Member',
              role: item.role || item.title || '',
              avatar: item.avatar || item.image || '',
              github: item.github || '',
              twitter: item.twitter || item.x || '',
              linkedin: item.linkedin || '',
              website: item.url || item.website || '',
              bio: item.bio || item.description || item.desc || ''
            });
          }
        }
      }
    } catch (_) {}
  }

  if (members.length === 0 && body.trim()) {
    const { metadata, description: bodyDesc } = parseKeyValueBlock(body);
    const name = args.name || args.title || args.typeOrTitle || args._positional?.join(' ') || metadata.name || 'Team Member';
    const role = args.role || metadata.role || metadata.title || '';
    const avatar = args.avatar || args.image || metadata.avatar || metadata.image || '';
    const github = args.github || metadata.github || '';
    const twitter = args.twitter || args.x || metadata.twitter || metadata.x || '';
    const linkedin = args.linkedin || metadata.linkedin || '';
    const website = args.url || args.website || args.href || metadata.url || metadata.website || '';
    const bio = bodyDesc || metadata.description || '';

    members.push({ name, role, avatar, github, twitter, linkedin, website, bio });
  }

  let cardsHtml = '';
  for (const m of members) {
    const renderedBio = m.bio ? marked.parse(processDirectives(m.bio, config)) : '';
    const initials = m.name.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || '★';

    let avatarHtml = `<div class="w-14 h-14 rounded-full bg-accent/15 text-accent border border-accent/25 flex items-center justify-center font-bold text-base shrink-0 select-none shadow-2xs">${escapeHtml(initials)}</div>`;
    if (m.avatar) {
      avatarHtml = `<img src="${escapeHtml(m.avatar)}" alt="${escapeHtml(m.name)}" class="w-14 h-14 rounded-full object-cover border border-border shrink-0 select-none shadow-2xs" />`;
    }

    const githubUrl = m.github ? (m.github.startsWith('http') ? m.github : `https://github.com/${m.github}`) : '';
    const twitterUrl = m.twitter ? (m.twitter.startsWith('http') ? m.twitter : `https://twitter.com/${m.twitter.replace('@', '')}`) : '';
    const linkedinUrl = m.linkedin ? (m.linkedin.startsWith('http') ? m.linkedin : `https://linkedin.com/in/${m.linkedin}`) : '';

    let socialHtml = '';
    if (githubUrl) socialHtml += `<a href="${escapeHtml(githubUrl)}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="GitHub" aria-label="GitHub"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg></a>`;
    if (twitterUrl) socialHtml += `<a href="${escapeHtml(twitterUrl)}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Twitter / X" aria-label="Twitter"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>`;
    if (linkedinUrl) socialHtml += `<a href="${escapeHtml(linkedinUrl)}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="LinkedIn" aria-label="LinkedIn"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg></a>`;
    if (m.website) socialHtml += `<a href="${escapeHtml(m.website)}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Website" aria-label="Website"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg></a>`;

    cardsHtml += `
<div class="docboot-team-card p-5 sm:p-6 rounded-2xl border border-border bg-card/60 shadow-2xs space-y-4 hover:border-border/80 transition-colors">
  <div class="flex items-center gap-3.5">
    ${avatarHtml}
    <div class="min-w-0 flex-1">
      <h3 class="font-bold text-base text-foreground m-0 truncate">${escapeHtml(m.name)}</h3>
      ${m.role ? `<div class="text-xs font-semibold text-accent truncate mt-0.5">${escapeHtml(m.role)}</div>` : ''}
    </div>
  </div>
  ${renderedBio ? `<div class="text-xs sm:text-sm text-muted-foreground leading-relaxed prose-sm [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 border-t border-border/40 pt-3">${renderedBio}</div>` : ''}
  ${socialHtml ? `<div class="flex items-center gap-1.5 pt-1 border-t border-border/40 -mx-1">${socialHtml}</div>` : ''}
</div>`;
  }

  return unindent(`
<div class="docboot-team not-prose my-8 grid ${gridColsClass} gap-4 sm:gap-5">
  ${cardsHtml}
</div>
`);
}

/**
 * 45. Sponsors & Backers Primitive (:::sponsors, :::sponsor)
 */
function renderSponsors(args, body, config) {
  const title = args.title || (args._positional?.length ? args._positional.join(' ') : 'Sponsored By');
  const cols = args.cols || '4';
  let gridColsClass = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
  if (cols === '2') gridColsClass = 'grid-cols-1 sm:grid-cols-2';
  else if (cols === '3') gridColsClass = 'grid-cols-2 sm:grid-cols-3';
  else if (cols === '6') gridColsClass = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6';

  const sponsorBlocks = body.split(/(?:^|\r?\n)::sponsor\s*/).filter(Boolean);
  const sponsors = [];

  for (const block of sponsorBlocks) {
    const lines = block.split(/\r?\n/);
    const rawHeader = lines[0] || '';
    const subBody = lines.slice(1).join('\n').replace(/::$/, '').trim();
    const spArgs = parseDirectiveArgs(rawHeader);
    const { metadata, description: bodyDesc } = parseKeyValueBlock(subBody);

    const name = spArgs.name || spArgs.title || spArgs.typeOrTitle || spArgs._positional?.join(' ') || metadata.name || 'Sponsor';
    const logo = spArgs.logo || spArgs.image || metadata.logo || metadata.image || '';
    const url = spArgs.url || spArgs.href || metadata.url || metadata.href || '';
    const tier = spArgs.tier || metadata.tier || 'Backer';

    sponsors.push({ name, logo, url, tier });
  }

  // Fallback YAML list
  if (sponsors.length === 0 && (body.trim().startsWith('-') || body.trim().startsWith('['))) {
    try {
      const parsed = yaml.parse(body);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            sponsors.push({
              name: item.name || item.title || 'Sponsor',
              logo: item.logo || item.image || '',
              url: item.url || item.href || '',
              tier: item.tier || 'Backer'
            });
          }
        }
      }
    } catch (_) {}
  }

  const TIER_STYLES = {
    platinum: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    gold: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    silver: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
    bronze: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30'
  };

  let cardsHtml = '';
  for (const s of sponsors) {
    const tierKey = s.tier.toLowerCase();
    const tierClass = TIER_STYLES[tierKey] || 'bg-muted text-foreground border-border';
    const cardContent = `
<div class="docboot-sponsor-card flex flex-col items-center justify-center p-5 rounded-xl border border-border bg-card/60 shadow-2xs hover:border-accent/40 hover:bg-card transition-all text-center gap-2.5 h-full">
  ${s.logo ? `<img src="${escapeHtml(s.logo)}" alt="${escapeHtml(s.name)}" class="h-8 max-w-[120px] object-contain grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all select-none" />` : `<span class="font-bold text-sm text-foreground">${escapeHtml(s.name)}</span>`}
  <div class="flex items-center gap-1.5">
    <span class="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tierClass} select-none">${escapeHtml(s.tier)}</span>
  </div>
</div>`;

    if (s.url) {
      cardsHtml += `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="group block h-full">${cardContent}</a>`;
    } else {
      cardsHtml += `<div class="group h-full">${cardContent}</div>`;
    }
  }

  return unindent(`
<div class="docboot-sponsors-container not-prose my-8 rounded-2xl border border-border bg-card/30 p-6 shadow-2xs space-y-4">
  ${title ? `<div class="text-xs font-bold uppercase tracking-wider text-muted-foreground select-none text-center">${escapeHtml(title)}</div>` : ''}
  <div class="grid ${gridColsClass} gap-3 sm:gap-4">
    ${cardsHtml}
  </div>
</div>
`);
}

/**
 * 46. Feedback & Rating Widget (:::feedback, :::rating)
 */
function renderFeedback(args, body, config) {
  const { metadata } = parseKeyValueBlock(body);
  const title = args.title || metadata.title || (args._positional?.length ? args._positional.join(' ') : 'Was this page helpful?');
  const yesText = args.positiveText || args.yes || metadata.positiveText || metadata.yes || 'Yes';
  const noText = args.negativeText || args.no || metadata.negativeText || metadata.no || 'No';

  return unindent(`
<div class="docboot-feedback not-prose my-8 p-5 sm:p-6 rounded-2xl border border-border bg-card/50 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
  <div class="space-y-0.5">
    <div class="font-semibold text-sm text-foreground flex items-center gap-2 select-none">
      <svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/></svg>
      <span>${escapeHtml(title)}</span>
    </div>
    <div class="text-xs text-muted-foreground">Your feedback helps us continuously improve our documentation.</div>
  </div>
  <div class="docboot-feedback-buttons flex items-center gap-2 shrink-0 select-none">
    <button type="button" onclick="const p=this.closest('.docboot-feedback');if(p){p.innerHTML='<div class=\\'flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400\\'><svg class=\\'w-4 h-4\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M5 13l4 4L19 7\\'/></svg><span>Thank you for your feedback! ❤️</span></div>';}" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-background hover:bg-accent/10 hover:border-accent/30 text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-2xs">
      <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/></svg>
      <span>${escapeHtml(yesText)}</span>
    </button>
    <button type="button" onclick="const p=this.closest('.docboot-feedback');if(p){p.innerHTML='<div class=\\'flex items-center gap-2 text-xs font-semibold text-muted-foreground\\'><svg class=\\'w-4 h-4 text-accent\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M5 13l4 4L19 7\\'/></svg><span>Thanks! We will make this page better.</span></div>';}" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-background hover:bg-rose-500/10 hover:border-rose-500/30 text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-2xs">
      <svg class="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"/></svg>
      <span>${escapeHtml(noText)}</span>
    </button>
  </div>
</div>
`);
}

/**
 * 47. Interactive Code Sandbox Primitive (:::sandbox, :::playground)
 */
function renderSandbox(args, body, config) {
  const provider = (args._positional?.[0] || args.provider || 'stackblitz').toLowerCase();
  const id = args.id || args._positional?.[1] || '';
  const height = args.height || '500px';
  const title = args.title || 'Interactive Code Sandbox';
  const file = args.file || '';

  let embedUrl = args.url || args.src || '';

  if (!embedUrl && id) {
    if (provider === 'stackblitz') {
      embedUrl = `https://stackblitz.com/edit/${encodeURIComponent(id)}?embed=1${file ? `&file=${encodeURIComponent(file)}` : ''}&theme=dark`;
    } else if (provider === 'codesandbox') {
      embedUrl = `https://codesandbox.io/embed/${encodeURIComponent(id)}?fontsize=14&hidenavigation=1&theme=dark`;
    } else if (provider === 'codepen') {
      const user = args.user || 'pen';
      embedUrl = `https://codepen.io/${encodeURIComponent(user)}/embed/${encodeURIComponent(id)}?default-tab=result&theme-id=dark`;
    } else if (provider === 'jsfiddle') {
      embedUrl = `https://jsfiddle.net/${encodeURIComponent(id)}/embedded/result,js,html,css/dark/`;
    }
  }

  return unindent(`
<div class="docboot-sandbox not-prose my-8 rounded-2xl border border-border bg-card/60 shadow-2xs overflow-hidden">
  <div class="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/30 border-b border-border text-xs">
    <div class="flex items-center gap-2 font-medium text-foreground">
      <svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      <span class="font-semibold">${escapeHtml(title)}</span>
    </div>
    <span class="font-mono text-[10px] uppercase font-bold text-muted-foreground select-none">${escapeHtml(provider)}</span>
  </div>
  <iframe 
    src="${escapeHtml(embedUrl)}" 
    title="${escapeHtml(title)}"
    style="width: 100%; height: ${escapeHtml(height)}; border: 0;"
    loading="lazy"
    allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
    sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
  ></iframe>
</div>
`);
}

/**
 * 48. Interactive JSON Tree Viewer Primitive (:::json, :::jsontree, :::json-tree)
 */
function renderJsonTree(args, body, config) {
  const title = args.title || args._positional?.[0] || 'JSON Tree';
  const defaultExpandLevel = args.expandLevel !== undefined ? parseInt(args.expandLevel, 10) : (args.collapsed === 'true' || args.collapsed === true ? 0 : 2);

  let data = null;
  let rawJson = body.trim();
  let parseError = null;

  try {
    data = JSON.parse(rawJson);
  } catch (e) {
    try {
      data = yaml.parse(rawJson);
      rawJson = JSON.stringify(data, null, 2);
    } catch (yamlErr) {
      parseError = e.message;
    }
  }

  if (parseError || data === null || data === undefined) {
    return unindent(`
<div class="docboot-json-tree not-prose my-6 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 font-mono text-xs text-rose-500">
  <div class="font-bold flex items-center gap-2 mb-1">
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    Invalid JSON Payload
  </div>
  <div class="text-[11px] opacity-90">${escapeHtml(parseError || 'Could not parse JSON body')}</div>
  <pre class="mt-2 p-2 bg-black/30 rounded overflow-x-auto text-[11px] text-foreground">${escapeHtml(body)}</pre>
</div>
`);
  }

  function renderNode(value, key, depth = 0, isLast = true) {
    const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
    const isArray = Array.isArray(value);
    const isOpen = depth < defaultExpandLevel ? 'open' : '';
    const keyPrefix = key !== null && key !== undefined ? `<span class="docboot-json-key font-mono text-xs font-semibold text-accent dark:text-accent">${escapeHtml(JSON.stringify(key))}:</span> ` : '';

    if (isObject) {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return `<div class="docboot-json-row py-0.5 leading-relaxed font-mono text-xs pl-4">${keyPrefix}<span class="text-muted-foreground font-mono">{}</span>${isLast ? '' : '<span class="text-muted-foreground">,</span>'}</div>`;
      }
      return `
<details class="docboot-json-node docboot-json-object group" ${isOpen}>
  <summary class="docboot-json-summary flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-muted/40 rounded px-1 -ml-1 transition-colors select-none">
    <svg class="w-3.5 h-3.5 text-muted-foreground group-open:rotate-90 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
    ${keyPrefix}<span class="text-xs font-mono text-muted-foreground font-normal">{ <span class="text-[10px] px-1 py-0.2 rounded bg-muted font-medium text-foreground">${keys.length} keys</span> }</span>
  </summary>
  <div class="docboot-json-children pl-4 border-l border-border/60 ml-2 my-0.5 space-y-0.5">
    ${keys.map((k, idx) => renderNode(value[k], k, depth + 1, idx === keys.length - 1)).join('')}
  </div>
  <div class="text-xs font-mono text-muted-foreground pl-4">}${isLast ? '' : ','}</div>
</details>`;
    }

    if (isArray) {
      if (value.length === 0) {
        return `<div class="docboot-json-row py-0.5 leading-relaxed font-mono text-xs pl-4">${keyPrefix}<span class="text-muted-foreground font-mono">[]</span>${isLast ? '' : '<span class="text-muted-foreground">,</span>'}</div>`;
      }
      return `
<details class="docboot-json-node docboot-json-array group" ${isOpen}>
  <summary class="docboot-json-summary flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-muted/40 rounded px-1 -ml-1 transition-colors select-none">
    <svg class="w-3.5 h-3.5 text-muted-foreground group-open:rotate-90 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
    ${keyPrefix}<span class="text-xs font-mono text-muted-foreground font-normal">Array(<span class="text-[10px] px-1 py-0.2 rounded bg-muted font-medium text-foreground">${value.length}</span>) [</span>
  </summary>
  <div class="docboot-json-children pl-4 border-l border-border/60 ml-2 my-0.5 space-y-0.5">
    ${value.map((item, idx) => renderNode(item, null, depth + 1, idx === value.length - 1)).join('')}
  </div>
  <div class="text-xs font-mono text-muted-foreground pl-4">]${isLast ? '' : ','}</div>
</details>`;
    }

    // Primitive values
    let valHtml = '';
    if (typeof value === 'string') {
      valHtml = `<span class="docboot-json-string text-emerald-600 dark:text-emerald-400 font-mono">${escapeHtml(JSON.stringify(value))}</span>`;
    } else if (typeof value === 'number') {
      valHtml = `<span class="docboot-json-number text-cyan-600 dark:text-cyan-400 font-mono font-semibold">${value}</span>`;
    } else if (typeof value === 'boolean') {
      valHtml = `<span class="docboot-json-boolean text-purple-600 dark:text-purple-400 font-mono font-bold">${value}</span>`;
    } else if (value === null) {
      valHtml = `<span class="docboot-json-null text-muted-foreground font-mono italic font-semibold">null</span>`;
    } else {
      valHtml = `<span class="text-muted-foreground font-mono">${escapeHtml(String(value))}</span>`;
    }

    return `<div class="docboot-json-row py-0.5 leading-relaxed font-mono text-xs flex items-baseline gap-1 pl-4 hover:bg-muted/25 rounded">${keyPrefix}${valHtml}${isLast ? '' : '<span class="text-muted-foreground">,</span>'}</div>`;
  }

  const treeContent = renderNode(data, null, 0, true);
  const prettyJson = JSON.stringify(data, null, 2);

  return unindent(`
<div class="docboot-json-tree not-prose my-6 rounded-2xl border border-border bg-card-bg/70 shadow-xs overflow-hidden" data-docboot-json-tree="true">
  <!-- Header Bar -->
  <div class="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/30 border-b border-border text-xs">
    <div class="flex items-center gap-2">
      <svg class="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="8 10 12 14 16 10"/></svg>
      <span class="font-semibold text-foreground">${escapeHtml(title)}</span>
    </div>
    <div class="flex items-center gap-2">
      <button type="button" class="docboot-json-toggle-btn px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer" data-action="expand">Expand all</button>
      <span class="text-border">|</span>
      <button type="button" class="docboot-json-toggle-btn px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer" data-action="collapse">Collapse all</button>
      <span class="text-border">|</span>
      <button type="button" class="docboot-copy-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-muted hover:bg-accent/15 text-muted-foreground hover:text-accent border border-border/40 transition-all cursor-pointer shadow-2xs" data-code="${escapeHtml(prettyJson)}" aria-label="Copy Raw JSON">
        <svg class="copy-icon w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        <svg class="copied-icon w-3 h-3 text-emerald-500 hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/></svg>
        <span class="copy-text">Copy JSON</span>
      </button>
    </div>
  </div>
  <!-- Tree Container -->
  <div class="p-4 overflow-x-auto text-xs font-mono bg-card-bg/40 max-h-[550px] overflow-y-auto">
    ${treeContent}
  </div>
</div>
`);
}

/**
 * 49. Dedicated Copy Primitive (:::copy, :::clipboard, :::snippet)
 */
function renderCopyPrimitive(args, body, config) {
  let parsed = {};
  if (body.trim().startsWith('{') || body.trim().includes(':')) {
    try {
      parsed = yaml.parse(body) || {};
    } catch (_) {}
  }

  const text = (args.text || args.code || parsed.text || parsed.code || args._positional?.[0] || body.trim() || '').trim();
  const label = args.label || args.title || parsed.label || parsed.title || '';
  const prefix = args.prefix || parsed.prefix || '';
  const inline = Boolean(args.inline);

  if (inline) {
    return `<span class="docboot-copy-inline not-prose inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-muted/50 font-mono text-xs text-foreground group"><code class="text-xs text-foreground font-medium">${escapeHtml(text)}</code><button type="button" class="docboot-copy-btn p-0.5 rounded text-muted-foreground hover:text-accent transition-colors cursor-pointer inline-flex items-center" data-code="${escapeHtml(text)}" aria-label="Copy ${escapeHtml(text)}"><svg class="copy-icon w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><svg class="copied-icon w-3.5 h-3.5 text-emerald-500 hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/></svg></button></span>`;
  }

  return unindent(`
<div class="docboot-copy-block not-prose my-4 flex items-center justify-between gap-3 p-3 sm:px-4 rounded-xl border border-border bg-card-bg/80 shadow-xs font-mono text-sm group hover:border-accent/40 transition-colors">
  <div class="flex items-center gap-2.5 overflow-x-auto py-0.5">
    ${prefix ? `<span class="text-muted-foreground select-none text-xs font-semibold px-2 py-0.5 rounded-md bg-muted/80 border border-border/40">${escapeHtml(prefix)}</span>` : ''}
    ${label ? `<span class="text-xs font-sans font-semibold text-muted-foreground mr-1">${escapeHtml(label)}:</span>` : ''}
    <span class="text-foreground select-all text-xs sm:text-sm font-medium whitespace-nowrap">${escapeHtml(text)}</span>
  </div>
  <button type="button" class="docboot-copy-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-accent/15 text-muted-foreground hover:text-accent border border-border/50 hover:border-accent/30 transition-all cursor-pointer shrink-0 shadow-2xs" data-code="${escapeHtml(text)}" aria-label="Copy to clipboard">
    <svg class="copy-icon w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
    <svg class="copied-icon w-3.5 h-3.5 text-emerald-500 hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/></svg>
    <span class="copy-text hidden sm:inline">Copy</span>
  </button>
</div>
`);
}

