import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { inspectBuffer, inspectImageFile } from '../src/images/inspect.js';
import { processSvgContent } from '../src/images/svg.js';
import { renderPicture, wrapFigure } from '../src/images/renderer.js';
import { ImageProcessor, computeTargetWidths } from '../src/images/processor.js';
import { parseMarkdown } from '../src/markdown/parser.js';
import { processDirectives } from '../src/markdown/directives.js';
import { Doctor } from '../src/doctor/index.js';
import { StatsCollector } from '../src/stats/index.js';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures');

// Setup fixture files
async function setupFixtures() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  // 1. 1200x800 test PNG
  const samplePngPath = path.join(FIXTURES_DIR, 'sample.png');
  if (!fs.existsSync(samplePngPath)) {
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 4,
        background: { r: 56, g: 189, b: 248, alpha: 1 }
      }
    }).png().toFile(samplePngPath);
  }

  // 2. 800x600 test JPEG
  const sampleJpgPath = path.join(FIXTURES_DIR, 'sample.jpg');
  if (!fs.existsSync(sampleJpgPath)) {
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 30, g: 41, b: 59 }
      }
    }).jpeg().toFile(sampleJpgPath);
  }

  // 3. 300x200 small test PNG (smaller than default breakpoints)
  const smallPngPath = path.join(FIXTURES_DIR, 'small.png');
  if (!fs.existsSync(smallPngPath)) {
    await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 4,
        background: { r: 244, g: 63, b: 94, alpha: 1 }
      }
    }).png().toFile(smallPngPath);
  }

  // 4. Test SVG with metadata & comments
  const sampleSvgPath = path.join(FIXTURES_DIR, 'sample.svg');
  if (!fs.existsSync(sampleSvgPath)) {
    const rawSvg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 500 300" width="500" height="300" aria-label="Vector Diagram">
  <metadata><inkscape:metadata id="meta1">Editor Data</inkscape:metadata></metadata>
  <title>System Diagram</title>
  <desc>System architecture flow</desc>
  <rect width="500" height="300" fill="#090d16" rx="16" />
  <circle cx="250" cy="150" r="80" fill="#38bdf8" />
</svg>`;
    fs.writeFileSync(sampleSvgPath, rawSvg, 'utf-8');
  }
}

test('Image inspectBuffer parses binary headers accurately', async () => {
  await setupFixtures();

  // PNG
  const pngBuffer = fs.readFileSync(path.join(FIXTURES_DIR, 'sample.png'));
  const pngMeta = inspectBuffer(pngBuffer);
  assert.strictEqual(pngMeta.format, 'png');
  assert.strictEqual(pngMeta.width, 1200);
  assert.strictEqual(pngMeta.height, 800);
  assert.strictEqual(pngMeta.hasAlpha, true);
  assert.strictEqual(pngMeta.isAnimated, false);

  // JPEG
  const jpgBuffer = fs.readFileSync(path.join(FIXTURES_DIR, 'sample.jpg'));
  const jpgMeta = inspectBuffer(jpgBuffer);
  assert.strictEqual(jpgMeta.format, 'jpeg');
  assert.strictEqual(jpgMeta.width, 800);
  assert.strictEqual(jpgMeta.height, 600);
  assert.strictEqual(jpgMeta.isAnimated, false);

  // SVG
  const svgBuffer = fs.readFileSync(path.join(FIXTURES_DIR, 'sample.svg'));
  const svgMeta = inspectBuffer(svgBuffer);
  assert.strictEqual(svgMeta.format, 'svg');
  assert.strictEqual(svgMeta.width, 500);
  assert.strictEqual(svgMeta.height, 300);

  // Unknown / Corrupted
  const invalidMeta = inspectBuffer(Buffer.from('not an image'));
  assert.strictEqual(invalidMeta.format, 'unknown');
  assert.strictEqual(invalidMeta.width, null);
});

test('Image SVG safe minification preserves accessibility and vector tags', async () => {
  await setupFixtures();
  const rawSvg = fs.readFileSync(path.join(FIXTURES_DIR, 'sample.svg'), 'utf-8');
  const minified = processSvgContent(rawSvg, { minify: true });

  // XML declaration, DOCTYPE and comments stripped
  assert.doesNotMatch(minified, /<\?xml/);
  assert.doesNotMatch(minified, /<!--/);
  assert.doesNotMatch(minified, /inkscape:metadata/);

  // Accessibility and vector geometry preserved
  assert.match(minified, /viewBox="0 0 500 300"/);
  assert.match(minified, /aria-label="Vector Diagram"/);
  assert.match(minified, /<title>System Diagram<\/title>/);
  assert.match(minified, /<desc>System architecture flow<\/desc>/);
  assert.match(minified, /<circle cx="250" cy="150" r="80"/);
});

test('computeTargetWidths strictly obeys no-upscaling rule', () => {
  // 1. Source 900px wide with default [480, 768, 1280, 1920]
  const widths900 = computeTargetWidths(900, [480, 768, 1280, 1920]);
  assert.deepStrictEqual(widths900, [480, 768, 900]);
  assert.strictEqual(widths900.includes(1280), false);
  assert.strictEqual(widths900.includes(1920), false);

  // 2. Small source 300px wide
  const widths300 = computeTargetWidths(300, [480, 768, 1280, 1920]);
  assert.deepStrictEqual(widths300, [300]);

  // 3. Large source 2560px wide
  const widths2560 = computeTargetWidths(2560, [480, 768, 1280, 1920]);
  assert.deepStrictEqual(widths2560, [480, 768, 1280, 1920, 2560]);
});

test('renderPicture produces semantic <picture> with modern formats, dimensions, and base path', () => {
  const imageRecord = {
    src: '/assets/images/dashboard.a1b2c3.768.webp',
    displaySrc: '/assets/images/dashboard.a1b2c3.768.webp',
    lightboxSrc: '/assets/images/dashboard.a1b2c3.1200.webp',
    width: 1200,
    height: 800,
    format: 'png',
    variants: [
      { width: 480, height: 320, format: 'avif', url: '/assets/images/dashboard.a1b2c3.480.avif' },
      { width: 768, height: 512, format: 'avif', url: '/assets/images/dashboard.a1b2c3.768.avif' },
      { width: 1200, height: 800, format: 'avif', url: '/assets/images/dashboard.a1b2c3.1200.avif' },
      { width: 480, height: 320, format: 'webp', url: '/assets/images/dashboard.a1b2c3.480.webp' },
      { width: 768, height: 512, format: 'webp', url: '/assets/images/dashboard.a1b2c3.768.webp' },
      { width: 1200, height: 800, format: 'webp', url: '/assets/images/dashboard.a1b2c3.1200.webp' }
    ],
    optimize: true
  };

  const html = renderPicture(imageRecord, {
    alt: 'Analytics Dashboard',
    title: 'Overview Metrics',
    caption: 'Overview Metrics',
    base: '/docboot/',
    lightbox: true
  });

  assert.match(html, /<picture>/);
  assert.match(html, /<source type="image\/avif"/);
  assert.match(html, /<source type="image\/webp"/);
  assert.match(html, /srcset="\/docboot\/assets\/images\/dashboard\.a1b2c3\.480\.avif 480w, \/docboot\/assets\/images\/dashboard\.a1b2c3\.768\.avif 768w, \/docboot\/assets\/images\/dashboard\.a1b2c3\.1200\.avif 1200w"/);
  assert.match(html, /srcset="\/docboot\/assets\/images\/dashboard\.a1b2c3\.480\.webp 480w, \/docboot\/assets\/images\/dashboard\.a1b2c3\.768\.webp 768w, \/docboot\/assets\/images\/dashboard\.a1b2c3\.1200\.webp 1200w"/);
  assert.match(html, /<img src="\/docboot\/assets\/images\/dashboard\.a1b2c3\.768\.webp"/);
  assert.match(html, /width="1200"/);
  assert.match(html, /height="800"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
  assert.match(html, /alt="Analytics Dashboard"/);
  assert.match(html, /data-docboot-lightbox="true"/);
  assert.match(html, /data-lightbox-src="\/docboot\/assets\/images\/dashboard\.a1b2c3\.1200\.webp"/);
});

test('renderPicture supports loading eager and high fetch priority for hero images', () => {
  const imageRecord = {
    src: '/assets/images/hero.a1b2c3.768.webp',
    width: 1200,
    height: 600,
    format: 'png',
    variants: [
      { width: 768, height: 384, format: 'webp', url: '/assets/images/hero.a1b2c3.768.webp' }
    ],
    optimize: true
  };

  const html = renderPicture(imageRecord, {
    alt: 'Hero Banner',
    loading: 'eager',
    base: '/'
  });

  assert.match(html, /loading="eager"/);
  assert.match(html, /fetchpriority="high"/);
});

test('renderPicture preserves decorative empty alt="" attributes', () => {
  const imageRecord = {
    src: '/assets/images/sep.svg',
    width: 600,
    height: 20,
    format: 'svg',
    variants: [],
    optimize: false
  };

  const html = renderPicture(imageRecord, {
    alt: '',
    base: '/'
  });

  assert.match(html, /alt=""/);
});

test('ImageProcessor generates AVIF and WebP variants and reuses cache', async () => {
  await setupFixtures();
  const testOutDir = path.resolve(process.cwd(), 'scratch/test-dist-images');
  const testCacheDir = path.resolve(process.cwd(), 'scratch/test-cache-images');
  fs.mkdirSync(testOutDir, { recursive: true });
  fs.mkdirSync(testCacheDir, { recursive: true });

  const processor = new ImageProcessor({
    rootDir: process.cwd(),
    docsDir: FIXTURES_DIR,
    outDir: testOutDir,
    cacheDir: testCacheDir,
    images: {
      optimize: true,
      formats: ['avif', 'webp'],
      widths: [480, 768, 1200],
      quality: 82
    }
  });

  // 1. Cold build processing
  const record = await processor.process('sample.png');
  assert.strictEqual(record.optimize, true);
  assert.strictEqual(record.width, 1200);
  assert.strictEqual(record.height, 800);
  assert.strictEqual(record.variants.length > 0, true);

  const avifVariants = record.variants.filter(v => v.format === 'avif');
  const webpVariants = record.variants.filter(v => v.format === 'webp');
  assert.strictEqual(avifVariants.length >= 3, true);
  assert.strictEqual(webpVariants.length >= 3, true);

  // Verify variant files actually written to disk
  for (const v of record.variants) {
    const relFile = v.url.replace(/^\/+/, '');
    const fullOutPath = path.join(testOutDir, relFile);
    assert.strictEqual(fs.existsSync(fullOutPath), true);
  }

  // 2. Warm cached build
  const statsBefore = processor.getStats();
  const cachedRecord = await processor.process('sample.png');
  assert.strictEqual(cachedRecord.src, record.src);
  const statsAfter = processor.getStats();
  assert.strictEqual(statsAfter.cachedHits > 0, true);

  // Clean up scratch dirs
  try {
    fs.rmSync(testOutDir, { recursive: true, force: true });
    fs.rmSync(testCacheDir, { recursive: true, force: true });
  } catch (_) {}
});

test('parseMarkdown renders responsive <picture> for local image and preserves lightbox zoom', async () => {
  await setupFixtures();
  const samplePngRel = path.relative(process.cwd(), path.join(FIXTURES_DIR, 'sample.png'));

  const md = `![Dashboard Overview](${samplePngRel} "Main Dashboard")`;
  const result = parseMarkdown(md, {
    config: {
      rootDir: process.cwd(),
      docsDir: FIXTURES_DIR,
      images: { optimize: true }
    }
  });

  assert.match(result.html, /<picture>/);
  assert.match(result.html, /<source type="image\/avif"/);
  assert.match(result.html, /<source type="image\/webp"/);
  assert.match(result.html, /alt="Dashboard Overview"/);
  assert.match(result.html, /<figcaption[^>]*>Main Dashboard<\/figcaption>/);
  assert.match(result.html, /data-docboot-lightbox="true"/);
});

test('processDirectives handles :::image directive with custom width and eager loading', async () => {
  await setupFixtures();
  const samplePngRel = path.relative(process.cwd(), path.join(FIXTURES_DIR, 'sample.png'));

  const md = `:::image
src: ${samplePngRel}
alt: Hero Screenshot
caption: Application home
loading: eager
width: 600
:::`;

  const html = processDirectives(md, {
    rootDir: process.cwd(),
    docsDir: FIXTURES_DIR,
    images: { optimize: true }
  });

  assert.match(html, /<figure class="docboot-figure/);
  assert.match(html, /loading="eager"/);
  assert.match(html, /fetchpriority="high"/);
  assert.match(html, /alt="Hero Screenshot"/);
  assert.match(html, /Application home/);
});

test('processDirectives handles :::image optimize: false for passthrough', async () => {
  await setupFixtures();
  const samplePngRel = path.relative(process.cwd(), path.join(FIXTURES_DIR, 'sample.png'));

  const md = `:::image
src: ${samplePngRel}
alt: Pixel Icon
optimize: false
:::`;

  const html = processDirectives(md, {
    rootDir: process.cwd(),
    docsDir: FIXTURES_DIR,
    images: { optimize: true }
  });

  assert.match(html, /<img\b/);
  assert.doesNotMatch(html, /<picture>/);
  assert.match(html, /alt="Pixel Icon"/);
});

test('Doctor validates images and passes when references exist', async () => {
  await setupFixtures();
  const samplePngRel = path.relative(process.cwd(), path.join(FIXTURES_DIR, 'sample.png'));

  const testDocsDir = path.resolve(process.cwd(), 'scratch/test-doctor-docs');
  fs.mkdirSync(testDocsDir, { recursive: true });
  fs.writeFileSync(path.join(testDocsDir, 'README.md'), `# Home\n\n![Sample](${path.resolve(FIXTURES_DIR, 'sample.png')})\n`, 'utf-8');

  const doctor = new Doctor({
    rootDir: process.cwd(),
    docsDir: testDocsDir,
    cacheDir: path.resolve(process.cwd(), 'scratch/test-doctor-cache')
  });

  const result = await doctor.diagnose();
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.totalImages >= 1, true);

  // Clean up
  try {
    fs.rmSync(testDocsDir, { recursive: true, force: true });
    fs.rmSync(path.resolve(process.cwd(), 'scratch/test-doctor-cache'), { recursive: true, force: true });
  } catch (_) {}
});
