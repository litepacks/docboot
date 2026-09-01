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

  // 8. Custom Text Size Container (::: text-sm, ::: text-lg, ::: text-xl, ::: text-xs, ::: lead)
  if (type.startsWith('text-') || type === 'lead' || type === 'small' || type === 'large') {
    return renderTextSizeContainer(type, args, body);
  }

  // 9. Slide Directive (Docs mode fallback: renders content as section)
  if (type === 'slide' || type === 'vslide' || type === 'subslide') {
    const layout = args.layout || 'default';
    const bgAttr = args.background ? ` style="background-image: url('${args.background}'); background-size: cover;"` : '';
    const customClass = args.class || '';
    return `<div class="docboot-slide-section docboot-slide-layout-${layout} ${customClass} my-8 py-4 border-b border-border/40"${bgAttr}>\n\n${body}\n\n</div>`;
  }

  // 10. Speaker Notes Directive (Docs mode: omit from public documentation output)
  if (type === 'notes') {
    return '';
  }

  // 11. Split Layout Columns (::left and ::right)
  if (type === 'left' || type === 'right') {
    return `<div class="docboot-col docboot-col-${type} my-4">\n\n${body}\n\n</div>`;
  }

  // 12. Presentation-only container (Docs mode: omit)
  if (type === 'presentation') {
    return '';
  }

  // 13. Incremental Reveal Fragment Directive (:::fragment ... :::)
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
      const dirOpenMatch = line.match(/^:::([a-zA-Z0-9_-]+)(?:[ \t]+([^\r\n]+))?$/);
      if (dirOpenMatch) {
        inDirective = true;
        directiveName = dirOpenMatch[1];
        directiveRawArgs = dirOpenMatch[2] || '';
        directiveBodyLines = [];
        continue;
      } else {
        resultLines.push(line);
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
