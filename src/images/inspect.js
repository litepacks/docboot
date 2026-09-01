import fs from 'node:fs';
import path from 'node:path';

/**
 * Pure JavaScript fast binary header inspector for image formats and dimensions.
 * Avoids native overhead for metadata-only inspection while supporting Sharp fallback.
 */

export function inspectBuffer(buffer) {
  if (!buffer || buffer.length < 8) {
    return { format: 'unknown', width: null, height: null, isAnimated: false, hasAlpha: false };
  }

  // 1. PNG inspection
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      const colorType = buffer.length > 25 ? buffer[25] : 0;
      const hasAlpha = colorType === 4 || colorType === 6;
      const isAnimated = buffer.includes(Buffer.from('acTL'));
      return { format: 'png', width, height, isAnimated, hasAlpha };
    }
    return { format: 'png', width: null, height: null, isAnimated: false, hasAlpha: false };
  }

  // 2. GIF inspection
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    // Scan for multiple image frames to detect animated GIF
    let frameCount = 0;
    for (let i = 10; i < buffer.length - 1; i++) {
      if (buffer[i] === 0x00 && buffer[i + 1] === 0x21 && buffer[i + 2] === 0xf9) {
        frameCount++;
        if (frameCount > 1) break;
      } else if (buffer[i] === 0x2c) {
        frameCount++;
        if (frameCount > 1) break;
      }
    }
    return { format: 'gif', width, height, isAnimated: frameCount > 1, hasAlpha: true };
  }

  // 3. JPEG inspection
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // Standalone markers without length
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const length = buffer.readUInt16BE(offset + 2);
      // SOF markers: SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2), SOF3 (0xC3), SOF5-SOF7, SOF9-SOF11, SOF13-SOF15
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);

      if (isSof && offset + 8 < buffer.length) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { format: 'jpeg', width, height, isAnimated: false, hasAlpha: false };
      }
      offset += 2 + length;
    }
    return { format: 'jpeg', width: null, height: null, isAnimated: false, hasAlpha: false };
  }

  // 4. WebP inspection
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length >= 30 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    const chunkType = buffer.toString('ascii', 12, 16);
    if (chunkType === 'VP8 ' && buffer.length >= 30) {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { format: 'webp', width, height, isAnimated: false, hasAlpha: false };
    }
    if (chunkType === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      const width = 1 + (b0 | ((b1 & 0x3f) << 8));
      const height = 1 + (((b1 & 0xc0) >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10));
      return { format: 'webp', width, height, isAnimated: false, hasAlpha: true };
    }
    if (chunkType === 'VP8X' && buffer.length >= 30) {
      const flags = buffer[20];
      const isAnimated = (flags & 0x02) !== 0;
      const hasAlpha = (flags & 0x10) !== 0;
      const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      return { format: 'webp', width, height, isAnimated, hasAlpha };
    }
    return { format: 'webp', width: null, height: null, isAnimated: false, hasAlpha: false };
  }

  // 5. SVG inspection
  const headStr = buffer.slice(0, Math.min(buffer.length, 4096)).toString('utf-8').trim();
  if (headStr.includes('<svg') || headStr.startsWith('<?xml') || headStr.includes('xmlns="http://www.w3.org/2000/svg"')) {
    const fullText = buffer.toString('utf-8');
    const svgTagMatch = fullText.match(/<svg\b([^>]*)>/i);
    if (svgTagMatch) {
      const attrs = svgTagMatch[1];
      let width = null;
      let height = null;

      const viewBoxMatch = attrs.match(/viewBox=["']\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*["']/i);
      if (viewBoxMatch) {
        width = Math.round(parseFloat(viewBoxMatch[3]));
        height = Math.round(parseFloat(viewBoxMatch[4]));
      }

      const widthMatch = attrs.match(/\bwidth=["']([0-9.]+)(?:px)?["']/i);
      const heightMatch = attrs.match(/\bheight=["']([0-9.]+)(?:px)?["']/i);
      if (widthMatch) width = Math.round(parseFloat(widthMatch[1]));
      if (heightMatch) height = Math.round(parseFloat(heightMatch[1]));

      return { format: 'svg', width, height, isAnimated: false, hasAlpha: true };
    }
    return { format: 'svg', width: null, height: null, isAnimated: false, hasAlpha: true };
  }

  // 6. AVIF inspection (ISO BMFF with ftyp = avif / avis)
  if (buffer.length >= 16 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis' || buffer.slice(8, 32).toString('ascii').includes('avif')) {
      return { format: 'avif', width: null, height: null, isAnimated: brand === 'avis', hasAlpha: true };
    }
  }

  return { format: 'unknown', width: null, height: null, isAnimated: false, hasAlpha: false };
}

/**
 * Inspects a file on disk. Combines fast pure-JS inspection with Sharp fallback for deep metadata.
 * @param {string} filePath Absolute or relative path to image file
 * @returns {Promise<{ format: string, width: number|null, height: number|null, isAnimated: boolean, hasAlpha: boolean, size: number, exists: boolean }>}
 */
export async function inspectImageFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { format: 'unknown', width: null, height: null, isAnimated: false, hasAlpha: false, size: 0, exists: false };
  }

  const stat = await fs.promises.stat(filePath);
  const buffer = await fs.promises.readFile(filePath);
  const metadata = inspectBuffer(buffer);

  // If width/height could not be determined by header parser and format is not SVG, try Sharp
  if ((metadata.width === null || metadata.height === null) && metadata.format !== 'svg') {
    try {
      const sharpModule = await import('sharp').catch(() => null);
      const sharp = sharpModule?.default || sharpModule;
      if (sharp) {
        const sharpMeta = await sharp(buffer).metadata();
        if (sharpMeta) {
          metadata.width = sharpMeta.width || metadata.width;
          metadata.height = sharpMeta.height || metadata.height;
          metadata.format = sharpMeta.format || metadata.format;
          metadata.hasAlpha = sharpMeta.hasAlpha || metadata.hasAlpha;
          metadata.isAnimated = Boolean(sharpMeta.pages && sharpMeta.pages > 1) || metadata.isAnimated;
        }
      }
    } catch (_) {}
  }

  return {
    ...metadata,
    size: stat.size,
    exists: true
  };
}
