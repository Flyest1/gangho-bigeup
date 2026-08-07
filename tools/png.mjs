// tools/png.mjs
//
// 8비트 트루컬러(색 유형 2), 비인터레이스 PNG 만 다루는 최소 코덱. public/ 의
// 아이콘 네 장이 전부 그 모양이라 그 이상은 필요 없다.
//
// 왜 라이브러리를 안 쓰나: 이 프로젝트는 런타임 의존성이 0이고 devDependency 도
// 빌드·테스트에 필요한 것만 둔다. 아이콘 한 장을 안전지대에 맞춰 줄이자고
// 이미지 라이브러리를 들이는 것보다, zlib(Node 내장)만으로 되는 일을 100줄로
// 적어 두는 쪽이 이 리포의 결에 맞다. 검사(테스트)와 생성(도구)이 같은 코덱을
// 공유하므로 "생성기가 만든 것을 생성기의 눈으로 검사"하는 함정도 없다 —
// 검사하는 성질(안전지대 안에 내용이 들어가는가)은 픽셀에서 직접 읽는다.
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BYTES_PER_PIXEL = 3;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * @param buffer PNG 파일 전체.
 * @returns `{ width, height, rgb }` — rgb 는 width*height*3 바이트.
 */
export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error('PNG 서명이 아니다');

  let width = 0;
  let height = 0;
  const idat = [];
  let offset = 8;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      const colorType = data[9];
      const interlace = data[12];
      if (depth !== 8 || colorType !== 2 || interlace !== 0) {
        throw new Error(`지원하지 않는 PNG: depth=${depth} colorType=${colorType} interlace=${interlace}`);
      }
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * BYTES_PER_PIXEL;
  const rgb = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= BYTES_PER_PIXEL ? rgb[y * stride + x - BYTES_PER_PIXEL] : 0;
      const up = y > 0 ? rgb[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= BYTES_PER_PIXEL ? rgb[(y - 1) * stride + x - BYTES_PER_PIXEL] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`알 수 없는 필터 ${filter}`);
      rgb[y * stride + x] = value & 0xff;
    }
  }

  return { width, height, rgb };
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** 필터 0(None)으로만 쓴다 — 아이콘 한 장에 압축률을 다툴 이유가 없다. */
export function encodePng({ width, height, rgb }) {
  const stride = width * BYTES_PER_PIXEL;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type: truecolor
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** (x, y) 픽셀을 `[r, g, b]` 로 읽는다. */
export function pixelAt(image, x, y) {
  const i = (y * image.width + x) * BYTES_PER_PIXEL;
  return [image.rgb[i], image.rgb[i + 1], image.rgb[i + 2]];
}
