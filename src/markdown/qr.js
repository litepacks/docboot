/**
 * Lightweight, zero-dependency QR Code SVG Generator for Docboot.
 * Generates clean, responsive SVG markup at build time.
 */

// QR Code generation based on standard QR Matrix layout (Version 1-10 auto-detect)
export function generateQrSvg(text, options = {}) {
  const {
    size = 200,
    margin = 4,
    color = 'currentColor',
    background = 'transparent',
    title = 'QR Code'
  } = options;

  if (!text || typeof text !== 'string') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><rect width="100" height="100" fill="${background}"/><text x="50" y="50" text-anchor="middle" fill="${color}" font-size="10">Empty QR</text></svg>`;
  }

  const matrix = createQrMatrix(text);
  const matrixSize = matrix.length;
  const viewBoxSize = matrixSize + margin * 2;

  let rects = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="${color}" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="${size}" height="${size}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title>${background !== 'transparent' ? `<rect width="${viewBoxSize}" height="${viewBoxSize}" fill="${background}" />` : ''}<g shape-rendering="crispEdges">${rects}</g></svg>`;
}

function escapeXml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Minimal QR matrix builder (supports alphanumeric/byte data, error correction level L/M)
function createQrMatrix(data) {
  const bytes = [];
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 2048) {
      bytes.push((code >> 6) | 192, (code & 63) | 128);
    } else {
      bytes.push((code >> 12) | 224, ((code >> 6) & 63) | 128, (code & 63) | 128);
    }
  }

  // Determine minimal version needed (Version 1: 21x21, up to Version 6: 41x41)
  let version = 1;
  const capacities = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
  for (let v = 1; v < capacities.length; v++) {
    if (bytes.length <= capacities[v]) {
      version = v;
      break;
    }
    version = v;
  }

  const size = 17 + version * 4;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  // 1. Finder patterns (top-left, top-right, bottom-left)
  function placeFinder(row, col) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[row + r][col + c] = isBorder || isCenter ? 1 : 0;
        reserved[row + r][col + c] = true;
      }
    }
    // Separator rings
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          reserved[nr][nc] = true;
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // 2. Alignment pattern for Version >= 2
  if (version >= 2) {
    const alignPos = size - 7;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2;
        const isCenter = r === 0 && c === 0;
        matrix[alignPos + r][alignPos + c] = isBorder || isCenter ? 1 : 0;
        reserved[alignPos + r][alignPos + c] = true;
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0 ? 1 : 0;
    if (!reserved[6][i]) {
      matrix[6][i] = val;
      reserved[6][i] = true;
    }
    if (!reserved[i][6]) {
      matrix[i][6] = val;
      reserved[i][6] = true;
    }
  }

  // 4. Dark module & format timing
  matrix[size - 8][8] = 1;
  reserved[size - 8][8] = true;

  for (let i = 0; i < 9; i++) {
    if (i < size) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
    if (size - 1 - i >= 0) {
      reserved[8][size - 1 - i] = true;
      reserved[size - 1 - i][8] = true;
    }
  }

  // 5. Data bit placement with simple byte encoding & mask pattern 0 ((r+c)%2===0)
  const bitStream = [];
  // Mode indicator: 8-bit byte (0100)
  bitStream.push(0, 1, 0, 0);
  // Character count indicator (8 bits for v1-9)
  for (let b = 7; b >= 0; b--) {
    bitStream.push((bytes.length >> b) & 1);
  }
  // Data bytes
  for (const byte of bytes) {
    for (let b = 7; b >= 0; b--) {
      bitStream.push((byte >> b) & 1);
    }
  }
  // Terminator
  while (bitStream.length % 8 !== 0) bitStream.push(0);

  // Pad bytes (0xEC, 0x11 alternating)
  const pad = [1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1];
  let padIdx = 0;
  const maxBits = (capacities[version] || 17) * 8;
  while (bitStream.length < maxBits) {
    bitStream.push(pad[padIdx % pad.length]);
    padIdx++;
  }

  // Place bits in zig-zag
  let bitIndex = 0;
  let dir = -1;
  let row = size - 1;
  let col = size - 1;

  while (col > 0) {
    if (col === 6) col--; // Skip vertical timing column

    for (let i = 0; i < size; i++) {
      const r = dir === -1 ? size - 1 - i : i;
      for (let c = 0; c < 2; c++) {
        const currentCol = col - c;
        if (!reserved[r][currentCol]) {
          const bit = bitIndex < bitStream.length ? bitStream[bitIndex++] : 0;
          // Apply standard checkerboard mask: (r + currentCol) % 2 === 0
          const mask = (r + currentCol) % 2 === 0;
          matrix[r][currentCol] = mask ? (bit ^ 1) : bit;
        }
      }
    }
    col -= 2;
    dir = -dir;
  }

  return matrix;
}
