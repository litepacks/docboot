import fs from 'node:fs';
import path from 'node:path';
import { compilePresentation } from './compiler.js';
import { renderPresentation } from './renderer.js';
import { compileCss } from '../theme/compiler.js';

/**
 * Builds a static presentation output bundle ready for deployment.
 *
 * @param {string} filePath Absolute or relative path to Markdown presentation file
 * @param {object} options
 * @param {object} options.config Docboot config
 * @param {string} options.out Target output directory (default: dist-presentation)
 * @param {string} options.base Base path
 * @returns {Promise<{ outDir: string, slideCount: number, title: string }>}
 */
export async function buildPresentationStatic(filePath, options = {}) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Presentation file not found: ${filePath}`);
  }

  const rawMarkdown = fs.readFileSync(resolvedPath, 'utf-8');
  const config = options.config || {};
  const base = options.base || config.base || '/';
  const outDir = path.resolve(process.cwd(), options.out || 'dist-presentation');

  // 1. Compile Presentation Deck
  const deck = compilePresentation(rawMarkdown, {
    config,
    base,
    relativePath: path.relative(process.cwd(), resolvedPath)
  });

  // 2. Compile CSS tokens
  const slideHtmls = deck.slides.map(s => s.html);
  const css = await compileCss(slideHtmls, { minify: true });

  // 3. Render HTML document
  const html = renderPresentation(deck, { css, base });

  // 4. Write static files to output directory
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf-8');

  // 5. Copy any referenced public assets or favicons if present
  const publicDir = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    try {
      fs.cpSync(publicDir, outDir, { recursive: true, force: false });
    } catch {}
  }

  return {
    outDir,
    slideCount: deck.slideCount,
    title: deck.title
  };
}
