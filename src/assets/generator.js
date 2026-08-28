import fs from 'node:fs';
import path from 'node:path';

export class AssetGenerator {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  async generate(type = 'assets') {
    const publicDir = path.join(this.config.rootDir, 'public');
    fs.mkdirSync(publicDir, { recursive: true });

    const title = this.config.title || 'Documentation';
    const initial = title.charAt(0).toUpperCase() || 'D';
    const description = this.config.description || 'Modern documentation website';

    const generatedFiles = [];

    // 1. Favicon SVG
    if (type === 'assets' || type === 'favicon') {
      const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)" />
  <text x="64" y="82" font-size="64" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fill="#ffffff" text-anchor="middle">${initial}</text>
</svg>`;

      const faviconPath = path.join(publicDir, 'favicon.svg');
      fs.writeFileSync(faviconPath, faviconSvg, 'utf-8');
      generatedFiles.push('public/favicon.svg');
    }

    // 2. Open Graph Banner SVG
    if (type === 'assets' || type === 'og') {
      const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#111827" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#818cf8" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <circle cx="950" cy="180" r="300" fill="#38bdf8" opacity="0.08" filter="blur(80px)" />
  <circle cx="250" cy="500" r="250" fill="#818cf8" opacity="0.08" filter="blur(80px)" />
  
  <g transform="translate(100, 160)">
    <rect width="72" height="72" rx="18" fill="url(#accent)" />
    <text x="36" y="48" font-size="36" font-weight="bold" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="#ffffff" text-anchor="middle">▲</text>
    
    <text x="0" y="150" font-size="64" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="#f8fafc" letter-spacing="-1">${escapeXml(title)}</text>
    <text x="0" y="210" font-size="28" font-weight="400" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="#94a3b8">${escapeXml(description)}</text>
    
    <rect x="0" y="270" width="160" height="36" rx="18" fill="#1e293b" />
    <text x="80" y="294" font-size="14" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="#38bdf8" text-anchor="middle">DOCUMENTATION</text>
  </g>
</svg>`;

      const ogPath = path.join(publicDir, 'og-image.svg');
      fs.writeFileSync(ogPath, ogSvg, 'utf-8');
      generatedFiles.push('public/og-image.svg');
    }

    // 3. PWA Web Manifest & Service Worker
    if (type === 'assets' || type === 'pwa') {
      const manifest = {
        name: title,
        short_name: title,
        description: description,
        start_url: '/',
        display: 'standalone',
        background_color: '#090d16',
        theme_color: '#38bdf8',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      };

      const manifestPath = path.join(publicDir, 'manifest.webmanifest');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
      generatedFiles.push('public/manifest.webmanifest');

      const swContent = `// Docboot Stale-While-Revalidate Service Worker
const CACHE_NAME = 'docboot-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/assets/docs.css',
  '/assets/client.js',
  '/assets/search-runtime.js',
  '/favicon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
`.trim();

      const swPath = path.join(publicDir, 'sw.js');
      fs.writeFileSync(swPath, swContent, 'utf-8');
      generatedFiles.push('public/sw.js');
    }

    return generatedFiles;
  }
}

function escapeXml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
