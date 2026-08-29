import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedClientJs = null;
let cachedClientMtime = null;

/**
 * Compiles and minifies client runtime JavaScript (docs.js).
 * @param {object} options
 * @param {boolean} options.minify Whether to minify JavaScript (default: true)
 * @returns {Promise<string>} Compiled and minified JS code
 */
export async function compileClientJs(options = {}) {
  const isMinify = options.minify !== false;
  const clientJsPath = path.join(__dirname, 'client.js');

  if (!fs.existsSync(clientJsPath)) return '';

  const stat = fs.statSync(clientJsPath);
  const mtime = stat.mtimeMs;

  if (cachedClientJs && cachedClientMtime === mtime && isMinify) {
    return cachedClientJs;
  }

  const rawJs = fs.readFileSync(clientJsPath, 'utf-8');

  if (!isMinify) {
    return rawJs;
  }

  try {
    const minified = await minify(rawJs, {
      compress: {
        drop_console: false,
        passes: 2
      },
      mangle: true,
      format: {
        comments: false
      }
    });

    cachedClientJs = minified.code || rawJs;
    cachedClientMtime = mtime;
    return cachedClientJs;
  } catch (err) {
    // Fallback to unminified if terser errors
    return rawJs;
  }
}
