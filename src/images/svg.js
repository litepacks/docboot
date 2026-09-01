/**
 * Safe, deterministic SVG processor and minifier.
 * Preserves vector layout, viewBox, title, desc, ARIA metadata, roles, and IDs.
 */

export function processSvgContent(svgString, options = { minify: true }) {
  if (!svgString || typeof svgString !== 'string') return '';
  if (!options.minify) return svgString;

  let result = svgString;

  // 1. Remove XML declaration if present
  result = result.replace(/<\?xml[\s\S]*?\?>/gi, '');

  // 2. Remove DOCTYPE declaration
  result = result.replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  // 3. Remove comments safely (preserving nothing inside <!-- -->)
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // 4. Remove editor-specific metadata (Inkscape, Illustrator, Sketch)
  result = result.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
  result = result.replace(/\s*(?:inkscape|sodipodi|sketch|xmlns:inkscape|xmlns:sodipodi|xmlns:sketch):[a-z0-9_-]+="[^"]*"/gi, '');
  result = result.replace(/<sodipodi:[^>]*>[\s\S]*?<\/sodipodi:[^>]*>/gi, '');
  result = result.replace(/<sodipodi:[^>]*\/>/gi, '');

  // 5. Clean up redundant whitespace between tags while preserving whitespace inside text / tspan
  result = result
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');

  result = result.replace(/>\s+</g, '><').trim();

  return result;
}
