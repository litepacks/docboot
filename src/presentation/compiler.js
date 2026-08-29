import { extractFrontmatter } from '../markdown/frontmatter.js';
import { parseMarkdown } from '../markdown/parser.js';
import { parseDirectiveArgs } from '../markdown/directives.js';

/**
 * Splits raw presentation Markdown into slide raw blocks.
 * Supports:
 * 1. Explicit `:::slide ... :::` directives.
 * 2. Horizontal rule `---` separators (outside code fences).
 * 3. Automatic heading splitting (`h1`/`h2`) fallback when no separators exist.
 *
 * @param {string} content Markdown body without frontmatter
 * @returns {Array<{ rawContent: string, args: object }>}
 */
export function splitSlides(content = '') {
  const lines = content.split(/\r?\n/);
  const slideBlocks = [];

  let inCodeFence = false;
  let codeFenceChar = '';
  let codeFenceLen = 0;

  // Check if content uses explicit :::slide directives
  const hasExplicitSlideDirective = /^[ \t]*:::slide(?:\s+.*)?$/m.test(content);

  if (hasExplicitSlideDirective) {
    let currentSlideLines = [];
    let currentArgs = {};
    let inSlideDirective = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track code fence
      const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
      if (fenceMatch) {
        const char = fenceMatch[2][0];
        const len = fenceMatch[2].length;
        if (!inCodeFence) {
          inCodeFence = true;
          codeFenceChar = char;
          codeFenceLen = len;
        } else if (char === codeFenceChar && len >= codeFenceLen) {
          inCodeFence = false;
        }
      }

      if (!inCodeFence) {
        if (/^:::slide(?:\s+(.*))?$/.test(trimmed)) {
          if (currentSlideLines.length > 0 && currentSlideLines.some(l => l.trim().length > 0)) {
            slideBlocks.push({
              rawContent: currentSlideLines.join('\n').trim(),
              args: currentArgs
            });
          }
          currentSlideLines = [];
          const rawArgs = trimmed.replace(/^:::slide\s*/, '');
          currentArgs = parseDirectiveArgs(rawArgs);
          inSlideDirective = true;
          continue;
        } else if (inSlideDirective && trimmed === ':::') {
          slideBlocks.push({
            rawContent: currentSlideLines.join('\n').trim(),
            args: currentArgs
          });
          currentSlideLines = [];
          currentArgs = {};
          inSlideDirective = false;
          continue;
        }
      }

      currentSlideLines.push(line);
    }

    if (currentSlideLines.length > 0 && currentSlideLines.some(l => l.trim().length > 0)) {
      slideBlocks.push({
        rawContent: currentSlideLines.join('\n').trim(),
        args: currentArgs
      });
    }

    if (slideBlocks.length > 0) {
      return slideBlocks;
    }
  }

  // Check if content uses `---` horizontal rules
  let usesHorizontalRules = false;
  inCodeFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
    if (fenceMatch) {
      const char = fenceMatch[2][0];
      const len = fenceMatch[2].length;
      if (!inCodeFence) {
        inCodeFence = true;
        codeFenceChar = char;
        codeFenceLen = len;
      } else if (char === codeFenceChar && len >= codeFenceLen) {
        inCodeFence = false;
      }
    } else if (!inCodeFence && (trimmed === '---' || trimmed === '***' || trimmed === '___')) {
      usesHorizontalRules = true;
      break;
    }
  }

  if (usesHorizontalRules) {
    let currentSlideLines = [];
    inCodeFence = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
      if (fenceMatch) {
        const char = fenceMatch[2][0];
        const len = fenceMatch[2].length;
        if (!inCodeFence) {
          inCodeFence = true;
          codeFenceChar = char;
          codeFenceLen = len;
        } else if (char === codeFenceChar && len >= codeFenceLen) {
          inCodeFence = false;
        }
      }

      if (!inCodeFence && (trimmed === '---' || trimmed === '***' || trimmed === '___')) {
        if (currentSlideLines.length > 0 && currentSlideLines.some(l => l.trim().length > 0)) {
          slideBlocks.push({
            rawContent: currentSlideLines.join('\n').trim(),
            args: {}
          });
        }
        currentSlideLines = [];
        continue;
      }

      currentSlideLines.push(line);
    }

    if (currentSlideLines.length > 0 && currentSlideLines.some(l => l.trim().length > 0)) {
      slideBlocks.push({
        rawContent: currentSlideLines.join('\n').trim(),
        args: {}
      });
    }

    if (slideBlocks.length > 0) {
      return slideBlocks;
    }
  }

  // Automatic splitting fallback (h1 -> title slide, h2 -> new slide)
  let currentSlideLines = [];
  inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
    if (fenceMatch) {
      const char = fenceMatch[2][0];
      const len = fenceMatch[2].length;
      if (!inCodeFence) {
        inCodeFence = true;
        codeFenceChar = char;
        codeFenceLen = len;
      } else if (char === codeFenceChar && len >= codeFenceLen) {
        inCodeFence = false;
      }
    }

    if (!inCodeFence && (trimmed.startsWith('# ') || trimmed.startsWith('## '))) {
      if (currentSlideLines.length > 0 && currentSlideLines.some(l => l.trim().length > 0)) {
        slideBlocks.push({
          rawContent: currentSlideLines.join('\n').trim(),
          args: {}
        });
      }
      currentSlideLines = [];
    }

    currentSlideLines.push(line);
  }

  if (currentSlideLines.length > 0 && currentSlideLines.some(l => l.trim().length > 0)) {
    slideBlocks.push({
      rawContent: currentSlideLines.join('\n').trim(),
      args: {}
    });
  }

  return slideBlocks.length > 0 ? slideBlocks : [{ rawContent: content.trim(), args: {} }];
}

/**
 * Extracts speaker notes (`:::notes ... :::` or `<notes>...</notes>`) from raw slide content.
 * Returns the cleaned slide body and the notes string.
 *
 * @param {string} rawContent
 * @returns {{ cleanContent: string, notes: string }}
 */
export function extractSpeakerNotes(rawContent = '') {
  let notes = '';
  let cleanContent = rawContent;

  // Match :::notes ... :::
  const notesRegex = /:::notes\s*([\s\S]*?)\s*:::/gi;
  let match;
  while ((match = notesRegex.exec(rawContent)) !== null) {
    notes += (notes ? '\n\n' : '') + match[1].trim();
  }
  cleanContent = cleanContent.replace(notesRegex, '').trim();

  // Match <notes>...</notes> fallback
  const htmlNotesRegex = /<notes>([\s\S]*?)<\/notes>/gi;
  while ((match = htmlNotesRegex.exec(cleanContent)) !== null) {
    notes += (notes ? '\n\n' : '') + match[1].trim();
  }
  cleanContent = cleanContent.replace(htmlNotesRegex, '').trim();

  return { cleanContent, notes };
}

/**
 * Extracts left and right columns for split layouts.
 * Supports:
 * `::left ... ::right ...` or `:::left ... :::` and `:::right ... :::`
 *
 * @param {string} content
 * @returns {{ isSplit: boolean, left: string, right: string, main: string }}
 */
export function extractSplitColumns(content = '') {
  // Check for :::left and :::right
  const leftMatch = content.match(/:::left\s*([\s\S]*?)\s*:::/i);
  const rightMatch = content.match(/:::right\s*([\s\S]*?)\s*:::/i);

  if (leftMatch || rightMatch) {
    const left = leftMatch ? leftMatch[1].trim() : '';
    const right = rightMatch ? rightMatch[1].trim() : '';
    const main = content.replace(/:::(?:left|right)[\s\S]*?:::/gi, '').trim();
    return { isSplit: true, left, right, main };
  }

  // Check for ::left and ::right inline markers
  if (content.includes('::left') || content.includes('::right')) {
    const parts = content.split(/::(left|right)\s*/i);
    let left = '';
    let right = '';
    let main = '';

    if (parts.length > 1) {
      main = parts[0].trim();
      for (let i = 1; i < parts.length; i += 2) {
        const side = parts[i].toLowerCase();
        const text = (parts[i + 1] || '').trim();
        if (side === 'left') left = text;
        if (side === 'right') right = text;
      }
      return { isSplit: true, left, right, main };
    }
  }

  return { isSplit: false, left: '', right: '', main: content };
}

/**
 * Compiles a raw Markdown presentation string into a normalized presentation deck.
 *
 * @param {string} rawMarkdown Full markdown content with frontmatter
 * @param {object} options
 * @param {object} options.config Docboot configuration
 * @param {string} options.relativePath Relative file path for asset resolution
 * @param {string} options.base Base path
 * @returns {object} Normalized Deck
 */
export function compilePresentation(rawMarkdown, options = {}) {
  const { frontmatter, content } = extractFrontmatter(rawMarkdown);
  const config = options.config || {};
  const presentationConfig = {
    theme: frontmatter.theme || config.presentation?.theme || config.theme?.defaultMode || 'system',
    ratio: frontmatter.ratio || config.presentation?.ratio || '16:9',
    progress: frontmatter.progress !== undefined ? frontmatter.progress : (config.presentation?.progress ?? true),
    slideNumber: frontmatter.slideNumber !== undefined ? frontmatter.slideNumber : (config.presentation?.slideNumber ?? true),
    preset: frontmatter.preset || config.presentation?.preset || config.theme?.preset || 'zinc',
    title: frontmatter.title || config.title || 'Docboot Presentation'
  };

  const rawBlocks = splitSlides(content);
  const slides = [];

  for (let idx = 0; idx < rawBlocks.length; idx++) {
    const block = rawBlocks[idx];
    const index = idx + 1;
    const slideId = `slide-${index}`;

    // Extract speaker notes
    const { cleanContent, notes } = extractSpeakerNotes(block.rawContent);

    // Extract split columns if present
    const splitData = extractSplitColumns(cleanContent);
    const layout = block.args.layout || (splitData.isSplit ? 'split' : 'default');

    let html = '';
    let leftHtml = '';
    let rightHtml = '';
    let mainHtml = '';
    let headings = [];

    const parseOpts = {
      ...options,
      relativePath: options.relativePath || ''
    };

    if (splitData.isSplit) {
      if (splitData.main) {
        const parsedMain = parseMarkdown(splitData.main, parseOpts);
        mainHtml = parsedMain.html;
        headings.push(...parsedMain.headings);
      }
      if (splitData.left) {
        const parsedLeft = parseMarkdown(splitData.left, parseOpts);
        leftHtml = parsedLeft.html;
        headings.push(...parsedLeft.headings);
      }
      if (splitData.right) {
        const parsedRight = parseMarkdown(splitData.right, parseOpts);
        rightHtml = parsedRight.html;
        headings.push(...parsedRight.headings);
      }
      html = `
        ${mainHtml ? `<div class="docboot-slide-header mb-6">${mainHtml}</div>` : ''}
        <div class="docboot-slide-split-grid grid grid-cols-1 md:grid-cols-2 gap-8 items-start w-full">
          <div class="docboot-slide-col-left">${leftHtml}</div>
          <div class="docboot-slide-col-right">${rightHtml}</div>
        </div>
      `.trim();
    } else {
      const parsed = parseMarkdown(cleanContent, parseOpts);
      html = parsed.html;
      headings = parsed.headings;
    }

    // Determine slide title
    const slideTitle = headings.length > 0 ? headings[0].title : (index === 1 ? presentationConfig.title : `Slide ${index}`);

    slides.push({
      id: slideId,
      index,
      layout,
      title: slideTitle,
      background: block.args.background || null,
      backgroundColor: block.args.backgroundColor || block.args.bgcolor || null,
      customClass: block.args.class || block.args.className || '',
      html,
      leftHtml: leftHtml || null,
      rightHtml: rightHtml || null,
      notes: notes || '',
      headings
    });
  }

  return {
    title: presentationConfig.title,
    theme: presentationConfig.theme,
    preset: presentationConfig.preset,
    ratio: presentationConfig.ratio,
    progress: presentationConfig.progress,
    slideNumber: presentationConfig.slideNumber,
    frontmatter,
    slideCount: slides.length,
    slides
  };
}
