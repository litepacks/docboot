import { highlight, escapeHtml } from './highlighter.js';

/**
 * Parses code block info string (e.g. `js title="index.js" {2,4-6}`)
 * @param {string} info 
 * @returns {{ lang: string, filename: string, highlightLines: number[] }}
 */
export function parseCodeInfo(info = '') {
  const parts = info.trim().split(/\s+/);
  const lang = (parts[0] || 'text').toLowerCase();
  let filename = '';
  const highlightLines = new Set();

  for (const part of parts) {
    if (part.startsWith('title=') || part.startsWith('filename=')) {
      filename = part.split('=')[1].replace(/^["']|["']$/g, '');
    } else if (/^\{([0-9,\-]+)\}$/.test(part)) {
      const ranges = part.slice(1, -1).split(',');
      for (const r of ranges) {
        if (r.includes('-')) {
          const [start, end] = r.split('-').map(n => parseInt(n, 10));
          if (!isNaN(start) && !isNaN(end)) {
            for (let line = start; line <= end; line++) {
              highlightLines.add(line);
            }
          }
        } else {
          const num = parseInt(r, 10);
          if (!isNaN(num)) highlightLines.add(num);
        }
      }
    }
  }

  return { lang, filename, highlightLines: Array.from(highlightLines) };
}

/**
 * Sanitizes and auto-quotes unquoted node labels in Mermaid diagrams
 * (e.g. `Node[src/file.js: func]` -> `Node["src/file.js: func"]`)
 * @param {string} code 
 * @returns {string} Sanitized mermaid source
 */
export function sanitizeMermaidCode(code = '') {
  if (!code) return '';
  return code.split('\n').map(line => {
    let out = line.replace(/(\b[a-zA-Z0-9_-]+)\[([^"'\r\n\]]+)\]/g, (match, node, label) => {
      const trimmed = label.trim();
      if (!trimmed.startsWith('"') && !trimmed.startsWith("'")) {
        return `${node}["${trimmed.replace(/"/g, '\\"')}"]`;
      }
      return match;
    });

    out = out.replace(/(\b[a-zA-Z0-9_-]+)\(([^"'\r\n\)]+)\)/g, (match, node, label) => {
      const trimmed = label.trim();
      if (!trimmed.startsWith('"') && !trimmed.startsWith("'") && (trimmed.includes('/') || trimmed.includes(':'))) {
        return `${node}("${trimmed.replace(/"/g, '\\"')}")`;
      }
      return match;
    });

    return out;
  }).join('\n');
}

/**
 * Renders custom code block or interactive Mermaid diagram card.
 * @param {string} code Raw code content
 * @param {string} info Info string from markdown fence
 * @returns {string} HTML markup
 */
export function renderCodeBlock(code, info = '') {
  const { lang, filename, highlightLines } = parseCodeInfo(info);

  if (lang === 'mermaid') {
    const sanitized = sanitizeMermaidCode(code);
    const diagramTitle = filename || 'Mermaid Diagram';

    return `
<figure role="figure" aria-label="${escapeHtml(diagramTitle)}" class="docboot-mermaid-wrapper not-prose my-6 rounded-lg border border-border bg-card-bg/40 shadow-xs overflow-hidden">
  <div class="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-muted/20 text-xs font-mono select-none">
    <figcaption class="text-[11px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 3h6v6H3zM15 3h6v6h-6zM9 15h6v6H9z"/><path d="M6 9v3a3 3 0 003 3h3m3-6v3a3 3 0 01-3 3"/></svg>
      <span>${escapeHtml(diagramTitle)}</span>
    </figcaption>
    <div class="flex items-center gap-1.5">
      <button type="button" class="docboot-mermaid-expand-btn inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer" title="Open zoomable modal" aria-label="Expand diagram modal">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        <span class="text-[10px]">Expand</span>
      </button>
      <button type="button" class="euix-copy-btn inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer" data-code="${escapeHtml(code)}" aria-label="Copy mermaid code to clipboard">
        <span class="copy-icon"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></span>
        <span class="copied-icon hidden"><svg class="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>
        <span class="copy-text text-[10px]">Copy</span>
      </button>
    </div>
  </div>
  <div class="relative p-6 overflow-x-auto flex flex-col justify-center items-center text-center min-h-[140px]">
    <div class="docboot-mermaid-loading flex flex-col items-center justify-center gap-2.5 py-6 text-muted-foreground text-xs font-mono animate-pulse" aria-hidden="true">
      <svg class="w-5 h-5 animate-spin text-accent" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
      <span class="text-[11px] tracking-wide">Rendering diagram...</span>
    </div>
    <pre class="mermaid bg-transparent m-0 p-0 text-foreground font-sans hidden">${escapeHtml(sanitized)}</pre>
  </div>
  <details class="docboot-mermaid-source border-t border-border/40 px-4 py-2 bg-muted/10 text-xs">
    <summary class="cursor-pointer text-muted-foreground hover:text-foreground font-medium select-none flex items-center gap-1.5">
      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      <span>View diagram source</span>
    </summary>
    <pre class="mt-2 p-3 rounded bg-muted/40 font-mono text-[11px] overflow-x-auto text-foreground"><code>${escapeHtml(code)}</code></pre>
  </details>
</figure>
`;
  }

  const highlighted = highlight(code, lang);
  const displayLang = lang && lang !== 'text' ? lang.toUpperCase() : '';
  const headerTitle = filename || displayLang || '';

  const copyIconSvg = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
  const checkIconSvg = `<svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  let finalCodeHtml = highlighted;
  const hasLineHighlight = highlightLines && highlightLines.length > 0;
  const highlightSet = new Set(highlightLines || []);

  if (hasLineHighlight) {
    const rawLines = highlighted.split(/\r?\n/);
    finalCodeHtml = rawLines.map((line, idx) => {
      const lineNum = idx + 1;
      const isHighlighted = highlightSet.has(lineNum);
      const highlightClass = isHighlighted ? ' highlighted-line' : '';
      return `<span class="line${highlightClass}">${line || ' '}</span>`;
    }).join('\n');
  }

  const extraContainerClass = hasLineHighlight ? ' has-highlighted-lines' : '';

  return `
<div class="docboot-codeblock euix-codeblock group my-6 rounded-lg border border-border/90 bg-[#0d1117] text-[#e6edf3] shadow-md shadow-black/10 overflow-hidden text-sm${extraContainerClass}">
  <div class="flex items-center justify-between px-4 py-2.5 border-b border-[#21262d] bg-[#161b22] text-xs font-mono select-none">
    <div class="flex items-center gap-2">
      <div class="flex items-center gap-1.5 mr-2">
        <span class="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/80 inline-block"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/80 inline-block"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-[#27c93f]/80 inline-block"></span>
      </div>
      ${headerTitle ? `<span class="font-medium text-[#8b949e] tracking-tight">${escapeHtml(headerTitle)}</span>` : ''}
    </div>
    <div class="flex items-center gap-2">
      ${displayLang && filename ? `<span class="text-[10px] px-2 py-0.5 rounded-[3px] bg-[#21262d] text-[#8b949e] font-semibold uppercase tracking-wider">${displayLang}</span>` : ''}
      <button type="button" class="docboot-copy-btn euix-copy-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-all cursor-pointer" data-code="${escapeHtml(code)}" aria-label="Copy code">
        <span class="copy-icon">${copyIconSvg}</span>
        <span class="copied-icon hidden">${checkIconSvg}</span>
        <span class="copy-text text-[11px] font-medium">Copy</span>
      </button>
    </div>
  </div>
  <div class="relative overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
    <pre class="m-0 p-0 bg-transparent text-[#e6edf3]"><code>${finalCodeHtml}</code></pre>
  </div>
</div>
`;
}
