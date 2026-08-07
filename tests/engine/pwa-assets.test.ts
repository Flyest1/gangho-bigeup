// PWA 아이콘 자산의 성질을 픽셀에서 직접 읽어 고정한다. Task 1에서 두 건을
// 미뤄 뒀었다: (1) 마스커블 아이콘이 icon-512 와 바이트 단위로 같아 안전지대가
// 없고, (2) index.html 에 apple-touch-icon 링크가 없어 iOS 가 하위 경로에서
// 아이콘을 찾지 못한다. 둘 다 배포된 앱을 홈 화면에 설치했을 때만 보이는
// 결함이라 브라우저 스모크도 지나쳤다.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodePng, pixelAt, type PngImage } from '../../tools/png.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p: string): Buffer => readFileSync(root + p);
const icon = (name: string): PngImage => decodePng(read(`public/${name}`));

/** 마스커블 안전지대 — 아이콘 최소 변의 80% 지름을 갖는 중앙 원. */
const SAFE_RATIO = 0.8;

/**
 * 배경(모서리 픽셀)과 눈에 띄게 다른 픽셀을 "내용"으로 본다. 임계값 24는
 * PNG 무손실이라 여유가 크다 — 배경은 정확히 한 색이고 문양·테두리는 한참 밝다.
 */
function contentPixels(image: PngImage): { x: number; y: number }[] {
  const [br, bg, bb] = pixelAt(image, 0, 0);
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const [r, g, b] = pixelAt(image, x, y);
      if (Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) > 24) out.push({ x, y });
    }
  }
  return out;
}

describe('마스커블 아이콘', () => {
  it('icon-512 와 다른 파일이다', () => {
    // 예전에는 바이트 단위로 같았다 — 이름만 maskable 이고 안드로이드가 원형으로
    // 잘라내면 붉은 테두리 네 모서리가 통째로 날아간다.
    expect(read('public/icon-maskable-512.png').equals(read('public/icon-512.png'))).toBe(false);
  });

  it('모든 내용이 안전지대(중앙 80% 원) 안에 들어간다', () => {
    const image = icon('icon-maskable-512.png');
    const radius = (Math.min(image.width, image.height) * SAFE_RATIO) / 2;
    const cx = image.width / 2;
    const cy = image.height / 2;

    const outside = contentPixels(image).filter(
      (p) => Math.hypot(p.x + 0.5 - cx, p.y + 0.5 - cy) > radius,
    );
    expect(outside).toHaveLength(0);
  });

  it('안전지대를 여백으로만 채우지 않았다 — 문양이 실제로 남아 있다', () => {
    // 위 테스트만 있으면 "전부 배경색으로 칠한 빈 사각형"도 통과한다.
    const image = icon('icon-maskable-512.png');
    const filled = contentPixels(image).length / (image.width * image.height);
    expect(filled).toBeGreaterThan(0.05);
  });

  it('배경이 네 모서리까지 꽉 찬다 (마스크가 어디를 잘라도 투명 구멍이 없다)', () => {
    const image = icon('icon-maskable-512.png');
    const corners = [
      pixelAt(image, 0, 0),
      pixelAt(image, image.width - 1, 0),
      pixelAt(image, 0, image.height - 1),
      pixelAt(image, image.width - 1, image.height - 1),
    ];
    for (const c of corners) expect(c).toEqual(corners[0]);
  });
});

describe('index.html 아이콘 링크', () => {
  it('apple-touch-icon 링크가 있다', () => {
    // iOS 는 매니페스트의 icons 를 홈 화면 아이콘으로 쓰지 않는다. 링크가 없으면
    // 루트(/apple-touch-icon.png)를 찾는데, 이 앱은 /gangho-bigeup/ 아래 있다.
    // 소스에는 `/apple-touch-icon.png` 로 적고 base 접두사는 Vite 가 빌드할 때
    // 붙인다 — 붙었는지는 tools/verify_build.mjs 가 dist 에서 확인한다.
    const html = read('index.html').toString('utf8');
    expect(html).toMatch(/<link[^>]+rel="apple-touch-icon"[^>]*>/);
    expect(html).toContain('apple-touch-icon.png');
  });
});
