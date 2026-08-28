import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { SSEBroadcaster } from './sse.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

export class DevServer {
  constructor(config, sseBroadcaster = null) {
    this.config = config;
    this.outDir = config.outDir;
    this.sse = sseBroadcaster || new SSEBroadcaster();
    this.server = null;
  }

  start(preferredPort = 3000, host = 'localhost') {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://${host}`);
        let pathname = decodeURIComponent(url.pathname);

        // SSE live reload endpoint
        if (pathname === '/__docboot_reload' || pathname === '/__euix_reload') {
          this.sse.addClient(req, res);
          return;
        }

        // Normalize path
        if (pathname === '/') {
          pathname = '/index.html';
        } else if (!path.extname(pathname)) {
          // If no extension, try directory index.html
          const dirIndex = path.join(this.outDir, pathname, 'index.html');
          if (fs.existsSync(dirIndex)) {
            pathname = path.join(pathname, 'index.html');
          } else {
            pathname = `${pathname}.html`;
          }
        }

        const filePath = path.join(this.outDir, pathname);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          fs.createReadStream(filePath).pipe(res);
        } else {
          // 404 fallback: serve custom 404.html if available
          const notFoundPath = path.join(this.outDir, '404.html');
          if (fs.existsSync(notFoundPath)) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            fs.createReadStream(notFoundPath).pipe(res);
          } else {
            const notFoundHtml = `<!DOCTYPE html><html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><h1>404 Not Found</h1><p>Page does not exist.</p><a href="/">Go to Docs Home</a></body></html>`;
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(notFoundHtml);
          }
        }
      });

      let currentPort = preferredPort;

      const tryListen = (port) => {
        this.server.removeAllListeners('error');
        this.server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            tryListen(port + 1);
          } else {
            reject(err);
          }
        });

        this.server.listen(port, host, () => {
          const url = `http://${host}:${port}`;
          resolve({ port, url });
        });
      };

      tryListen(currentPort);
    });
  }

  reload() {
    this.sse.reload();
  }

  close() {
    if (this.server) {
      this.server.close();
    }
  }
}
