import { describe, it, expect } from 'vitest';
import { computeDamage } from '../../src/engine/damage';
import type { DamageContext } from '../../src/engine/damage';

function ctx(over: Partial<DamageContext> = {}): DamageContext {
  return {
    base: 10,
    attackerLine: 'wai',
    attackerStatus: {},
    defenderStance: 'wai',
    defenderStatus: {},
    defenderBlock: 0,
    ...over,
  };
}

describe('기본 피해', () => {
  it('보정이 없으면 기본값 그대로 체력에 들어간다', () => {
    const r = computeDamage(ctx());
    expect(r.amount).toBe(10);
    expect(r.hpLoss).toBe(10);
    expect(r.blockLoss).toBe(0);
    expect(r.matchup).toBe('neutral');
  });

  it('연계 보너스는 기본값에 더해진다', () => {
    expect(computeDamage(ctx({ comboBonus: 6 })).amount).toBe(16);
  });

  it('기세는 가산이다', () => {
    expect(computeDamage(ctx({ attackerStatus: { momentum: 4 } })).amount).toBe(14);
  });
});

describe('배율 순서', () => {
  it('쇠약은 25% 깎고 내림한다', () => {
    expect(computeDamage(ctx({ base: 10, attackerStatus: { weak: 1 } })).amount).toBe(7);
  });

  it('취약은 50% 올리고 내림한다', () => {
    expect(computeDamage(ctx({ base: 10, defenderStatus: { vulnerable: 1 } })).amount).toBe(15);
  });

  it('파훼는 50% 올리고 내림한다', () => {
    expect(computeDamage(ctx({ base: 10, defenderStance: 'gyeong' })).amount).toBe(15);
  });

  it('저항은 25% 깎고 내림한다', () => {
    expect(computeDamage(ctx({ base: 10, defenderStance: 'nae' })).amount).toBe(7);
  });

  it('쇠약과 취약이 겹치면 쇠약을 먼저 적용한다', () => {
    // 10 -> 쇠약 7 -> 취약 10
    const r = computeDamage(ctx({
      base: 10,
      attackerStatus: { weak: 1 },
      defenderStatus: { vulnerable: 1 },
    }));
    expect(r.amount).toBe(10);
  });

  it('네 보정이 모두 걸리면 설계서 순서대로 계산된다', () => {
    // 10 + 연계6 = 16 -> 기세+2 = 18 -> 쇠약 13 -> 취약 19 -> 파훼 28
    const r = computeDamage(ctx({
      base: 10,
      comboBonus: 6,
      attackerStatus: { weak: 1, momentum: 2 },
      defenderStance: 'gyeong',
      defenderStatus: { vulnerable: 1 },
    }));
    expect(r.amount).toBe(28);
    expect(r.broke).toBe(true);
  });
});

describe('호신강기', () => {
  it('호신강기가 먼저 깎이고 나머지가 체력으로 간다', () => {
    const r = computeDamage(ctx({ base: 10, defenderBlock: 4 }));
    expect(r.blockLoss).toBe(4);
    expect(r.hpLoss).toBe(6);
  });

  it('호신강기가 충분하면 체력은 깎이지 않는다', () => {
    const r = computeDamage(ctx({ base: 10, defenderBlock: 30 }));
    expect(r.blockLoss).toBe(10);
    expect(r.hpLoss).toBe(0);
  });

  it('파훼는 호신강기를 무시하고 체력에 직접 들어간다', () => {
    const r = computeDamage(ctx({ base: 10, defenderStance: 'gyeong', defenderBlock: 99 }));
    expect(r.broke).toBe(true);
    expect(r.blockLoss).toBe(0);
    expect(r.hpLoss).toBe(15);
  });

  it('ignoreBlock은 파훼가 아니어도 호신강기를 무시한다', () => {
    const r = computeDamage(ctx({ base: 5, defenderBlock: 99, ignoreBlock: true }));
    expect(r.hpLoss).toBe(5);
    expect(r.blockLoss).toBe(0);
  });
});

describe('잔상', () => {
  it('잔상이 있으면 완전히 흘리고 1 소모한다', () => {
    const r = computeDamage(ctx({ base: 40, defenderStatus: { afterimage: 2 } }));
    expect(r.dodged).toBe(true);
    expect(r.hpLoss).toBe(0);
    expect(r.blockLoss).toBe(0);
    expect(r.defenderStatus).toEqual({ afterimage: 1 });
  });

  it('잔상은 파훼도 흘린다', () => {
    const r = computeDamage(ctx({
      base: 40, defenderStance: 'gyeong', defenderStatus: { afterimage: 1 },
    }));
    expect(r.dodged).toBe(true);
    expect(r.hpLoss).toBe(0);
    expect(r.defenderStatus).toEqual({});
  });

  it('잔상이 없으면 방어자 상태는 그대로다', () => {
    const r = computeDamage(ctx({ defenderStatus: { poison: 3 } }));
    expect(r.dodged).toBe(false);
    expect(r.defenderStatus).toEqual({ poison: 3 });
  });
});

describe('경계값', () => {
  it('피해는 음수가 되지 않는다', () => {
    const r = computeDamage(ctx({ base: 0, attackerStatus: { weak: 1 } }));
    expect(r.amount).toBe(0);
    expect(r.hpLoss).toBe(0);
  });

  it('술수 공격은 상성 보정을 받지 않는다', () => {
    const r = computeDamage(ctx({ base: 10, attackerLine: 'sul', defenderStance: 'gyeong' }));
    expect(r.matchup).toBe('neutral');
    expect(r.amount).toBe(10);
  });
});
