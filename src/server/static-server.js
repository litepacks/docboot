import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

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

export class StaticServer {
  constructor(distDir) {
    this.distDir = distDir;
    this.server = null;
  }

  start(preferredPort = 3000, host = 'localhost') {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://${host}`);
        let pathname = decodeURIComponent(url.pathname);

        if (pathname === '/') {
          pathname = '/index.html';
        } else if (!path.extname(pathname)) {
          const dirIndex = path.join(this.distDir, pathname, 'index.html');
          if (fs.existsSync(dirIndex)) {
            pathname = path.join(pathname, 'index.html');
          } else {
            pathname = `${pathname}.html`;
          }
        }

        const filePath = path.join(this.distDir, pathname);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          fs.createReadStream(filePath).pipe(res);
        } else {
          const notFoundPath = path.join(this.distDir, '404.html');
          if (fs.existsSync(notFoundPath)) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            fs.createReadStream(notFoundPath).pipe(res);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<!DOCTYPE html><html><body><h1>404 Not Found</h1></body></html>');
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

  close() {
    if (this.server) {
      this.server.close();
    }
  }
}
