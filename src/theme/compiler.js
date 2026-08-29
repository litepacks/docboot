import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import cssnano from 'cssnano';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedCss = null;
let cachedClassSignature = null;

/**
 * Compiles Tailwind CSS v4 and design tokens with production compression.
 * @param {Array<string>} htmlContents Optional HTML strings to scan for classes
 * @param {object} options Options
 * @param {boolean} options.minify Whether to compress CSS with cssnano (default: true)
 * @returns {Promise<string>} Compiled and minified CSS
 */
export async function compileCss(htmlContents = [], options = {}) {
  const minify = options.minify !== false;

  // Fast class-signature extraction to bypass Tailwind when class list has not changed
  const classMatches = [];
  const classRegex = /class="([^"]+)"/g;
  for (const html of htmlContents) {
    let m;
    while ((m = classRegex.exec(html)) !== null) {
      classMatches.push(m[1]);
    }
  }
  const classSignature = Array.from(new Set(classMatches.join(' ').split(/\s+/).filter(Boolean))).sort().join(' ');

  if (cachedCss && cachedClassSignature === classSignature) {
    return cachedCss;
  }

  const tokensPath = path.join(__dirname, 'tokens.css');
  const tokensCss = fs.readFileSync(tokensPath, 'utf-8');

  // Inject source directives for Tailwind v4 scanner
  const sourceDirectives = `
@source "../*.js";
@source "../**/*.js";
@source "../../docs/**/*.md";
@source "../../docs/*.md";
`;

  const inputCss = sourceDirectives + '\n' + tokensCss;

  const plugins = [
    tailwindcss()
  ];

  if (minify) {
    plugins.push(cssnano({
      preset: ['default', {
        discardComments: { removeAll: true },
        normalizeWhitespace: true,
        minifyFontValues: true,
        minifyGradients: true
      }]
    }));
  }

  const result = await postcss(plugins).process(inputCss, { from: tokensPath });

  cachedCss = result.css;
  cachedClassSignature = classSignature;
  return cachedCss;
}

export function getCachedCss() {
  return cachedCss;
}

export function clearCssCache() {
  cachedCss = null;
  cachedClassSignature = null;
}
