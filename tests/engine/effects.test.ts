import { describe, it, expect } from 'vitest';
import { applyEffects, drawCards, comboBonusFor } from '../../src/engine/effects';
import type { CardInstance, CombatState, EffectAtom } from '../../src/engine/types';

function card(uid: string, defId = 'byeokta'): CardInstance {
  return { uid, defId, upgraded: false };
}

function baseState(over: Partial<CombatState> = {}): CombatState {
  return {
    rngState: 12345,
    turn: 1,
    phase: 'player',
    player: { hp: 80, maxHp: 80, qi: 3, maxQi: 3, block: 0, stance: 'wai', status: {}, relics: [] },
    enemies: [
      { uid: 'e1', defId: 'dog', name: '들개', hp: 20, maxHp: 20, block: 0,
        stance: 'gyeong', status: {}, intent: null, history: [] },
    ],
    draw: [card('c1'), card('c2'), card('c3')],
    hand: [],
    discard: [],
    exhaust: [],
    combo: { line: null, count: 0 },
    handSize: 5,
    keepBlock: false,
    log: [],
    ...over,
  };
}

const src = { line: 'wai' as const, targetUid: 'e1', comboBonus: 0 };

describe('damage', () => {
  it('대상 적의 체력을 깎는다', () => {
    const out = applyEffects(baseState(), [{ op: 'damage', value: 6 }], src);
    expect(out.enemies[0]!.hp).toBe(11); // 6 * 1.5 파훼 = 9
  });

  it('hits는 여러 번 때린다', () => {
    const out = applyEffects(baseState(), [{ op: 'damage', value: 4, hits: 3 }], src);
    expect(out.enemies[0]!.hp).toBe(2); // (4*1.5)=6, 3회 = 18
  });

  it('allEnemies는 전체를 때린다', () => {
    const s = baseState({
      enemies: [
        { uid: 'e1', defId: 'dog', name: '들개', hp: 20, maxHp: 20, block: 0, stance: 'wai', status: {}, intent: null, history: [] },
        { uid: 'e2', defId: 'dog', name: '들개', hp: 20, maxHp: 20, block: 0, stance: 'wai', status: {}, intent: null, history: [] },
      ],
    });
    const out = applyEffects(s, [{ op: 'damage', value: 5, target: 'allEnemies' }], src);
    expect(out.enemies.map((e) => e.hp)).toEqual([15, 15]);
  });

  it('연계 보너스가 피해에 반영된다', () => {
    const out = applyEffects(baseState(), [{ op: 'damage', value: 6 }], { ...src, comboBonus: 6 });
    expect(out.enemies[0]!.hp).toBe(2); // (6+6)*1.5 = 18
  });

  it('체력이 0 아래로 내려가지 않는다', () => {
    const out = applyEffects(baseState(), [{ op: 'damage', value: 99 }], src);
    expect(out.enemies[0]!.hp).toBe(0);
  });
});

describe('block · heal · qi', () => {
  it('block은 호신강기를 더한다', () => {
    expect(applyEffects(baseState(), [{ op: 'block', value: 5 }], src).player.block).toBe(5);
  });

  it('heal은 최대 체력을 넘지 않는다', () => {
    const s = baseState({ player: { ...baseState().player, hp: 75 } });
    expect(applyEffects(s, [{ op: 'heal', value: 10 }], src).player.hp).toBe(80);
  });

  it('gainQi는 내공을 더한다', () => {
    const s = baseState({ player: { ...baseState().player, qi: 1 } });
    expect(applyEffects(s, [{ op: 'gainQi', value: 2 }], src).player.qi).toBe(3);
  });

  it('loseBlock은 호신강기를 0으로 만든다', () => {
    const s = baseState({ player: { ...baseState().player, block: 12 } });
    expect(applyEffects(s, [{ op: 'loseBlock' }], src).player.block).toBe(0);
  });

  it('keepBlock은 플래그를 세운다', () => {
    expect(applyEffects(baseState(), [{ op: 'keepBlock' }], src).keepBlock).toBe(true);
  });
});

describe('applyStatus', () => {
  it('기본 대상은 적이다', () => {
    const out = applyEffects(baseState(), [{ op: 'applyStatus', status: 'poison', value: 3 }], src);
    expect(out.enemies[0]!.status.poison).toBe(3);
  });

  it('self 대상은 플레이어에게 건다', () => {
    const out = applyEffects(baseState(), [{ op: 'applyStatus', status: 'momentum', value: 2, target: 'self' }], src);
    expect(out.player.status.momentum).toBe(2);
  });
});

describe('draw', () => {
  it('뽑을 패에서 손으로 옮긴다', () => {
    const out = drawCards(baseState(), 2);
    expect(out.hand).toHaveLength(2);
    expect(out.draw).toHaveLength(1);
  });

  it('뽑을 패가 부족하면 버린 패를 섞어 채운다', () => {
    const s = baseState({ draw: [card('c1')], discard: [card('d1'), card('d2')] });
    const out = drawCards(s, 3);
    expect(out.hand).toHaveLength(3);
    expect(out.draw).toHaveLength(0);
    expect(out.discard).toHaveLength(0);
  });

  it('양쪽 다 비면 거기서 멈춘다', () => {
    const s = baseState({ draw: [card('c1')], discard: [] });
    const out = drawCards(s, 5);
    expect(out.hand).toHaveLength(1);
  });

  it('섞을 때 RNG state가 전진한다', () => {
    const s = baseState({ draw: [], discard: [card('d1'), card('d2')] });
    expect(drawCards(s, 1).rngState).not.toBe(s.rngState);
  });
});

describe('조건 효과', () => {
  it('ifCombo는 카운터가 임계 이상일 때만 실행된다', () => {
    const atoms: EffectAtom[] = [{ op: 'ifCombo', min: 3, then: [{ op: 'block', value: 9 }] }];
    const low = baseState({ combo: { line: 'wai', count: 2 } });
    const high = baseState({ combo: { line: 'wai', count: 3 } });
    expect(applyEffects(low, atoms, src).player.block).toBe(0);
    expect(applyEffects(high, atoms, src).player.block).toBe(9);
  });

  it('ifBreak는 대상 자세를 누를 때만 실행된다', () => {
    const atoms: EffectAtom[] = [{ op: 'ifBreak', then: [{ op: 'block', value: 7 }] }];
    const breaking = baseState(); // wai vs gyeong = 파훼
    const notBreaking = baseState({
      enemies: [{ ...baseState().enemies[0]!, stance: 'nae' }],
    });
    expect(applyEffects(breaking, atoms, src).player.block).toBe(7);
    expect(applyEffects(notBreaking, atoms, src).player.block).toBe(0);
  });
});

describe('counterStance', () => {
  it('적 자세를 누르는 계열로 내 자세를 바꾼다', () => {
    const s = baseState({ enemies: [{ ...baseState().enemies[0]!, stance: 'nae' }] });
    // 내공을 누르는 것은 경공
    expect(applyEffects(s, [{ op: 'counterStance' }], src).player.stance).toBe('gyeong');
  });
});

describe('연계 보너스 정의', () => {
  it('외공은 피해 +6', () => {
    expect(comboBonusFor('wai')).toEqual({ damageBonus: 6, extra: [] });
  });
  it('경공은 카드 1장', () => {
    expect(comboBonusFor('gyeong')).toEqual({ damageBonus: 0, extra: [{ op: 'draw', value: 1 }] });
  });
  it('내공은 호신강기 +5', () => {
    expect(comboBonusFor('nae')).toEqual({ damageBonus: 0, extra: [{ op: 'block', value: 5 }] });
  });
});
