import Prism from 'prismjs';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-shell-session.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-markdown.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-rust.js';
import 'prismjs/components/prism-go.js';
import 'prismjs/components/prism-sql.js';

// Define alias for 'euix' -> uses markup / XML grammar with custom tokens
Prism.languages.euix = Prism.languages.markup;

const LANG_ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  md: 'markdown',
  yml: 'yaml',
  py: 'python',
  rs: 'rust',
  golang: 'go'
};

/**
 * Highlights code string with Prism.js.
 * @param {string} code Raw code
 * @param {string} lang Language identifier
 * @returns {string} Highlighted HTML
 */
export function highlight(code, lang = '') {
  if (!code) return '';
  const normalized = (lang || '').toLowerCase().trim();
  const targetLang = LANG_ALIASES[normalized] || normalized;

  if (targetLang && Prism.languages[targetLang]) {
    try {
      return Prism.highlight(code, Prism.languages[targetLang], targetLang);
    } catch (err) {
      console.warn(`[docboot] Highlighting failed for lang "${lang}":`, err.message);
    }
  }

  // Fallback to basic HTML entity escaping
  return escapeHtml(code);
}

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
};
const ESCAPE_REGEX = /[&<>"']/g;

export function escapeHtml(str) {
  if (!str) return '';
  if (!ESCAPE_REGEX.test(str)) return str;
  return str.replace(ESCAPE_REGEX, char => ESCAPE_MAP[char]);
}

const UNESCAPE_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&#039;': "'"
};
const UNESCAPE_REGEX = /&(?:amp|lt|gt|quot|#39|#x27|#039);/g;

export function unescapeHtml(str) {
  if (!str) return '';
  if (!str.includes('&')) return str;
  return str.replace(UNESCAPE_REGEX, entity => UNESCAPE_MAP[entity] || entity);
}
