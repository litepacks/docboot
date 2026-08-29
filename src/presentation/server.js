import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import openBrowser from 'open';
import pc from 'picocolors';
import { SSEBroadcaster } from '../server/sse.js';
import { compilePresentation } from './compiler.js';
import { renderPresentation } from './renderer.js';
import { compileCss } from '../theme/compiler.js';

/**
 * Starts a local dev presentation server with file watching and instant SSE live reload.
 *
 * @param {string} filePath Path to Markdown talk file
 * @param {object} options
 * @param {number} options.port Preferred port (default: 3000)
 * @param {string} options.host Host (default: localhost)
 * @param {boolean} options.open Whether to open browser automatically
 * @param {object} options.config Docboot config
 * @param {object} options.logger Logger instance
 * @returns {Promise<{ port: number, url: string, close: Function }>}
 */
export function startPresentationServer(filePath, options = {}) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Presentation file not found: ${filePath}`);
  }

  const preferredPort = options.port || 3000;
  const host = options.host || 'localhost';
  const logger = options.logger;
  const sse = new SSEBroadcaster();

  let cachedHtml = '';

  async function buildDeck() {
    const rawMarkdown = fs.readFileSync(resolvedPath, 'utf-8');
    const deck = compilePresentation(rawMarkdown, {
      config: options.config || {},
      base: '/',
      relativePath: path.relative(process.cwd(), resolvedPath)
    });

    const slideHtmls = deck.slides.map(s => s.html);
    const css = await compileCss(slideHtmls, { minify: false });
    cachedHtml = renderPresentation(deck, { css, base: '/' });
    return deck;
  }

  return new Promise(async (resolve, reject) => {
    let initialDeck;
    try {
      initialDeck = await buildDeck();
    } catch (err) {
      return reject(err);
    }

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${host}`);
      const pathname = decodeURIComponent(url.pathname);

      // SSE Live reload endpoint
      if (pathname === '/__docboot_reload' || pathname === '/__euix_reload') {
        sse.addClient(req, res);
        return;
      }

      // Serve Presentation HTML
      if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(cachedHtml);
        return;
      }

      // Fallback 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    let currentPort = preferredPort;

    const tryListen = (port) => {
      server.removeAllListeners('error');
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          tryListen(port + 1);
        } else {
          reject(err);
        }
      });

      server.listen(port, host, async () => {
        const url = `http://${host}:${port}`;

        // Watch file for changes
        const watcher = chokidar.watch(resolvedPath, {
          ignoreInitial: true,
          persistent: true,
          awaitWriteFinish: { stabilityThreshold: 40, pollInterval: 10 }
        });

        let isRebuilding = false;
        watcher.on('change', async () => {
          if (isRebuilding) return;
          isRebuilding = true;
          const startTime = performance.now();

          try {
            const updatedDeck = await buildDeck();
            const elapsed = Math.round(performance.now() - startTime);

            if (logger) {
              logger.log(
                pc.cyan('  ↻ ') +
                pc.dim('updated slides: ') + pc.bold(path.basename(resolvedPath)) +
                pc.dim(` (${updatedDeck.slideCount} slides)`) +
                pc.dim(` (${elapsed}ms)`)
              );
            }
            sse.reload();
          } catch (e) {
            if (logger) logger.error('Presentation rebuild error:', e);
          } finally {
            isRebuilding = false;
          }
        });

        if (options.open) {
          await openBrowser(url).catch(() => {});
        }

        resolve({
          port,
          url,
          slideCount: initialDeck.slideCount,
          title: initialDeck.title,
          close: () => {
            watcher.close();
            server.close();
          }
        });
      });
    };

    tryListen(currentPort);
  });
}
