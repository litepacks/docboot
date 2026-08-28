import { marked } from 'marked';

const CALLOUT_CONFIGS = {
  note: {
    title: 'Note',
    icon: `<svg class="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>`,
    containerClass: 'border-l-4 border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 text-foreground',
    titleClass: 'text-blue-600 dark:text-blue-400 font-semibold'
  },
  tip: {
    title: 'Tip',
    icon: `<svg class="w-4 h-4 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>`,
    containerClass: 'border-l-4 border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 text-foreground',
    titleClass: 'text-emerald-600 dark:text-emerald-400 font-semibold'
  },
  warning: {
    title: 'Warning',
    icon: `<svg class="w-4 h-4 text-amber-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>`,
    containerClass: 'border-l-4 border-amber-500 bg-amber-500/5 dark:bg-amber-500/10 text-foreground',
    titleClass: 'text-amber-600 dark:text-amber-400 font-semibold'
  },
  danger: {
    title: 'Danger',
    icon: `<svg class="w-4 h-4 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>`,
    containerClass: 'border-l-4 border-rose-500 bg-rose-500/5 dark:bg-rose-500/10 text-foreground',
    titleClass: 'text-rose-600 dark:text-rose-400 font-semibold'
  }
};

/**
 * Transforms :::callout containers in markdown text before parsing.
 * @param {string} markdown Raw markdown content
 * @returns {string} Transformed markdown with custom callout HTML wrappers
 */
export function processCallouts(markdown) {
  if (!markdown || !markdown.includes(':::')) return markdown;

  const pattern = /:::([a-z]+)(?:[ \t]+([^\r\n]+))?\r?\n([\s\S]*?)\r?\n:::/g;

  return markdown.replace(pattern, (match, type, title, body) => {
    const normType = type.toLowerCase();
    const config = CALLOUT_CONFIGS[normType];
    if (!config) return match;

    const displayTitle = (title && title.trim()) || config.title;
    const innerHtml = marked.parse(body.trim());

    return `
<div class="euix-callout my-6 rounded-r-xl p-4 text-sm leading-relaxed ${config.containerClass} shadow-xs">
  <div class="flex items-center gap-2 mb-1.5 ${config.titleClass}">
    ${config.icon}
    <span>${displayTitle}</span>
  </div>
  <div class="euix-callout-content text-foreground/85 prose-sm [&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
    ${innerHtml}
  </div>
</div>
`;
  });
}
