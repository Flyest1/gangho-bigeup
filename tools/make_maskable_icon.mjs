// tools/make_maskable_icon.mjs
//
// public/icon-maskable-512.png 을 icon-512.png 에서 만든다. 그동안 둘은 바이트
// 단위로 같았다 — 이름만 maskable 이었다. 안드로이드는 마스커블 아이콘을 원형·
// 물방울 등 제 마음대로 잘라내므로, 잘려도 살아남아야 하는 내용은 "안전지대"
// (최소 변의 80% 지름을 갖는 중앙 원) 안에 들어가야 한다. 그러지 않은 지금
// 아이콘은 붉은 테두리의 네 모서리가 통째로 날아간다.
//
// 하는 일:
//   1. 원본을 디코드한다.
//   2. 가장자리의 균일한 테두리를 걷어낸다 — 원본에는 4px 흰 띠가 둘려 있는데
//      디자인이 아니라 생성 흔적이고, 그대로 두면 축소했을 때 아이콘 한가운데에
//      흰 사각 윤곽만 남는다.
//   3. 배경색(가장 흔한 색)과 다른 픽셀을 "내용"으로 보고, 그 내용이 안전지대
//      원 안에 정확히 들어갈 만큼만 축소한다. 사각형 대각선이 아니라 실제
//      픽셀의 최대 반경으로 계산한다 — 테두리 모서리가 이미 둥글어서, 대각선
//      기준으로 잡으면 필요 이상으로 작아진다.
//   4. 남은 자리는 배경색으로 꽉 채운다(마스크가 어디를 잘라도 구멍이 없다).
//
// 다시 만들려면: node tools/make_maskable_icon.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, pixelAt } from './png.mjs';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const SAFE_RATIO = 0.8;
// 반올림과 표본 추출이 경계에 걸치지 않도록 아주 조금만 안쪽으로 들인다.
const MARGIN = 0.98;
const DIFF_THRESHOLD = 24;

const source = decodePng(readFileSync(`${PUBLIC}icon-512.png`));

function dominantColor(image) {
  const counts = new Map();
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const key = pixelAt(image, x, y).join(',');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let best = null;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) { best = key; bestCount = count; }
  }
  return best.split(',').map(Number);
}

const background = dominantColor(source);
const differs = (rgb) =>
  Math.abs(rgb[0] - background[0]) + Math.abs(rgb[1] - background[1]) + Math.abs(rgb[2] - background[2])
  > DIFF_THRESHOLD;

/**
 * 가장자리에 붙은 흔적을 변마다 따로 걷어낸다. 원본의 흰 띠는 네 변을 두르지
 * 않고 위·왼쪽에만 있다(그리는 과정에서 획이 화면 경계에 걸린 자국이다). 그래서
 * "균일한 사각 테두리"를 찾는 방식으로는 한 겹도 못 걷어낸다.
 *
 * 판단 기준은 하나다 — 이 아이콘의 실제 디자인(붉은 테두리·문양)은 이미지
 * 가장자리에 닿지 않는다. 그러므로 배경색이 아닌 픽셀이 하나라도 있는 가장자리
 * 줄은 흔적이다. 안쪽으로 들어가다 배경색만 남은 줄을 만나면 멈춘다. 혹시 이
 * 전제가 깨지는 원본이 들어오면(디자인이 가장자리에 닿으면) 5%에서 멈추고
 * 경고한다 — 조용히 디자인을 잘라먹지 않는다.
 */
function trimEdgeArtifacts(image) {
  const cap = Math.floor(Math.min(image.width, image.height) * 0.05);
  const lineHasContent = (kind, index, e) => {
    const from = kind === 'col' ? e.top : e.left;
    const to = kind === 'col' ? image.height - e.bottom : image.width - e.right;
    for (let i = from; i < to; i++) {
      const p = kind === 'col' ? pixelAt(image, index, i) : pixelAt(image, i, index);
      if (differs(p)) return true;
    }
    return false;
  };

  // 네 변을 따로따로 끝까지 밀면 영원히 못 멈춘다 — 흰 띠가 사방을 두르고 있어서
  // 세로줄을 아무리 안으로 들어가도 그 줄의 맨 위·맨 아래에 띠의 픽셀이 남는다.
  // 그래서 "현재 남은 사각형"의 변만 보고 한 겹씩 함께 벗긴다.
  const edges = { left: 0, right: 0, top: 0, bottom: 0 };
  for (let guard = 0; guard <= cap; guard++) {
    let shrank = false;
    if (edges.left < cap && lineHasContent('col', edges.left, edges)) { edges.left++; shrank = true; }
    if (edges.right < cap && lineHasContent('col', image.width - 1 - edges.right, edges)) { edges.right++; shrank = true; }
    if (edges.top < cap && lineHasContent('row', edges.top, edges)) { edges.top++; shrank = true; }
    if (edges.bottom < cap && lineHasContent('row', image.height - 1 - edges.bottom, edges)) { edges.bottom++; shrank = true; }
    if (!shrank) break;
  }

  for (const [side, value] of Object.entries(edges)) {
    if (value >= cap) console.warn(`경고: ${side} 변을 상한(${cap}px)까지 잘랐다 — 원본을 확인하라`);
  }
  return edges;
}

const edges = trimEdgeArtifacts(source);
const bounds = {
  x0: edges.left,
  x1: source.width - edges.right,
  y0: edges.top,
  y1: source.height - edges.bottom,
};

// 내용의 중심과 최대 반경. 중심은 경계 상자의 한가운데를 쓴다 — 무게중심을
// 쓰면 문양의 획 분포에 따라 중심이 한쪽으로 밀린다.
let minX = source.width;
let minY = source.height;
let maxX = -1;
let maxY = -1;
for (let y = bounds.y0; y < bounds.y1; y++) {
  for (let x = bounds.x0; x < bounds.x1; x++) {
    if (!differs(pixelAt(source, x, y))) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}
if (maxX < 0) throw new Error('원본에서 내용을 찾지 못했다');

const contentCx = (minX + maxX + 1) / 2;
const contentCy = (minY + maxY + 1) / 2;

let maxRadius = 0;
for (let y = bounds.y0; y < bounds.y1; y++) {
  for (let x = bounds.x0; x < bounds.x1; x++) {
    if (!differs(pixelAt(source, x, y))) continue;
    maxRadius = Math.max(maxRadius, Math.hypot(x + 0.5 - contentCx, y + 0.5 - contentCy));
  }
}

const size = source.width;
const safeRadius = (Math.min(size, size) * SAFE_RATIO) / 2;
const scale = (safeRadius * MARGIN) / maxRadius;

// 출력 픽셀 하나가 덮는 원본 영역을 평균 낸다(박스 필터). 최근접 표본을 쓰면
// 획이 가늘어 계단이 심하게 진다.
const out = Buffer.alloc(size * size * 3);
const outCenter = size / 2;
const step = 1 / scale;

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const sx0 = contentCx + (x - outCenter) * step;
    const sy0 = contentCy + (y - outCenter) * step;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    const x1 = Math.ceil(sx0 + step);
    const y1 = Math.ceil(sy0 + step);
    for (let sy = Math.floor(sy0); sy < y1; sy++) {
      for (let sx = Math.floor(sx0); sx < x1; sx++) {
        const inside = sx >= bounds.x0 && sx < bounds.x1 && sy >= bounds.y0 && sy < bounds.y1;
        const [pr, pg, pb] = inside ? pixelAt(source, sx, sy) : background;
        r += pr; g += pg; b += pb; n++;
      }
    }
    const i = (y * size + x) * 3;
    out[i] = Math.round(r / n);
    out[i + 1] = Math.round(g / n);
    out[i + 2] = Math.round(b / n);
  }
}

writeFileSync(`${PUBLIC}icon-maskable-512.png`, encodePng({ width: size, height: size, rgb: out }));
console.log(
  `마스커블 아이콘 생성 — 가장자리 흔적 제거 ${JSON.stringify(edges)}, `
  + `내용 반경 ${maxRadius.toFixed(1)} → 배율 ${scale.toFixed(3)}`,
);
