// src/art/svg.ts
//
// 런타임에 그리는 벡터 문양. 카드가 60장이든 140장이든 이미지 요청은 0이다 —
// 전부 이 파일의 함수가 그 자리에서 <svg> 트리를 만든다. 외부 폰트도 CDN도 없다.
//
// 색은 CSS가 흘려보낸다(stroke="currentColor"). 계열의 진짜 구분자는 여전히
// `LINE_LABEL`의 이름·한자·도형(엔진 stance.ts)이다 — 색맹 접근성 보장은 그 세
// 가지 조합이 하지, 여기서 그리는 먹선 문양은 그 위에 얹는 장식일 뿐이다.
import type { Line } from '../engine/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 결정적 의사난수(mulberry32). 같은 seed는 어떤 환경에서도 같은 수열을 낸다 —
 * 이 파일은 엔진이 아니라 장식이지만, "같은 카드는 항상 같은 문양"이라는 약속을
 * 지키려면 Math.random을 쓸 수 없다.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 문자열 → 32비트 정수(FNV-1a). 카드 id를 `lineSigil`의 seed로 바꿀 때 쓴다. */
export function seedFromId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function node(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function createRoot(viewBox: string): SVGSVGElement {
  const root = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  root.setAttribute('viewBox', viewBox);
  // stroke="currentColor"를 뿌리에 둬서 CSS의 color가 그대로 획 색이 되게 한다.
  // 자식들은 별도로 stroke를 지정하지 않는 한 이 값을 그대로 물려받는다.
  root.setAttribute('fill', 'none');
  root.setAttribute('stroke', 'currentColor');
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  return root;
}

const round1 = (n: number): string => n.toFixed(1);

/** 외공 — 먹선 검격. 대각선 한 획과 끝에서 튕기는 짧은 잔칼. */
function waiMark(rand: () => number): SVGElement {
  const g = node('g', { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round' });
  const cx = 32;
  const cy = 32;
  const angle = (28 + rand() * 34) * (Math.PI / 180);
  const len = 20 + rand() * 8;
  const weight = 3 + rand() * 3;
  const x1 = cx - Math.cos(angle) * len;
  const y1 = cy - Math.sin(angle) * len;
  const x2 = cx + Math.cos(angle) * len;
  const y2 = cy + Math.sin(angle) * len;

  g.append(node('path', {
    d: `M ${round1(x1)} ${round1(y1)} L ${round1(x2)} ${round1(y2)}`,
    'stroke-width': round1(weight),
  }));

  const flickAngle = angle + Math.PI / 2 + (rand() - 0.5) * 0.7;
  const flen = 7 + rand() * 5;
  const fx = x2 + Math.cos(flickAngle) * flen;
  const fy = y2 + Math.sin(flickAngle) * flen;
  g.append(node('path', {
    d: `M ${round1(x2)} ${round1(y2)} L ${round1(fx)} ${round1(fy)}`,
    'stroke-width': round1(weight * 0.55),
  }));
  return g;
}

/** 경공 — 바람 소용돌이. 중심에서 바깥으로 풀리는 나선. */
function gyeongMark(rand: () => number): SVGElement {
  const cx = 32;
  const cy = 32;
  const turns = 1.5 + rand() * 0.7;
  const rot = rand() * Math.PI * 2;
  const weight = 2 + rand() * 1.8;
  const steps = 36;
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = rot + t * turns * Math.PI * 2;
    const r = 2 + t * 21;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    parts.push(`${i === 0 ? 'M' : 'L'} ${round1(x)} ${round1(y)}`);
  }
  return node('path', {
    d: parts.join(' '),
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-width': round1(weight),
  });
}

/** 내공 — 동심 기운. 손으로 그은 듯 살짝 트인 먹선 원 몇 겹. */
function naeMark(rand: () => number): SVGElement {
  const g = node('g', { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round' });
  const cx = 32;
  const cy = 32;
  const rings = 3;
  const baseR = 7 + rand() * 3;
  const gap = 5 + rand() * 2;
  const weight = 1.8 + rand() * 1.4;
  for (let i = 0; i < rings; i++) {
    const r = baseR + i * gap;
    const gapAngle = (12 + rand() * 34) * (Math.PI / 180);
    const start = rand() * Math.PI * 2;
    const end = start + Math.PI * 2 - gapAngle;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + Math.cos(start) * r;
    const y1 = cy + Math.sin(start) * r;
    const x2 = cx + Math.cos(end) * r;
    const y2 = cy + Math.sin(end) * r;
    g.append(node('path', {
      d: `M ${round1(x1)} ${round1(y1)} A ${round1(r)} ${round1(r)} 0 ${large} 1 ${round1(x2)} ${round1(y2)}`,
      'stroke-width': round1(Math.max(0.8, weight - i * 0.35)),
    }));
  }
  return g;
}

/**
 * 술수 — 세 계열 어디에도 속하지 않는 문양. 단일 획(외공)도, 나선(경공)도,
 * 동심원(내공)도 아닌 흩어진 먹점 다발로 "정해진 틀을 벗어난다"는 인상을 준다.
 */
function sulMark(rand: () => number): SVGElement {
  const g = node('g', { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round' });
  const cx = 32;
  const cy = 32;
  const n = 5;
  const baseWeight = 2 + rand() * 2;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + rand() * 0.6;
    const rStart = 3 + rand() * 3;
    const rEnd = rStart + 8 + rand() * 8;
    const x1 = cx + Math.cos(angle) * rStart;
    const y1 = cy + Math.sin(angle) * rStart;
    const x2 = cx + Math.cos(angle) * rEnd;
    const y2 = cy + Math.sin(angle) * rEnd;
    g.append(node('path', {
      d: `M ${round1(x1)} ${round1(y1)} L ${round1(x2)} ${round1(y2)}`,
      'stroke-width': round1(baseWeight * (0.5 + rand() * 0.6)),
    }));
  }
  g.append(node('circle', {
    cx: '32', cy: '32', r: round1(1.4 + rand()), fill: 'currentColor', stroke: 'none',
  }));
  return g;
}

function markFor(line: Line, rand: () => number): SVGElement {
  switch (line) {
    case 'wai': return waiMark(rand);
    case 'gyeong': return gyeongMark(rand);
    case 'nae': return naeMark(rand);
    case 'sul': return sulMark(rand);
  }
}

/**
 * 계열별 먹선 문양. `seed`가 획의 각도·굵기를 흔들어 같은 계열이라도 카드마다
 * 조금씩 다르게 나온다 — 같은 seed는 언제나 같은 문양을 낸다(결정적).
 *
 * `stroke="currentColor"`이므로 CSS의 `color`가 그대로 획 색이 된다. 이름·한자·
 * 도형(LINE_LABEL)을 대신하지 않는다 — 이 문양만으로 계열을 가르라고 만들지 않았다.
 */
export function lineSigil(line: Line, seed: number): SVGSVGElement {
  const root = createRoot('0 0 64 64');
  root.setAttribute('class', `line-sigil line-sigil-${line}`);
  root.append(markFor(line, mulberry32(seed)));
  return root;
}

/** 막(act)별 원경 산세 실루엣. act마다 다르지만 같은 act는 항상 같은 산세다. */
export function inkBackdrop(act: number): SVGSVGElement {
  const rand = mulberry32(1000 + Math.trunc(act) * 97);
  const root = createRoot('0 0 320 120');
  root.setAttribute('preserveAspectRatio', 'none');
  root.setAttribute('class', `ink-backdrop ink-backdrop-act${act}`);
  root.setAttribute('fill', 'currentColor');
  root.setAttribute('stroke', 'none');

  const layers = 3;
  for (let li = 0; li < layers; li++) {
    const baseY = 46 + li * 20 + rand() * 6;
    const peaks = 4 + Math.floor(rand() * 2);
    let d = `M 0 120 L 0 ${round1(baseY)} `;
    for (let i = 0; i <= peaks; i++) {
      const x = (320 / peaks) * i;
      const jitter = (rand() - 0.5) * 24;
      const y = Math.max(8, baseY - 16 - li * 6 + jitter);
      d += `L ${round1(x)} ${round1(y)} `;
    }
    d += `L 320 ${round1(baseY)} L 320 120 Z`;
    const opacity = Math.max(0.08, 0.34 - li * 0.1);
    root.append(node('path', { d: d.trim(), opacity: opacity.toFixed(2) }));
  }
  return root;
}
