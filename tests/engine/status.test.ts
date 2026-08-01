import { describe, it, expect } from 'vitest';
import { getStatus, addStatus, consumeStatus, tickStatus, STATUS_META } from '../../src/engine/status';
import type { StatusId, StatusMap } from '../../src/engine/types';

const ALL: StatusId[] = ['poison', 'naesang', 'vulnerable', 'weak', 'momentum', 'afterimage'];

describe('상태이상 수치', () => {
  it('없는 상태는 0', () => {
    expect(getStatus({}, 'poison')).toBe(0);
  });

  it('추가는 누적된다', () => {
    let m: StatusMap = {};
    m = addStatus(m, 'poison', 3);
    m = addStatus(m, 'poison', 2);
    expect(getStatus(m, 'poison')).toBe(5);
  });

  it('추가는 원본을 변경하지 않는다', () => {
    const m: StatusMap = { poison: 1 };
    addStatus(m, 'poison', 5);
    expect(m.poison).toBe(1);
  });

  it('0 이하를 더하면 아무 일도 없다', () => {
    expect(addStatus({ poison: 2 }, 'poison', 0)).toEqual({ poison: 2 });
  });

  it('소모는 차감하고 0이 되면 키를 지운다', () => {
    expect(consumeStatus({ afterimage: 2 }, 'afterimage', 1)).toEqual({ afterimage: 1 });
    expect(consumeStatus({ afterimage: 1 }, 'afterimage', 1)).toEqual({});
  });

  it('소모는 음수로 내려가지 않는다', () => {
    expect(consumeStatus({ poison: 2 }, 'poison', 99)).toEqual({});
  });
});

describe('턴 감소', () => {
  it('중독·취약·쇠약은 턴마다 1 줄어든다', () => {
    const out = tickStatus({ poison: 3, vulnerable: 2, weak: 1 });
    expect(out).toEqual({ poison: 2, vulnerable: 1 });
  });

  it('기세는 줄지 않는다', () => {
    expect(tickStatus({ momentum: 4 })).toEqual({ momentum: 4 });
  });

  it('내상·잔상은 턴 감소로 줄지 않는다', () => {
    expect(tickStatus({ naesang: 2, afterimage: 1 })).toEqual({ naesang: 2, afterimage: 1 });
  });

  it('빈 상태는 그대로 빈 상태', () => {
    expect(tickStatus({})).toEqual({});
  });
});

describe('메타', () => {
  it('여섯 상태 모두 이름·한자·설명을 가진다', () => {
    for (const id of ALL) {
      expect(STATUS_META[id].name.length).toBeGreaterThan(0);
      expect(STATUS_META[id].hanja.length).toBe(1);
      expect(STATUS_META[id].text.length).toBeGreaterThan(0);
    }
  });

  it('기세만 유익하고 나머지는 해롭다', () => {
    expect(STATUS_META.momentum.harmful).toBe(false);
    expect(STATUS_META.afterimage.harmful).toBe(false);
    expect(STATUS_META.poison.harmful).toBe(true);
    expect(STATUS_META.vulnerable.harmful).toBe(true);
  });

  it('감소 방식이 설계서와 일치한다', () => {
    expect(STATUS_META.poison.decay).toBe('perTurn');
    expect(STATUS_META.vulnerable.decay).toBe('perTurn');
    expect(STATUS_META.weak.decay).toBe('perTurn');
    expect(STATUS_META.naesang.decay).toBe('onUse');
    expect(STATUS_META.afterimage.decay).toBe('onUse');
    expect(STATUS_META.momentum.decay).toBe('never');
  });
});
