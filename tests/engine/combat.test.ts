import { describe, it, expect } from 'vitest';
import { makeContentIndex } from '../../src/engine/content';
import { startCombat, applyAction, canPlay, effectiveCard } from '../../src/engine/combat';
import type { CombatSetup } from '../../src/engine/combat';
import type { CardDef, CardInstance, CombatState } from '../../src/engine/types';
import type { EnemyDef } from '../../src/engine/enemies';

const CARDS: CardDef[] = [
  { id: 'byeokta', name: '벽타', hanja: '劈打', school: 'common', line: 'wai', cost: 1,
    rarity: 'basic', target: 'enemy', text: '6 피해', effects: [{ op: 'damage', value: 6 }] },
  { id: 'bangsin', name: '방신', hanja: '防身', school: 'common', line: 'nae', cost: 1,
    rarity: 'basic', target: 'self', text: '호신강기 5', effects: [{ op: 'block', value: 5 }],
    upgrade: { cost: 1, effects: [{ op: 'block', value: 8 }] } },
  { id: 'hoheup', name: '호흡', hanja: '呼吸', school: 'common', line: 'sul', cost: 0,
    rarity: 'common', target: 'self', text: '내공 +1, 카드 1장. 소멸',
    effects: [{ op: 'gainQi', value: 1 }, { op: 'draw', value: 1 }], exhaust: true },
];

const ENEMIES: EnemyDef[] = [
  { id: 'dummy', name: '허수아비', hanja: '芻', hp: [60, 60], startStance: 'gyeong',
    tier: 'normal', act: 1,
    actions: [
      { id: 'poke', kind: 'attack', line: 'gyeong', label: '찌르기', weight: 1, value: 5,
        effects: [{ op: 'damage', value: 5 }], maxInARow: 99 },
    ] },
  { id: 'turtle', name: '철갑귀', hanja: '龜', hp: [40, 40], startStance: 'wai',
    tier: 'normal', act: 1,
    actions: [
      { id: 'guard', kind: 'defend', line: 'nae', label: '움츠리기', weight: 1, value: 8,
        effects: [{ op: 'block', value: 8 }], maxInARow: 99 },
    ] },
];

const content = makeContentIndex({ cards: CARDS, enemies: ENEMIES, relics: [] });

function deck(...ids: string[]): CardInstance[] {
  return ids.map((defId, i) => ({ uid: `u${i}`, defId, upgraded: false }));
}

function setup(over: Partial<CombatSetup> = {}): CombatSetup {
  return {
    seed: 4242,
    player: { hp: 80, maxHp: 80, maxQi: 3, stance: 'wai', relics: [] },
    enemyIds: ['dummy'],
    deck: deck('byeokta', 'byeokta', 'byeokta', 'bangsin', 'bangsin', 'hoheup'),
    ...over,
  };
}

function handUidOf(s: CombatState, defId: string): string {
  const found = s.hand.find((c) => c.defId === defId);
  if (!found) throw new Error(`손에 ${defId} 없음`);
  return found.uid;
}

describe('startCombat', () => {
  it('첫 턴에 손패를 채우고 내공을 준다', () => {
    const s = startCombat(setup(), content);
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('player');
    expect(s.hand).toHaveLength(5);
    expect(s.draw).toHaveLength(1);
    expect(s.player.qi).toBe(3);
    expect(s.player.stance).toBe('wai');
  });

  it('적이 첫 의도를 이미 가지고 있다', () => {
    const s = startCombat(setup(), content);
    expect(s.enemies[0]!.intent).not.toBeNull();
    expect(s.enemies[0]!.intent!.line).toBe('gyeong');
  });

  it('같은 시드는 같은 초기 상태를 만든다', () => {
    expect(startCombat(setup(), content)).toEqual(startCombat(setup(), content));
  });
});

describe('playCard', () => {
  it('내공을 소비하고 손에서 버린 패로 간다', () => {
    const s0 = startCombat(setup(), content);
    const uid = handUidOf(s0, 'byeokta');
    const s1 = applyAction(s0, { type: 'playCard', uid, targetUid: 'e0' }, content);
    expect(s1.player.qi).toBe(2);
    expect(s1.hand.find((c) => c.uid === uid)).toBeUndefined();
    expect(s1.discard.some((c) => c.uid === uid)).toBe(true);
  });

  it('자세가 카드 계열로 바뀐다', () => {
    const s0 = startCombat(setup(), content);
    const s1 = applyAction(s0, { type: 'playCard', uid: handUidOf(s0, 'bangsin') }, content);
    expect(s1.player.stance).toBe('nae');
  });

  it('술수 카드는 자세를 바꾸지 않고 소멸한다', () => {
    const s0 = startCombat(setup({ deck: deck('hoheup', 'byeokta', 'byeokta', 'byeokta', 'byeokta') }), content);
    const uid = handUidOf(s0, 'hoheup');
    const s1 = applyAction(s0, { type: 'playCard', uid }, content);
    expect(s1.player.stance).toBe('wai');
    expect(s1.exhaust.some((c) => c.uid === uid)).toBe(true);
    expect(s1.discard.some((c) => c.uid === uid)).toBe(false);
  });

  it('외공 3연타에서 연계 보너스가 붙는다', () => {
    let s = startCombat(setup({ deck: deck('byeokta', 'byeokta', 'byeokta', 'byeokta', 'byeokta') }), content);
    const hp0 = s.enemies[0]!.hp;
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    const after1 = hp0 - s.enemies[0]!.hp;
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    const total = hp0 - s.enemies[0]!.hp;
    // 1·2번째는 (6)*1.5=9, 3번째는 (6+6)*1.5=18
    expect(after1).toBe(9);
    expect(total).toBe(9 + 9 + 18);
    expect(s.combo).toEqual({ line: 'wai', count: 3 });
  });

  it('내공은 부족하면 낼 수 없다', () => {
    let s = startCombat(setup({ deck: deck('byeokta', 'byeokta', 'byeokta', 'byeokta', 'byeokta') }), content);
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    expect(s.player.qi).toBe(0);
    expect(canPlay(s, s.hand[0]!.uid, content)).toBe(false);
    const blocked = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    expect(blocked).toBe(s);
  });

  it('손에 없는 카드는 무시된다', () => {
    const s = startCombat(setup(), content);
    expect(applyAction(s, { type: 'playCard', uid: 'nope' }, content)).toBe(s);
  });
});

describe('턴 전환', () => {
  it('턴 종료 시 손패를 버리고 적이 행동한 뒤 새 손패를 받는다', () => {
    const s0 = startCombat(setup(), content);
    const s1 = applyAction(s0, { type: 'endTurn' }, content);
    expect(s1.turn).toBe(2);
    expect(s1.phase).toBe('player');
    expect(s1.hand).toHaveLength(5);
    expect(s1.player.qi).toBe(3);
    expect(s1.player.hp).toBeLessThan(80); // 허수아비가 때린다
  });

  it('적의 자세가 실행한 행동의 계열로 바뀐다', () => {
    const s = applyAction(startCombat(setup({ enemyIds: ['turtle'] }), content), { type: 'endTurn' }, content);
    expect(s.enemies[0]!.stance).toBe('nae');
    expect(s.enemies[0]!.block).toBe(8);
  });

  it('플레이어 턴 시작에 호신강기가 사라진다', () => {
    let s = startCombat(setup(), content);
    s = applyAction(s, { type: 'playCard', uid: handUidOf(s, 'bangsin') }, content);
    expect(s.player.block).toBe(5);
    s = applyAction(s, { type: 'endTurn' }, content);
    expect(s.player.block).toBe(0);
  });

  it('적 공격에도 상성이 적용된다', () => {
    // 플레이어 자세 내공, 적 경공 공격 5 → 경공▶내공 이므로 파훼 7
    let s = startCombat(setup(), content);
    s = applyAction(s, { type: 'playCard', uid: handUidOf(s, 'bangsin') }, content);
    const hp = s.player.hp;
    s = applyAction(s, { type: 'endTurn' }, content);
    expect(hp - s.player.hp).toBe(7);
  });

  it('중독은 턴 시작에 호신강기를 무시하고 체력을 깎는다', () => {
    let s = startCombat(setup(), content);
    s = { ...s, player: { ...s.player, status: { poison: 3 }, block: 50 } };
    const hp = s.player.hp;
    s = applyAction(s, { type: 'endTurn' }, content);
    expect(s.player.status.poison).toBe(2);
    expect(hp - s.player.hp).toBeGreaterThanOrEqual(3);
  });

  it('내상은 다음 턴 내공을 줄이고 사라진다', () => {
    let s = startCombat(setup(), content);
    s = { ...s, player: { ...s.player, status: { naesang: 2 } } };
    s = applyAction(s, { type: 'endTurn' }, content);
    expect(s.player.qi).toBe(1);
    expect(s.player.status.naesang).toBeUndefined();
  });
});

describe('승패', () => {
  it('적이 전부 쓰러지면 won', () => {
    let s = startCombat(setup(), content);
    s = { ...s, enemies: [{ ...s.enemies[0]!, hp: 1 }] };
    s = applyAction(s, { type: 'playCard', uid: handUidOf(s, 'byeokta'), targetUid: 'e0' }, content);
    expect(s.phase).toBe('won');
  });

  it('체력이 0이 되면 lost', () => {
    let s = startCombat(setup(), content);
    s = { ...s, player: { ...s.player, hp: 3 } };
    s = applyAction(s, { type: 'endTurn' }, content);
    expect(s.phase).toBe('lost');
  });

  it('전투가 끝나면 더 이상 액션을 받지 않는다', () => {
    let s = startCombat(setup(), content);
    s = { ...s, phase: 'won' };
    expect(applyAction(s, { type: 'endTurn' }, content)).toBe(s);
  });
});

describe('불변성과 재현성', () => {
  it('applyAction은 입력 상태를 변경하지 않는다', () => {
    const s = startCombat(setup(), content);
    const snapshot = structuredClone(s);

    applyAction(s, { type: 'playCard', uid: handUidOf(s, 'byeokta'), targetUid: 'e0' }, content);
    expect(s).toEqual(snapshot);

    applyAction(s, { type: 'endTurn' }, content);
    expect(s).toEqual(snapshot);
  });

  it('같은 시드로 카드 발동과 턴 종료를 3턴 재생하면 두 번 다 같은 상태가 나온다', () => {
    function play(): CombatState {
      let s = startCombat(setup(), content);
      s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
      s = applyAction(s, { type: 'endTurn' }, content);
      s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
      s = applyAction(s, { type: 'endTurn' }, content);
      s = applyAction(s, { type: 'endTurn' }, content);
      return s;
    }

    expect(play()).toEqual(play());
  });
});

describe('강화', () => {
  it('effectiveCard는 강화 효과로 대체한다', () => {
    const base = content.card('bangsin');
    expect(effectiveCard(base, false).effects).toEqual([{ op: 'block', value: 5 }]);
    expect(effectiveCard(base, true).effects).toEqual([{ op: 'block', value: 8 }]);
  });

  it('강화 정의가 없으면 원본 그대로다', () => {
    const base = content.card('byeokta');
    expect(effectiveCard(base, true)).toEqual(base);
  });
});
