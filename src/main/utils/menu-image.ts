import { deflateSync } from 'zlib';
import type { ColorScheme } from './display-preferences';

const PALETTE = { green: [26, 145, 106], red: [213, 64, 76], neutral: [133, 141, 153] } as const;
export interface MenuSignalOptions { colorScheme: ColorScheme; hideAmounts: boolean; stale?: boolean; scaleFactor: 1 | 2 }

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, bytes: Buffer) {
  const name = Buffer.from(type), result = Buffer.alloc(bytes.length + 12);
  result.writeUInt32BE(bytes.length, 0); name.copy(result, 4); bytes.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, bytes])), bytes.length + 8);
  return result;
}

/** PNG has a defined RGBA order; Electron's raw native bitmap is platform-dependent.
 * Add both representations to a non-template NativeImage. Title text remains native.
 * Privacy always selects identical neutral pixels, independent of amount or sign. */
export function menuSignalPng(pnl: number | null, options: MenuSignalOptions) {
  const scaleFactor = options.scaleFactor;
  if (![1, 2].includes(scaleFactor)) throw new Error('Unsupported menu icon scale');
  const width = 18 * scaleFactor, height = 18 * scaleFactor;
  const direction = options.hideAmounts || options.stale || pnl === null || !Number.isFinite(pnl) || pnl === 0 ? 0 : pnl > 0 ? 1 : -1;
  const color = direction === 0 ? PALETTE.neutral : ((direction > 0) === (options.colorScheme !== 'red-up') ? PALETTE.green : PALETTE.red);
  const pixels = Buffer.alloc(height * (width * 4 + 1));
  // A small arrow supplies a second cue besides color; no animation distracts from reading.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = (x + .5) / scaleFactor, py = (y + .5) / scaleFactor;
    const ay = direction < 0 ? 18 - py : py;
    const visible = direction === 0 ? px >= 4 && px < 14 && py >= 8 && py < 10
      : ((px >= 8 && px < 10 && ay >= 5 && ay < 14) || (ay >= 4 && ay < 9 && Math.abs(px - 9) <= ay - 3));
    if (visible) {
      const at = y * (width * 4 + 1) + 1 + x * 4;
      pixels[at] = color[0]; pixels[at + 1] = color[1]; pixels[at + 2] = color[2]; pixels[at + 3] = 255;
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return { buffer: Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]), width, height, scaleFactor };
}
