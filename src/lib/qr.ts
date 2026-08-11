// ============================================================================
// Minimal QR kodlayıcı — byte modu, ECC seviyesi L, sürüm 1-6.
// Harici bağımlılık yok; davet linkleri (~130 karaktere kadar) için yeterli.
// ============================================================================

const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172];
const ECC_PER_BLOCK = [0, 7, 10, 15, 20, 26, 18];
const BLOCKS = [0, 1, 1, 1, 1, 1, 2];
/** Sürüm 2-6 için ikinci hizalama deseni koordinatı (ilki daima 6). */
const ALIGN_POS = [0, 0, 18, 22, 26, 30, 34];
const MAX_VERSION = 6;

const dataCodewords = (v: number) => TOTAL_CODEWORDS[v] - ECC_PER_BLOCK[v] * BLOCKS[v];
const getBit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

// --- Galois alanı (GF(256), primitif polinom 0x11D) -------------------------
function gfMul(a: number, b: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((b >>> i) & 1) * a;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < divisor.length; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

// --- Bit tamponu ------------------------------------------------------------
class Bits {
  readonly arr: number[] = [];
  push(value: number, len: number) {
    for (let i = len - 1; i >= 0; i--) this.arr.push((value >>> i) & 1);
  }
}

/**
 * Metni QR modül matrisine çevirir.
 * @returns `matrix[y][x] === true` ise koyu modül.
 */
export function qrMatrix(text: string): boolean[][] {
  const data = Array.from(new TextEncoder().encode(text));

  let version = 0;
  for (let v = 1; v <= MAX_VERSION; v++) {
    if (data.length <= Math.floor((dataCodewords(v) * 8 - 12) / 8)) { version = v; break; }
  }
  if (!version) throw new Error("QR: veri çok uzun");

  const size = version * 4 + 17;
  const capacityBits = dataCodewords(version) * 8;

  // 1) Veri bitleri
  const bb = new Bits();
  bb.push(0b0100, 4);            // byte modu
  bb.push(data.length, 8);       // karakter sayısı (sürüm 1-9 byte modu = 8 bit)
  for (const b of data) bb.push(b, 8);
  bb.push(0, Math.min(4, capacityBits - bb.arr.length));
  bb.push(0, (8 - (bb.arr.length % 8)) % 8);
  for (let pad = 0xec; bb.arr.length < capacityBits; pad ^= 0xec ^ 0x11) bb.push(pad, 8);

  const dataBytes: number[] = [];
  for (let i = 0; i < bb.arr.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bb.arr[i + j];
    dataBytes.push(byte);
  }

  // 2) Blok bölme + Reed-Solomon + serpiştirme
  const numBlocks = BLOCKS[version];
  const eccLen = ECC_PER_BLOCK[version];
  const divisor = rsDivisor(eccLen);
  const perBlock = dataBytes.length / numBlocks;
  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  for (let i = 0; i < numBlocks; i++) {
    const block = dataBytes.slice(i * perBlock, (i + 1) * perBlock);
    dataBlocks.push(block);
    eccBlocks.push(rsRemainder(block, divisor));
  }
  const codewords: number[] = [];
  for (let i = 0; i < perBlock; i++) for (const b of dataBlocks) codewords.push(b[i]);
  for (let i = 0; i < eccLen; i++) for (const b of eccBlocks) codewords.push(b[i]);

  // 3) Matris + fonksiyon desenleri
  const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const isFunc: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

  const setFunc = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    isFunc[y][x] = true;
  };

  for (let i = 0; i < size; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]] as const) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        setFunc(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
    }
  }
  if (version >= 2) {
    const p = ALIGN_POS[version];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        setFunc(p + dx, p + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  const drawFormat = (mask: number) => {
    const value = (1 << 3) | mask; // ECC L = 1
    let rem = value;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = (((value << 10) | rem) ^ 0x5412) & 0x7fff;
    for (let i = 0; i <= 5; i++) setFunc(8, i, getBit(bits, i));
    setFunc(8, 7, getBit(bits, 6));
    setFunc(8, 8, getBit(bits, 7));
    setFunc(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) setFunc(14 - i, 8, getBit(bits, i));
    for (let i = 0; i < 8; i++) setFunc(size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) setFunc(8, size - 15 + i, getBit(bits, i));
    setFunc(8, size - 8, true); // koyu modül
  };
  drawFormat(0); // yer ayır

  // 4) Kod kelimelerini zikzak yerleştir
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunc[y][x] && bitIdx < totalBits) {
          modules[y][x] = getBit(codewords[bitIdx >>> 3], 7 - (bitIdx & 7));
          bitIdx++;
        }
      }
    }
  }

  // 5) Maske seçimi (ceza puanı en düşük)
  const maskFn = (m: number, x: number, y: number): boolean => {
    switch (m) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
      case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
      default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    }
  };

  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunc[y][x] && maskFn(m, x, y)) modules[y][x] = !modules[y][x];
      }
    }
  };

  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const p = penalty(modules, size);
    if (p < bestPenalty) { bestPenalty = p; bestMask = m; }
    applyMask(m); // geri al
  }
  applyMask(bestMask);
  drawFormat(bestMask);

  return modules;
}

function penalty(m: boolean[][], size: number): number {
  let score = 0;

  // Kural 1: aynı renkte 5+ ardışık modül
  for (let y = 0; y < size; y++) {
    for (const horizontal of [true, false]) {
      let run = 1;
      for (let i = 1; i < size; i++) {
        const cur = horizontal ? m[y][i] : m[i][y];
        const prev = horizontal ? m[y][i - 1] : m[i - 1][y];
        if (cur === prev) { run++; if (run === 5) score += 3; else if (run > 5) score += 1; }
        else run = 1;
      }
    }
  }

  // Kural 2: 2x2 aynı renk blokları
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
    }
  }

  // Kural 3: bulucu deseni taklit eden 1:1:3:1:1 dizileri
  const P1 = [true, false, true, true, true, false, true, false, false, false, false];
  const P2 = [false, false, false, false, true, false, true, true, true, false, true];
  const matches = (get: (i: number) => boolean, start: number, pat: boolean[]) =>
    pat.every((v, k) => get(start + k) === v);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x + 11 <= size; x++) {
      if (matches((i) => m[y][i], x, P1) || matches((i) => m[y][i], x, P2)) score += 40;
      if (matches((i) => m[i][y], x, P1) || matches((i) => m[i][y], x, P2)) score += 40;
    }
  }

  // Kural 4: koyu modül oranının %50'den sapması
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y][x]) dark++;
  const ratio = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return score;
}

/** Matrisi kendi kendine yeten bir SVG path'ine çevirir. */
export function qrSvgPath(matrix: boolean[][]): string {
  let d = "";
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix.length; x++) {
      if (matrix[y][x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
}
