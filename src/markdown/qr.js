/**
 * ISO/IEC 18004 Compliant QR Code SVG Generator for Docboot.
 * Fully self-contained, zero-dependency, build-time generator with
 * Galois Field GF(256) arithmetic, Reed-Solomon ECC, and BCH format info.
 */

// 1. Galois Field GF(256) with primitive polynomial 0x11D (x^8 + x^4 + x^3 + x^2 + 1)
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(function initGaloisField() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = val;
    EXP[i + 255] = val;
    LOG[val] = i;
    val = (val << 1) ^ (val & 0x80 ? 0x11d : 0);
  }
})();

function gmul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

// 2. Reed-Solomon Generator Polynomial
function rsGeneratorPoly(numEcc) {
  let poly = [1];
  for (let i = 0; i < numEcc; i++) {
    const factor = [1, EXP[i]];
    const newPoly = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      newPoly[j] ^= poly[j];
      newPoly[j + 1] ^= gmul(poly[j], factor[1]);
    }
    poly = newPoly;
  }
  return poly;
}

// 3. Reed-Solomon Division / Remainder
function rsEncode(data, numEcc) {
  const gen = rsGeneratorPoly(numEcc);
  const remainder = new Array(numEcc).fill(0);

  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let j = 0; j < numEcc; j++) {
        remainder[j] ^= gmul(gen[j + 1], factor);
      }
    }
  }
  return remainder;
}

// 4. ISO/IEC 18004 QR Specifications (Versions 1 to 10 for ECC Level M)
const QR_SPECS_M = [
  null,
  { version: 1, total: 26, data: 16, eccPerBlock: 10, g1Blocks: 1, g1Data: 16, g2Blocks: 0, g2Data: 0, align: [] },
  { version: 2, total: 44, data: 28, eccPerBlock: 16, g1Blocks: 1, g1Data: 28, g2Blocks: 0, g2Data: 0, align: [6, 18] },
  { version: 3, total: 70, data: 44, eccPerBlock: 26, g1Blocks: 1, g1Data: 44, g2Blocks: 0, g2Data: 0, align: [6, 22] },
  { version: 4, total: 100, data: 64, eccPerBlock: 18, g1Blocks: 2, g1Data: 32, g2Blocks: 0, g2Data: 0, align: [6, 26] },
  { version: 5, total: 134, data: 86, eccPerBlock: 24, g1Blocks: 2, g1Data: 43, g2Blocks: 0, g2Data: 0, align: [6, 30] },
  { version: 6, total: 172, data: 108, eccPerBlock: 16, g1Blocks: 4, g1Data: 27, g2Blocks: 0, g2Data: 0, align: [6, 34] },
  { version: 7, total: 196, data: 124, eccPerBlock: 18, g1Blocks: 4, g1Data: 31, g2Blocks: 0, g2Data: 0, align: [6, 22, 38] },
  { version: 8, total: 242, data: 154, eccPerBlock: 22, g1Blocks: 2, g1Data: 38, g2Blocks: 2, g2Data: 39, align: [6, 24, 42] },
  { version: 9, total: 292, data: 182, eccPerBlock: 22, g1Blocks: 3, g1Data: 36, g2Blocks: 2, g2Data: 37, align: [6, 26, 46] },
  { version: 10, total: 346, data: 216, eccPerBlock: 26, g1Blocks: 4, g1Data: 40, g2Blocks: 1, g2Data: 41, align: [6, 28, 50] }
];

// 5. BCH (15, 5) Code for Format Information with 0x5412 XOR Mask
function getFormatInfoBits(eccLevelBits, maskPattern) {
  const data = (eccLevelBits << 3) | maskPattern; // 5 bits
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= (0x537 << (i - 10));
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function encodeUtf8(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push((code >> 6) | 0xc0, (code & 0x3f) | 0x80);
    } else if (code < 0x10000) {
      bytes.push((code >> 12) | 0xe0, ((code >> 6) & 0x3f) | 0x80, (code & 0x3f) | 0x80);
    } else {
      bytes.push((code >> 18) | 0xf0, ((code >> 12) & 0x3f) | 0x80, ((code >> 6) & 0x3f) | 0x80, (code & 0x3f) | 0x80);
    }
  }
  return bytes;
}

function createQrMatrix(text) {
  const dataBytes = encodeUtf8(text);

  // Determine minimal version needed
  let spec = null;
  for (let v = 1; v <= 10; v++) {
    const s = QR_SPECS_M[v];
    const countBits = v < 10 ? 8 : 16;
    const totalDataBits = 4 + countBits + dataBytes.length * 8;
    const requiredDataBytes = Math.ceil(totalDataBits / 8);
    if (requiredDataBytes <= s.data) {
      spec = s;
      break;
    }
  }

  if (!spec) {
    spec = QR_SPECS_M[10];
  }

  const version = spec.version;
  const countBits = version < 10 ? 8 : 16;

  // 1. Bitstream Generation
  const bitStream = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bitStream.push((val >> i) & 1);
    }
  }

  // Byte mode: 0100
  pushBits(0b0100, 4);
  // Character count indicator
  pushBits(dataBytes.length, countBits);
  // Data payload
  for (const b of dataBytes) {
    pushBits(b, 8);
  }
  // Terminator
  const maxBits = spec.data * 8;
  const termLen = Math.min(4, maxBits - bitStream.length);
  for (let i = 0; i < termLen; i++) bitStream.push(0);

  // Byte alignment padding
  while (bitStream.length % 8 !== 0 && bitStream.length < maxBits) {
    bitStream.push(0);
  }

  // Convert bits to byte codewords
  const codewords = [];
  for (let i = 0; i < bitStream.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (bitStream[i + j] || 0);
    }
    codewords.push(byte);
  }

  // Standard pad bytes (0xEC, 0x11 alternating)
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (codewords.length < spec.data) {
    codewords.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // 2. Block Division and Reed-Solomon ECC Calculation
  const blocks = [];
  let offset = 0;
  for (let i = 0; i < spec.g1Blocks; i++) {
    const blockData = codewords.slice(offset, offset + spec.g1Data);
    offset += spec.g1Data;
    const blockEcc = rsEncode(blockData, spec.eccPerBlock);
    blocks.push({ data: blockData, ecc: blockEcc });
  }
  for (let i = 0; i < spec.g2Blocks; i++) {
    const blockData = codewords.slice(offset, offset + spec.g2Data);
    offset += spec.g2Data;
    const blockEcc = rsEncode(blockData, spec.eccPerBlock);
    blocks.push({ data: blockData, ecc: blockEcc });
  }

  // 3. Interleaving data and ECC codewords
  const finalCodewords = [];
  const maxDataLen = Math.max(spec.g1Data, spec.g2Data);
  for (let i = 0; i < maxDataLen; i++) {
    for (const b of blocks) {
      if (i < b.data.length) finalCodewords.push(b.data[i]);
    }
  }
  for (let i = 0; i < spec.eccPerBlock; i++) {
    for (const b of blocks) {
      finalCodewords.push(b.ecc[i]);
    }
  }

  // 4. Matrix Initialization & Function Patterns
  const size = 17 + version * 4;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  function setModule(r, c, val, isReserved = true) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val ? 1 : 0;
      if (isReserved) reserved[r][c] = true;
    }
  }

  // Place 7x7 Finder Patterns and 1-module white separators
  function placeFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
            const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            setModule(nr, nc, isBorder || isCenter ? 1 : 0);
          } else {
            setModule(nr, nc, 0);
          }
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment Patterns (Version >= 2)
  if (spec.align.length > 0) {
    const coords = spec.align;
    for (let i = 0; i < coords.length; i++) {
      for (let j = 0; j < coords.length; j++) {
        const ar = coords[i];
        const ac = coords[j];
        // Skip finder regions
        if ((ar <= 8 && ac <= 8) || (ar <= 8 && ac >= size - 8) || (ar >= size - 8 && ac <= 8)) {
          continue;
        }
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2;
            const isCenter = r === 0 && c === 0;
            setModule(ar + r, ac + c, isBorder || isCenter ? 1 : 0);
          }
        }
      }
    }
  }

  // Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setModule(6, i, i % 2 === 0 ? 1 : 0);
    if (!reserved[i][6]) setModule(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Dark Module
  setModule(size - 8, 8, 1);

  // Reserve Format Information areas
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      if (i < size) { reserved[8][i] = true; reserved[i][8] = true; }
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  // 5. Place Data Bits in Zig-Zag Order
  const finalBits = [];
  for (const byte of finalCodewords) {
    for (let b = 7; b >= 0; b--) {
      finalBits.push((byte >> b) & 1);
    }
  }

  let bitIdx = 0;
  let dir = -1;
  let col = size - 1;

  while (col > 0) {
    if (col === 6) col--; // Skip timing column 6
    for (let i = 0; i < size; i++) {
      const r = dir === -1 ? size - 1 - i : i;
      for (let c = 0; c < 2; c++) {
        const curCol = col - c;
        if (!reserved[r][curCol]) {
          matrix[r][curCol] = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
        }
      }
    }
    col -= 2;
    dir = -dir;
  }

  // 6. Apply Standard Mask Pattern (Mask 0: (r + c) % 2 === 0)
  const bestMask = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        if ((r + c) % 2 === 0) {
          matrix[r][c] ^= 1;
        }
      }
    }
  }

  // 7. Write Format Information (ECC Level M = 00)
  const formatInfo = getFormatInfoBits(0b00, bestMask);
  const formatBits = [];
  for (let i = 0; i < 15; i++) {
    formatBits.push((formatInfo >> i) & 1);
  }

  // Top-left: bits 0-5 along col 8, bits 6-8 around corner, bits 9-14 along row 8
  matrix[8][0] = formatBits[0];
  matrix[8][1] = formatBits[1];
  matrix[8][2] = formatBits[2];
  matrix[8][3] = formatBits[3];
  matrix[8][4] = formatBits[4];
  matrix[8][5] = formatBits[5];
  matrix[8][7] = formatBits[6];
  matrix[8][8] = formatBits[7];
  matrix[7][8] = formatBits[8];
  matrix[5][8] = formatBits[9];
  matrix[4][8] = formatBits[10];
  matrix[3][8] = formatBits[11];
  matrix[2][8] = formatBits[12];
  matrix[1][8] = formatBits[13];
  matrix[0][8] = formatBits[14];

  // Top-right and Bottom-left split
  for (let i = 0; i < 8; i++) {
    matrix[8][size - 1 - i] = formatBits[i];
  }
  for (let i = 0; i < 7; i++) {
    matrix[size - 7 + i][8] = formatBits[8 + i];
  }

  return matrix;
}

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
