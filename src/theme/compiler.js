import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedCss = null;
let cachedClassSignature = null;

/**
 * Compiles Tailwind CSS and design tokens.
 * @param {Array<string>} htmlContents Optional HTML strings to scan for classes
 * @returns {Promise<string>} Compiled CSS
 */
export async function compileCss(htmlContents = []) {
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
  const srcDir = path.resolve(__dirname, '..');

  const tailwindConfig = {
    darkMode: 'class',
    content: [
      path.join(srcDir, '{cli,compiler,config,doctor,markdown,renderer,routes,scanner,search,server,stats,theme,watcher}/**/*.js'),
      path.join(srcDir, 'runtime/*.js'),
      {
        raw: htmlContents.join('\n'),
        extension: 'html'
      }
    ],
    theme: {
      extend: {
        colors: {
          background: 'var(--background)',
          foreground: 'var(--foreground)',
          muted: 'var(--muted)',
          'muted-foreground': 'var(--muted-foreground)',
          border: 'var(--border)',
          accent: 'var(--accent)',
          'accent-foreground': 'var(--accent-foreground)',
          'code-bg': 'var(--code-background)',
          'sidebar-bg': 'var(--sidebar-background)',
          'card-bg': 'var(--card-background)'
        }
      }
    },
    corePlugins: {
      preflight: true
    }
  };

  const result = await postcss([
    tailwindcss(tailwindConfig)
  ]).process(tokensCss, { from: tokensPath });

  cachedCss = result.css;
  cachedClassSignature = classSignature;
  return cachedCss;
}

export function getCachedCss() {
  return cachedCss;
}
