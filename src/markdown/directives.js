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
      if (transformedLine.includes(':::badge') || transformedLine.includes(':::since')) {
        transformedLine = transformedLine.replace(/:::badge(?:\s+([a-zA-Z0-9_-]+))?/g, (m, status) => {
          return renderBadge({ _positional: [status || 'stable'] }, '', config);
        });
        transformedLine = transformedLine.replace(/:::since(?:\s+([a-zA-Z0-9_.-]+))?/g, (m, ver) => {
          return renderSince({ _positional: [ver || '0.1.0'] }, '', config);
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
    <div class="docboot-compare-container relative w-full overflow-hidden aspect-video">
      <!-- After Image (Background Layer) -->
      <div class="docboot-compare-after absolute inset-0 w-full h-full">
        <img
          src="${escapeHtml(afterResolved.displaySrc)}"
          alt="${escapeHtml(afterAlt)}"
          loading="lazy"
          decoding="async"
          class="w-full h-full object-cover pointer-events-none"
          data-docboot-lightbox="true"
          data-lightbox-src="${escapeHtml(afterResolved.highResSrc)}"
          data-lightbox-alt="${escapeHtml(afterAlt)}"
        />
        <span class="absolute bottom-3 right-3 px-2.5 py-1 rounded text-xs font-semibold tracking-wide bg-black/70 text-white backdrop-blur-xs shadow-xs pointer-events-none">${escapeHtml(afterLabel)}</span>
      </div>
      <!-- Before Image (Clipped Overlay Layer) -->
      <div class="docboot-compare-before absolute inset-0 h-full overflow-hidden pointer-events-none" style="width: 50%;">
        <div class="absolute inset-0 w-full h-full" style="width: 100%;">
          <img
            src="${escapeHtml(beforeResolved.displaySrc)}"
            alt="${escapeHtml(beforeAlt)}"
            loading="lazy"
            decoding="async"
            class="w-full h-full object-cover"
            data-docboot-lightbox="true"
            data-lightbox-src="${escapeHtml(beforeResolved.highResSrc)}"
            data-lightbox-alt="${escapeHtml(beforeAlt)}"
          />
        </div>
        <span class="absolute bottom-3 left-3 px-2.5 py-1 rounded text-xs font-semibold tracking-wide bg-black/70 text-white backdrop-blur-xs shadow-xs">${escapeHtml(beforeLabel)}</span>
      </div>
      <!-- Draggable Handle -->
      <div class="docboot-compare-handle absolute top-0 bottom-0 w-1 bg-white shadow-xl cursor-ew-resize flex items-center justify-center -translate-x-1/2 focus:outline-hidden focus:ring-2 focus:ring-accent" style="left: 50%;" role="slider" aria-label="Image comparison slider" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" tabindex="0">
        <div class="w-8 h-8 rounded-full bg-white dark:bg-slate-900 border-2 border-accent shadow-lg flex items-center justify-center text-accent">
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

