import { describe, it, expect } from 'vitest';
import {
  beats, matchup, stanceMultiplier, nextStance,
  updateCombo, comboFires, COMBO_THRESHOLD, LINE_LABEL,
} from '../../src/engine/stance';
import type { Combo, Line, Stance } from '../../src/engine/types';

describe('상성', () => {
  it('외공▶경공▶내공▶외공 순환', () => {
    expect(beats('wai', 'gyeong')).toBe(true);
    expect(beats('gyeong', 'nae')).toBe(true);
    expect(beats('nae', 'wai')).toBe(true);
  });

  it('역방향은 누르지 못한다', () => {
    expect(beats('gyeong', 'wai')).toBe(false);
    expect(beats('nae', 'gyeong')).toBe(false);
    expect(beats('wai', 'nae')).toBe(false);
  });

  it('같은 계열은 누르지 못한다', () => {
    for (const l of ['wai', 'gyeong', 'nae'] as const) expect(beats(l, l)).toBe(false);
  });

  it('술수는 누르지도 눌리지도 않는다', () => {
    for (const l of ['wai', 'gyeong', 'nae', 'sul'] as const) {
      expect(beats('sul', l)).toBe(false);
      expect(beats(l, 'sul')).toBe(false);
    }
  });

  it('3x3 판정표 전체', () => {
    const table: Array<[Line, Stance, 'break' | 'neutral' | 'resisted']> = [
      ['wai', 'wai', 'neutral'],   ['wai', 'gyeong', 'break'],    ['wai', 'nae', 'resisted'],
      ['gyeong', 'wai', 'resisted'], ['gyeong', 'gyeong', 'neutral'], ['gyeong', 'nae', 'break'],
      ['nae', 'wai', 'break'],     ['nae', 'gyeong', 'resisted'], ['nae', 'nae', 'neutral'],
    ];
    for (const [atk, def, want] of table) expect(matchup(atk, def)).toBe(want);
  });

  it('술수 공격이나 자세 없음은 항상 neutral', () => {
    expect(matchup('sul', 'wai')).toBe('neutral');
    expect(matchup('wai', null)).toBe('neutral');
  });

  it('배율은 파훼 1.5 · 보통 1 · 저항 0.75', () => {
    expect(stanceMultiplier('break')).toBe(1.5);
    expect(stanceMultiplier('neutral')).toBe(1);
    expect(stanceMultiplier('resisted')).toBe(0.75);
  });
});

describe('자세 전환', () => {
  it('계열 카드는 자세를 그 계열로 바꾼다', () => {
    expect(nextStance('wai', 'nae')).toBe('nae');
    expect(nextStance('nae', 'gyeong')).toBe('gyeong');
  });

  it('술수 카드는 자세를 바꾸지 않는다', () => {
    expect(nextStance('wai', 'sul')).toBe('wai');
    expect(nextStance('gyeong', 'sul')).toBe('gyeong');
  });
});

describe('연계', () => {
  const empty: Combo = { line: null, count: 0 };

  it('첫 계열 카드는 카운터 1', () => {
    expect(updateCombo(empty, 'wai')).toEqual({ line: 'wai', count: 1 });
  });

  it('같은 계열을 이어내면 누적된다', () => {
    let c = updateCombo(empty, 'wai');
    c = updateCombo(c, 'wai');
    c = updateCombo(c, 'wai');
    expect(c).toEqual({ line: 'wai', count: 3 });
  });

  it('다른 계열로 갈아타면 1로 리셋된다', () => {
    let c = updateCombo(empty, 'wai');
    c = updateCombo(c, 'wai');
    c = updateCombo(c, 'nae');
    expect(c).toEqual({ line: 'nae', count: 1 });
  });

  it('술수 카드는 카운터를 건드리지 않는다', () => {
    let c = updateCombo(empty, 'gyeong');
    c = updateCombo(c, 'gyeong');
    const before = { ...c };
    expect(updateCombo(c, 'sul')).toEqual(before);
  });

  it('임계값은 3이며 3번째 카드부터 발동한다', () => {
    expect(COMBO_THRESHOLD).toBe(3);
    expect(comboFires({ line: 'wai', count: 2 })).toBe(false);
    expect(comboFires({ line: 'wai', count: 3 })).toBe(true);
    expect(comboFires({ line: 'wai', count: 7 })).toBe(true);
  });

  it('갈아탄 직후에는 발동하지 않는다', () => {
    let c: Combo = { line: 'wai', count: 9 };
    c = updateCombo(c, 'nae');
    expect(comboFires(c)).toBe(false);
  });

  it('자세 없음은 발동하지 않는다', () => {
    expect(comboFires({ line: null, count: 5 })).toBe(false);
  });
});

describe('표기', () => {
  it('네 계열 모두 이름·한자·도형을 가진다', () => {
    for (const l of ['wai', 'gyeong', 'nae', 'sul'] as const) {
      expect(LINE_LABEL[l].name.length).toBeGreaterThan(0);
      expect(LINE_LABEL[l].hanja.length).toBe(1);
      expect(LINE_LABEL[l].shape.length).toBeGreaterThan(0);
    }
  });

  it('도형이 서로 달라 색 없이도 구분된다', () => {
    const shapes = (['wai', 'gyeong', 'nae', 'sul'] as const).map((l) => LINE_LABEL[l].shape);
    expect(new Set(shapes).size).toBe(4);
  });
});
