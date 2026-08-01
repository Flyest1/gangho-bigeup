// src/art/portraits.ts
//
// 초상. 보스 셋(매초풍·구천인·구양봉)만 실제 WebP가 있고 나머지 전부는 defId의
// 해시로 그리는 얼굴이다. 같은 적은 항상 같은 얼굴을 받아야 하므로 Math.random을
// 쓰지 않는다 — FNV-1a 해시 하나로 얼굴형·눈매·수염·관모를 결정적으로 고른다.
import { CONTENT } from '../engine/gamedata';

const SVG_NS = 'http://www.w3.org/2000/svg';

function node(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** FNV-1a 32비트. 같은 문자열은 언제나 같은 정수를 낸다. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 속성마다 다른 salt로 해시해 얼굴형·눈매·수염·관모가 서로 독립적으로 갈리게 한다. */
function pick(defId: string, salt: string, count: number): number {
  return fnv1a(`${defId}:${salt}`) % count;
}

// ── 얼굴형 3종 ────────────────────────────────────────────────────────────
const FACE_SHAPES: Array<() => SVGElement> = [
  () => node('circle', { cx: '32', cy: '33', r: '22' }), // 둥근 얼굴
  () => node('path', { // 각진 얼굴 — 넓은 이마, 뾰족한 턱
    d: 'M12 20 Q12 10 22 10 L42 10 Q52 10 52 20 L52 38 Q52 54 32 60 Q12 54 12 38 Z',
  }),
  () => node('ellipse', { cx: '32', cy: '33', rx: '16', ry: '25' }), // 길쭉한 얼굴
];

// ── 눈매 3종 ──────────────────────────────────────────────────────────────
const EYE_STYLES: Array<() => SVGElement> = [
  () => node('path', { d: 'M17 30 Q21 26 26 30 M38 30 Q43 26 47 30', fill: 'none' }), // 온화한 곡선
  () => node('path', { d: 'M16 32 L27 26 M37 26 L48 32', fill: 'none' }), // 매서운 사선
  () => node('g', {}), // 자리표시자, 실제 원은 아래서 채운다(둥근 눈)
];

function eyesFor(idx: number): SVGElement {
  if (idx !== 2) return EYE_STYLES[idx]!();
  const g = node('g', { stroke: 'none' });
  g.append(node('circle', { cx: '22', cy: '30', r: '3' }));
  g.append(node('circle', { cx: '42', cy: '30', r: '3' }));
  return g;
}

// ── 수염 4종 ──────────────────────────────────────────────────────────────
const BEARD_STYLES: Array<() => SVGElement | null> = [
  () => null, // 민얼굴
  () => node('path', { d: 'M28 51 L32 61 L36 51 Z', stroke: 'none' }), // 짧은 염소수염
  () => node('path', { // 길게 갈라진 수염
    d: 'M27 51 Q23 60 19 64 M37 51 Q41 60 45 64', fill: 'none',
  }),
  () => node('path', { // 풍성한 턱수염
    d: 'M13 39 Q13 58 32 61 Q51 58 51 39 Q51 51 32 53 Q13 51 13 39 Z',
    stroke: 'none',
  }),
];

// ── 관모 3종 ──────────────────────────────────────────────────────────────
const HEADWEAR_STYLES: Array<() => SVGElement> = [
  () => node('circle', { cx: '32', cy: '8', r: '3', stroke: 'none' }), // 맨상투
  () => node('path', { // 유건(문사)
    d: 'M13 15 L51 15 L51 10 Q32 3 13 10 Z', stroke: 'none',
  }),
  () => node('g', {}), // 무사 두건 — 아래서 조립
];

function headwearFor(idx: number): SVGElement {
  if (idx !== 2) return HEADWEAR_STYLES[idx]!();
  const g = node('g', { fill: 'none' });
  g.append(node('path', { d: 'M11 16 L53 16', 'stroke-width': '3' }));
  g.append(node('path', { d: 'M46 16 L55 27' }));
  g.append(node('path', { d: 'M46 16 L50 31' }));
  return g;
}

/**
 * defId 해시로 그리는 얼굴. 얼굴형(3)·눈매(3)·수염(4)·관모(3) 네 자리를 각각
 * 다른 salt로 뽑아 조합한다 — 같은 defId는 언제나 같은 조합이 나온다.
 */
export function fallbackFace(defId: string): SVGSVGElement {
  const root = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  root.setAttribute('viewBox', '0 0 64 64');
  root.setAttribute('class', 'fallback-face');
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  root.setAttribute('fill', 'none');
  root.setAttribute('stroke', 'currentColor');
  root.setAttribute('stroke-width', '2');
  root.setAttribute('stroke-linecap', 'round');

  const faceIdx = pick(defId, 'face', FACE_SHAPES.length);
  const eyeIdx = pick(defId, 'eyes', EYE_STYLES.length);
  const beardIdx = pick(defId, 'beard', BEARD_STYLES.length);
  const hatIdx = pick(defId, 'hat', HEADWEAR_STYLES.length);

  root.append(FACE_SHAPES[faceIdx]!());
  root.append(eyesFor(eyeIdx));
  const beard = BEARD_STYLES[beardIdx]!();
  if (beard) root.append(beard);
  root.append(headwearFor(hatIdx));

  return root;
}

/**
 * 초상 하나. 보스 셋은 `enemies.json`의 `portrait` 필드로 실제 WebP를 낸다.
 * 그 필드가 없으면(일반·정예 전부, 그리고 알 수 없는 defId도) `fallbackFace`로
 * 대신한다 — 항상 뭔가는 그려진다.
 */
export function portraitFor(defId: string): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'portrait';
  wrap.setAttribute('aria-hidden', 'true');

  let portraitId: string | undefined;
  try {
    portraitId = CONTENT.enemy(defId).portrait;
  } catch {
    portraitId = undefined;
  }

  if (portraitId) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';
    img.src = `${import.meta.env.BASE_URL}portraits/${portraitId}.webp`;
    img.className = 'portrait-img';
    wrap.append(img);
    return wrap;
  }

  wrap.append(fallbackFace(defId));
  return wrap;
}
