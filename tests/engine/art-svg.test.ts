// @vitest-environment happy-dom
//
// src/art/svg.ts 회귀. 이 문양들은 색맹 접근성 보장(이름·한자·도형)의 대체물이
// 아니라 그 위의 장식이므로, 여기서 확인할 것은 "장식이 결정적이고 계열마다
// 다르다"는 성질뿐이다 — 상성·연계 같은 규칙은 이 파일이 아니라 엔진이 가진다.
import { describe, expect, it } from 'vitest';
import { inkBackdrop, lineSigil, seedFromId } from '../../src/art/svg';
import type { Line } from '../../src/engine/types';

const LINES: Line[] = ['wai', 'gyeong', 'nae', 'sul'];

describe('lineSigil', () => {
  it('viewBox가 0 0 64 64이고 CSS 색이 흐르도록 stroke=currentColor를 쓴다', () => {
    const svg = lineSigil('wai', 1);
    expect(svg.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.tagName.toLowerCase()).toBe('svg');
  });

  it('장식일 뿐이므로 스크린리더에서 숨는다', () => {
    const svg = lineSigil('nae', 5);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('같은 계열·같은 seed는 항상 같은 문양을 낸다(결정적)', () => {
    const a = lineSigil('gyeong', 42);
    const b = lineSigil('gyeong', 42);
    expect(a.outerHTML).toBe(b.outerHTML);
  });

  it('seed가 다르면 같은 계열이라도 문양이 달라진다', () => {
    const a = lineSigil('wai', 1);
    const b = lineSigil('wai', 2);
    expect(a.outerHTML).not.toBe(b.outerHTML);
  });

  it('네 계열이 서로 다른 문양을 낸다 — 술수는 외공·경공·내공 어느 것과도 겹치지 않는다', () => {
    const marks = LINES.map((line) => lineSigil(line, 7).outerHTML);
    expect(new Set(marks).size).toBe(LINES.length);
  });

  it('seedFromId는 문자열마다 다른 정수를, 같은 문자열이면 항상 같은 정수를 낸다', () => {
    expect(seedFromId('byeokta')).toBe(seedFromId('byeokta'));
    expect(seedFromId('byeokta')).not.toBe(seedFromId('gyeokgong'));
  });
});

describe('inkBackdrop', () => {
  it('같은 막(act)은 항상 같은 산세를 낸다', () => {
    const a = inkBackdrop(1);
    const b = inkBackdrop(1);
    expect(a.outerHTML).toBe(b.outerHTML);
  });

  it('막이 다르면 산세도 달라진다', () => {
    const a1 = inkBackdrop(1).outerHTML;
    const a2 = inkBackdrop(2).outerHTML;
    const a3 = inkBackdrop(3).outerHTML;
    expect(new Set([a1, a2, a3]).size).toBe(3);
  });

  it('장식이라 스크린리더에서 숨는다', () => {
    expect(inkBackdrop(1).getAttribute('aria-hidden')).toBe('true');
  });
});
