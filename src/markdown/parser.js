import { Marked } from 'marked';
import { extractFrontmatter } from './frontmatter.js';
import { processDirectives } from './directives.js';
import { renderCodeBlock } from './codeblock.js';
import { TocCollector } from './toc.js';
import { normalizeMarkdownLink } from './links.js';
import { unescapeHtml, escapeHtml } from './highlighter.js';

export function isBadgeImage(href = '', alt = '', title = '') {
  const lower = (String(href) + ' ' + String(alt) + ' ' + String(title)).toLowerCase();
  return (
    lower.includes('shields.io') ||
    lower.includes('npmx.dev') ||
    lower.includes('badgen.net') ||
    lower.includes('badge.fury.io') ||
    lower.includes('/badge/') ||
    lower.includes('/badge?') ||
    lower.includes('badge.svg') ||
    lower.includes('style=flat') ||
    lower.includes('style=shieldsio') ||
    lower.includes('style=for-the-badge') ||
    lower.includes('style=plastic') ||
    lower.includes('github.com/actions/workflows') ||
    (lower.includes('workflows') && lower.includes('.svg')) ||
    lower.includes('codecov.io') ||
    lower.includes('coveralls.io') ||
    lower.includes('sonarcloud.io') ||
    lower.includes('travis-ci') ||
    lower.includes('circleci.com') ||
    lower.includes('img.shields.io') ||
    lower.includes('npmjs.com/badge') ||
    lower.includes('nodei.co')
  );
}

/**
 * Parses markdown file content into HTML, metadata, headings, and TOC.
 * @param {string} rawMarkdown 
 * @param {object} options 
 * @param {string} options.relativePath Relative file path for link resolution
 * @param {object} options.config Docboot config for allowlists
 * @returns {{ html: string, frontmatter: object, toc: Array, headings: Array, plainText: string }}
 */
export function parseMarkdown(rawMarkdown, options = {}) {
  const { frontmatter, content } = extractFrontmatter(rawMarkdown);
  const currentRelativePath = options.relativePath || '';
  const processedContent = processDirectives(content, options.config || {});

  const tocCollector = new TocCollector();
  const headings = [];

  const markedInstance = new Marked({
    gfm: true,
    breaks: false
  });

  const internalLinks = [];
  const externalLinks = [];
  const referencedAssets = [];
  let codeBlockCount = 0;

  const renderer = {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const plainTitle = unescapeHtml(text.replace(/<[^>]*>/g, '').trim());
      const id = tocCollector.getSlug(plainTitle);

      tocCollector.addHeading(depth, plainTitle, id);
      headings.push({ level: depth, title: plainTitle, id });

      if (depth === 1) {
        return `<h1 id="${id}" class="group scroll-mt-24 font-extrabold tracking-tight text-foreground text-3xl sm:text-4xl mb-6 pb-4 border-b border-border/80">${text}</h1>`;
      }
      if (depth === 2) {
        return `<h2 id="${id}" class="group relative flex items-center justify-between scroll-mt-24 font-bold tracking-tight text-foreground text-xl sm:text-2xl mt-12 mb-4 pb-2.5 border-b border-border/50">
          <span>${text}</span>
          <a href="#${id}" class="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-accent font-mono text-base transition-opacity ml-2" aria-label="Direct link to ${plainTitle}">#</a>
        </h2>`;
      }
      if (depth === 3) {
        return `<h3 id="${id}" class="group relative flex items-center justify-between scroll-mt-24 font-semibold tracking-tight text-foreground text-lg sm:text-xl mt-8 mb-3">
          <span>${text}</span>
          <a href="#${id}" class="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-accent font-mono text-sm transition-opacity ml-2" aria-label="Direct link to ${plainTitle}">#</a>
        </h3>`;
      }
      return `<h${depth} id="${id}" class="scroll-mt-24 font-medium text-foreground mt-6 mb-2">${text}</h${depth}>`;
    },

    code({ text, lang }) {
      codeBlockCount++;
      return renderCodeBlock(text, lang || '');
    },

    image({ href, title, text }) {
      referencedAssets.push(href);
      const isExternal = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//');
      const normalizedHref = isExternal ? href : normalizeMarkdownLink(href, currentRelativePath);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';

      const isBadge = isBadgeImage(href, text, title);
      if (isBadge) {
        return `<img src="${normalizedHref}" alt="${escapeHtml(text || title || '')}" class="inline-block align-middle my-1 mr-1.5 h-[20px] max-h-[22px] w-auto max-w-full rounded-xs shadow-none border-0 select-none" loading="lazy" decoding="async"${titleAttr} />`;
      }

      const captionHtml = title ? `<figcaption class="mt-2.5 text-xs text-muted-foreground font-medium">${escapeHtml(title)}</figcaption>` : '';

      return `
<figure class="docboot-figure not-prose my-8 text-center">
  <div class="inline-block relative overflow-hidden rounded-2xl border border-border/80 bg-card-bg/40 shadow-sm group">
    <img
      src="${normalizedHref}"
      alt="${escapeHtml(text || title || '')}"
      loading="lazy"
      decoding="async"
      class="block max-w-full h-auto rounded-2xl cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.01]"
      data-docboot-lightbox="true"
      data-lightbox-src="${normalizedHref}"
      data-lightbox-alt="${escapeHtml(text || title || '')}"
      data-lightbox-caption="${escapeHtml(title || '')}"
      ${titleAttr}
    />
  </div>
  ${captionHtml}
</figure>`;
    },

    table({ header, rows }) {
      let headerHtml = '';
      if (header) {
        headerHtml = `<thead class="bg-muted/60 border-b border-border text-xs uppercase font-semibold text-foreground/80"><tr>`;
        for (const cell of header) {
          const content = cell.tokens ? this.parser.parseInline(cell.tokens) : cell.text;
          const align = cell.align ? ` text-${cell.align}` : ' text-left';
          headerHtml += `<th class="py-3 px-4${align}">${content}</th>`;
        }
        headerHtml += `</tr></thead>`;
      }

      let bodyHtml = `<tbody class="divide-y divide-border/60 text-sm">`;
      for (const row of rows) {
        bodyHtml += `<tr class="hover:bg-muted/30 transition-colors">`;
        for (const cell of row) {
          const content = cell.tokens ? this.parser.parseInline(cell.tokens) : cell.text;
          const align = cell.align ? ` text-${cell.align}` : ' text-left';
          bodyHtml += `<td class="py-3 px-4 text-foreground/90${align}">${content}</td>`;
        }
        bodyHtml += `</tr>`;
      }
      bodyHtml += `</tbody>`;

      return `
<div class="my-8 w-full overflow-x-auto rounded-xl border border-border bg-card-bg shadow-xs">
  <table class="w-full text-left border-collapse">${headerHtml}${bodyHtml}</table>
</div>`;
    },

    blockquote({ tokens }) {
      const body = this.parser.parse(tokens);
      return `<blockquote class="my-6 pl-4 py-1.5 border-l-2 border-accent bg-accent/5 rounded-r-lg text-foreground/90 italic font-normal text-sm leading-relaxed">${body}</blockquote>`;
    },

    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const isExternal = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('//');
      if (isExternal) {
        externalLinks.push(href);
      } else {
        internalLinks.push({ original: href, normalized: normalizeMarkdownLink(href, currentRelativePath) });
      }

      const normalizedHref = normalizeMarkdownLink(href, currentRelativePath);
      const titleAttr = title ? ` title="${title}"` : '';
      const targetAttr = isExternal ? ` target="_blank" rel="noopener noreferrer"` : '';

      const isImageOrBadgeLink = /<img\b|<figure\b/i.test(text);
      if (isImageOrBadgeLink) {
        return `<a href="${normalizedHref}" class="inline-block align-middle hover:opacity-80 transition-opacity my-0.5 mr-1.5 no-underline"${titleAttr}${targetAttr}>${text}</a>`;
      }

      const extIcon = isExternal ? ` <svg class="inline w-3.5 h-3.5 text-muted-foreground/70 -mt-0.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>` : '';

      return `<a href="${normalizedHref}" class="font-medium text-accent hover:underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-all"${titleAttr}${targetAttr}>${text}${extIcon}</a>`;
    },

    listitem(item) {
      if (item.task) {
        const checkbox = `<input type="checkbox" disabled ${item.checked ? 'checked' : ''} class="mr-2 rounded border-border text-accent focus:ring-0 accent-accent inline-block align-middle" />`;
        const text = this.parser.parse(item.tokens, !!item.loose);
        return `<li class="task-list-item flex items-start gap-2 my-1 text-foreground">${checkbox}<span class="flex-1">${text}</span></li>\n`;
      }
      const text = this.parser.parse(item.tokens, !!item.loose);
      return `<li class="my-1.5 text-foreground/90 leading-relaxed">${text}</li>\n`;
    },

    hr() {
      return `<hr class="my-10 border-t border-border/80" />`;
    }
  };

  markedInstance.use({ renderer });

  const html = markedInstance.parse(processedContent);
  const toc = tocCollector.getTocTree();

  const plainText = unescapeHtml(
    content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/:::[\s\S]*?:::/g, '')
      .replace(/::tab[^\r\n]*/g, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[#*`_~\[\]()>-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );

  const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

  return {
    html,
    frontmatter,
    toc,
    headings,
    plainText,
    internalLinks,
    externalLinks,
    referencedAssets,
    codeBlockCount,
    wordCount: words
  };
}
