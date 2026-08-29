import { extractFrontmatter } from '../markdown/frontmatter.js';
import { parseMarkdown } from '../markdown/parser.js';
import { parseDirectiveArgs } from '../markdown/directives.js';

/**
 * Splits a single horizontal block into vertical sub-slides.
 * Supports:
 * - `--` (two hyphens outside code fences)
 * - `:::vslide` / `:::subslide` directives
 *
 * @param {string} rawContent
 * @param {object} baseArgs
 * @returns {Array<{ rawContent: string, args: object }>}
 */
export function splitVerticalSlides(rawContent = '', baseArgs = {}) {
  const lines = rawContent.split(/\r?\n/);
  const vSlides = [];
  let currentLines = [];
  let inCodeFence = false;
  let codeFenceChar = '';
  let codeFenceLen = 0;
  let currentArgs = { ...baseArgs };
  let hasVerticalSeparators = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track code fences
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
      // 1. `--` two dashes separator for vertical sub-slides
      if (trimmed === '--') {
        hasVerticalSeparators = true;
        if (currentLines.length > 0 && currentLines.some(l => l.trim().length > 0)) {
          vSlides.push({
            rawContent: currentLines.join('\n').trim(),
            args: { ...currentArgs }
          });
        }
        currentLines = [];
        currentArgs = { ...baseArgs };
        continue;
      }

      // 2. `:::vslide` or `:::subslide` directive
      if (/^:::(?:vslide|subslide)(?:\s+(.*))?$/.test(trimmed)) {
        hasVerticalSeparators = true;
        if (currentLines.length > 0 && currentLines.some(l => l.trim().length > 0)) {
          vSlides.push({
            rawContent: currentLines.join('\n').trim(),
            args: { ...currentArgs }
          });
        }
        currentLines = [];
        const rawArgs = trimmed.replace(/^:::(?:vslide|subslide)\s*/, '');
        currentArgs = { ...baseArgs, ...parseDirectiveArgs(rawArgs) };
        continue;
      }
    }

    currentLines.push(line);
  }

  if (currentLines.length > 0 && currentLines.some(l => l.trim().length > 0)) {
    vSlides.push({
      rawContent: currentLines.join('\n').trim(),
      args: { ...currentArgs }
    });
  }

  if (hasVerticalSeparators && vSlides.length > 1) {
    return vSlides;
  }

  return [{ rawContent: rawContent.trim(), args: baseArgs }];
}

/**
 * Splits raw presentation Markdown into slide raw blocks (2D Grid: Horizontal + Vertical).
 *
 * @param {string} content Markdown body without frontmatter
 * @returns {Array<{ rawContent: string, args: object, hIndex: number, vIndex: number }>}
 */
export function splitSlides(content = '') {
  const lines = content.split(/\r?\n/);
  const horizontalBlocks = [];

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
            horizontalBlocks.push({
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
          horizontalBlocks.push({
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
      horizontalBlocks.push({
        rawContent: currentSlideLines.join('\n').trim(),
        args: currentArgs
      });
    }
  }

  // Check horizontal rules `---` if not using explicit :::slide directives
  if (horizontalBlocks.length === 0) {
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
            horizontalBlocks.push({
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
        horizontalBlocks.push({
          rawContent: currentSlideLines.join('\n').trim(),
          args: {}
        });
      }
    }
  }

  // Fallback: heading-based splitting (h1 -> horizontal chapter, h2 -> slide)
  if (horizontalBlocks.length === 0) {
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
          horizontalBlocks.push({
            rawContent: currentSlideLines.join('\n').trim(),
            args: {}
          });
        }
        currentSlideLines = [];
      }

      currentSlideLines.push(line);
    }

    if (currentSlideLines.length > 0 && currentSlideLines.some(l => l.trim().length > 0)) {
      horizontalBlocks.push({
        rawContent: currentSlideLines.join('\n').trim(),
        args: {}
      });
    }
  }

  if (horizontalBlocks.length === 0) {
    horizontalBlocks.push({ rawContent: content.trim(), args: {} });
  }

  // Now process 2D grid: split each horizontal block into vertical sub-slides if `--` is present
  const finalSlides = [];
  for (let h = 0; h < horizontalBlocks.length; h++) {
    const hBlock = horizontalBlocks[h];
    const hIndex = h + 1;
    const vBlocks = splitVerticalSlides(hBlock.rawContent, hBlock.args);

    for (let v = 0; v < vBlocks.length; v++) {
      const vBlock = vBlocks[v];
      const vIndex = v + 1;
      finalSlides.push({
        rawContent: vBlock.rawContent,
        args: vBlock.args,
        hIndex,
        vIndex,
        vCount: vBlocks.length
      });
    }
  }

  return finalSlides;
}

/**
 * Extracts speaker notes from raw slide content.
 * Speaker notes can be defined with:
 * `:::notes ... :::` or `<notes>...</notes>`
 *
 * @param {string} rawContent
 * @returns {{ cleanContent: string, notes: string }}
 */
export function extractSpeakerNotes(rawContent = '') {
  let notes = '';
  let cleanContent = rawContent;

  // Extract :::notes ... :::
  cleanContent = cleanContent.replace(/:::notes\s*([\s\S]*?):::/g, (match, noteContent) => {
    notes += (notes ? '\n' : '') + noteContent.trim();
    return '';
  });

  // Extract <notes>...</notes>
  cleanContent = cleanContent.replace(/<notes>([\s\S]*?)<\/notes>/gi, (match, noteContent) => {
    notes += (notes ? '\n' : '') + noteContent.trim();
    return '';
  });

  return {
    cleanContent: cleanContent.trim(),
    notes: notes.trim()
  };
}

/**
 * Detects and extracts split layout columns (::left and ::right).
 *
 * @param {string} content
 * @returns {{ isSplit: boolean, left: string, right: string, raw: string }}
 */
export function extractSplitColumns(content = '') {
  const leftMatch = content.match(/::left\s*([\s\S]*?)(?=::right|$)/i);
  const rightMatch = content.match(/::right\s*([\s\S]*?)$/i);

  if (leftMatch || rightMatch) {
    return {
      isSplit: true,
      left: (leftMatch ? leftMatch[1] : '').trim(),
      right: (rightMatch ? rightMatch[1] : '').trim(),
      raw: content
    };
  }

  return {
    isSplit: false,
    left: '',
    right: '',
    raw: content
  };
}

/**
 * Derives a clean slide title from its Markdown content.
 *
 * @param {string} markdown
 * @param {number} fallbackIndex
 * @returns {string}
 */
export function extractSlideTitle(markdown = '', fallbackIndex = 1) {
  const headingMatch = markdown.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].replace(/[*_`#]/g, '').trim();
  }
  return `Slide ${fallbackIndex}`;
}

/**
 * Compiles a raw presentation Markdown string into a normalized presentation deck object.
 *
 * @param {string} rawMarkdown Full Markdown source file content
 * @param {object} options
 * @param {object} options.config Docboot config
 * @param {string} options.relativePath Relative file path
 * @param {string} options.base Base path
 * @returns {object} Normalized presentation deck artifact
 */
export function compilePresentation(rawMarkdown = '', options = {}) {
  const extracted = extractFrontmatter(rawMarkdown) || {};
  const frontmatter = extracted.frontmatter || {};
  const markdownBody = extracted.content || rawMarkdown || '';
  const config = options.config || {};

  // Extract Deck Meta
  const title = frontmatter.title || extractSlideTitle(markdownBody, 1) || config.title || 'Docboot Presentation';
  const theme = frontmatter.theme || config.theme?.defaultMode || 'system';
  const preset = frontmatter.preset || config.theme?.preset || 'zinc';
  const ratio = frontmatter.ratio || '16:9';
  const progress = frontmatter.progress !== false;
  const slideNumber = frontmatter.slideNumber !== false;

  // Split Slides into 2D Grid
  const rawSlides = splitSlides(markdownBody);
  const totalSlides = rawSlides.length;

  const slides = rawSlides.map((slideObj, index) => {
    const slideNumberIdx = index + 1;
    const hIndex = slideObj.hIndex || slideNumberIdx;
    const vIndex = slideObj.vIndex || 1;
    const vCount = slideObj.vCount || 1;
    const isVertical = vCount > 1;
    const displayIndex = isVertical ? `${hIndex}.${vIndex}` : `${hIndex}`;
    const slideId = `slide-${hIndex}-${vIndex}`;

    // Extract speaker notes
    const { cleanContent, notes } = extractSpeakerNotes(slideObj.rawContent);

    // Extract split columns
    const { isSplit, left, right } = extractSplitColumns(cleanContent);

    // Determine layout
    let layout = slideObj.args.layout || (isSplit ? 'split' : 'default');
    if (layout === 'title' || layout === 'cover') layout = 'center';

    let html = '';
    let leftHtml = '';
    let rightHtml = '';

    if (isSplit) {
      const parsedLeft = parseMarkdown(left, { ...options, isSlide: true });
      const parsedRight = parseMarkdown(right, { ...options, isSlide: true });
      leftHtml = parsedLeft.html;
      rightHtml = parsedRight.html;

      html = `
        <div class="docboot-split-container flex flex-col md:flex-row gap-8 w-full h-full items-center justify-between">
          <div class="docboot-split-column docboot-split-left flex-1 w-full">${leftHtml}</div>
          <div class="docboot-split-column docboot-split-right flex-1 w-full">${rightHtml}</div>
        </div>
      `.trim();
    } else {
      const parsed = parseMarkdown(cleanContent, { ...options, isSlide: true });
      html = parsed.html;
    }

    const slideTitle = extractSlideTitle(cleanContent, displayIndex);

    return {
      id: slideId,
      index: slideNumberIdx,
      hIndex,
      vIndex,
      vCount,
      isVertical,
      displayIndex,
      layout,
      title: slideTitle,
      background: slideObj.args.background || null,
      backgroundColor: slideObj.args.backgroundColor || slideObj.args.bgColor || null,
      customClass: slideObj.args.class || '',
      html,
      leftHtml,
      rightHtml,
      notes,
      headings: []
    };
  });

  return {
    title,
    theme,
    preset,
    ratio,
    progress,
    slideNumber,
    slideCount: totalSlides,
    slides
  };
}
