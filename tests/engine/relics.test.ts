import { describe, it, expect } from 'vitest';
import { makeContentIndex } from '../../src/engine/content';
import { relicMods, triggerRelics } from '../../src/engine/relics';
import { startCombat, applyAction } from '../../src/engine/combat';
import { comboFires } from '../../src/engine/stance';
import type { RelicDef } from '../../src/engine/relics';
import type { CardDef } from '../../src/engine/types';
import type { EnemyDef } from '../../src/engine/enemies';

const RELICS: RelicDef[] = [
  { id: 'geungol', name: '근골', hanja: '筋', rarity: 'common', text: '최대 체력 +8', mods: { maxHp: 8 } },
  { id: 'gihae', name: '기해혈', hanja: '氣', rarity: 'rare', text: '최대 내공 +1', mods: { maxQi: 1 } },
  { id: 'jungnip', name: '낡은 죽립', hanja: '笠', rarity: 'common', text: '전투 시작 시 호신강기 5', mods: { startBlock: 5 } },
  { id: 'bongkyeol', name: '죽봉 매듭', hanja: '結', rarity: 'rare', text: '연계가 2장부터 발동', mods: { comboThreshold: -1 } },
  { id: 'bigeup', name: '반쪽 비급', hanja: '笈', rarity: 'common', text: '전투 시작 시 기세 2',
    triggers: [{ hook: 'onCombatStart', effects: [{ op: 'applyStatus', status: 'momentum', value: 2, target: 'self' }] }] },
  { id: 'horibyeong', name: '취선의 호리병', hanja: '瓢', rarity: 'common', text: '첫 턴에 내공 +2',
    triggers: [{ hook: 'onTurnStart', onlyTurn: 1, effects: [{ op: 'gainQi', value: 2 }] }] },
  { id: 'jumeoni', name: '넉넉한 주머니', hanja: '囊', rarity: 'common', text: '손패 +1', mods: { handSize: 1 } },
];

const CARDS: CardDef[] = [
  { id: 'byeokta', name: '벽타', hanja: '劈打', school: 'common', line: 'wai', cost: 1,
    rarity: 'basic', target: 'enemy', text: '6 피해', effects: [{ op: 'damage', value: 6 }] },
];

const ENEMIES: EnemyDef[] = [
  { id: 'dummy', name: '허수아비', hanja: '芻', hp: [60, 60], startStance: 'wai', tier: 'normal', act: 1,
    actions: [{ id: 'wait', kind: 'special', line: 'sul', label: '노려보기', weight: 1, value: 0, effects: [], maxInARow: 99 }] },
];

const content = makeContentIndex({ cards: CARDS, enemies: ENEMIES, relics: RELICS });

function setup(relics: string[]) {
  return {
    seed: 7, enemyIds: ['dummy'],
    player: { hp: 80, maxHp: 80, maxQi: 3, stance: 'wai' as const, relics },
    deck: Array.from({ length: 8 }, (_, i) => ({ uid: `u${i}`, defId: 'byeokta', upgraded: false })),
  };
}

describe('relicMods', () => {
  it('보정이 없으면 기본값이다', () => {
    expect(relicMods([], content)).toEqual({ maxHp: 0, maxQi: 0, handSize: 0, startBlock: 0, comboThreshold: 0 });
  });

  it('여러 기물의 보정이 합산된다', () => {
    const m = relicMods(['geungol', 'gihae', 'jungnip'], content);
    expect(m.maxHp).toBe(8);
    expect(m.maxQi).toBe(1);
    expect(m.startBlock).toBe(5);
  });

  it('알 수 없는 기물은 무시한다', () => {
    expect(() => relicMods(['없는것'], content)).not.toThrow();
  });
});

describe('전투 통합', () => {
  it('mods가 최대 체력·내공에 반영된다', () => {
    const s = startCombat(setup(['geungol', 'gihae']), content);
    expect(s.player.maxHp).toBe(88);
    expect(s.player.maxQi).toBe(4);
    expect(s.player.qi).toBe(4);
  });

  it('startBlock은 첫 턴 호신강기를 준다', () => {
    expect(startCombat(setup(['jungnip']), content).player.block).toBe(5);
  });

  it('onCombatStart 훅이 발동한다', () => {
    expect(startCombat(setup(['bigeup']), content).player.status.momentum).toBe(2);
  });

  it('onlyTurn 훅은 그 턴에만 발동한다', () => {
    let s = startCombat(setup(['horibyeong']), content);
    expect(s.player.qi).toBe(5);
    s = applyAction(s, { type: 'endTurn' }, content);
    expect(s.turn).toBe(2);
    expect(s.player.qi).toBe(3);
  });

  it('handSize 보정이 첫 손패 매수를 늘린다', () => {
    const s = startCombat(setup(['jumeoni']), content);
    expect(s.hand).toHaveLength(6);
  });

  it('comboThreshold 보정이 연계 발동 시점을 앞당긴다', () => {
    let s = startCombat(setup(['bongkyeol']), content);
    const hp0 = s.enemies[0]!.hp;
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    // 자세 외공 대 외공이라 보정 없음. 1번째 6, 2번째는 연계로 12
    expect(hp0 - s.enemies[0]!.hp).toBe(6 + 12);
  });
});

describe('comboFires 임계값 인자', () => {
  it('기본은 3', () => {
    expect(comboFires({ line: 'wai', count: 2 })).toBe(false);
    expect(comboFires({ line: 'wai', count: 3 })).toBe(true);
  });
  it('임계값을 낮출 수 있다', () => {
    expect(comboFires({ line: 'wai', count: 2 }, 2)).toBe(true);
  });
  // 참고: updateCombo는 line이 null이 아닌 한 count가 항상 1 이상이도록 보장하므로,
  // 아래 count: 0 입력은 정상 플레이에서는 나올 수 없다. 그래도 Math.max(1, threshold)
  // 클램프 자체를 직접 검증하려면 이렇게 인위적인 입력이 필요하다 — 클램프가 없다면
  // count(0) >= threshold(0)이 참이 되어 true가 반환됐을 것이다. 즉 이 클램프는
  // 방어적 코드일 뿐 실제 플레이 경로로는 도달하지 않는다는 사실을 여기 남겨 둔다.
  it('임계값은 1 아래로 내려가지 않는다 (클램프 자체를 검증)', () => {
    expect(comboFires({ line: 'wai', count: 0 }, 0)).toBe(false);
  });
});

describe('triggerRelics', () => {
  it('해당 훅의 기물만 발동한다', () => {
    const s = startCombat(setup(['bigeup']), content);
    const before = s.player.status.momentum ?? 0;
    expect(triggerRelics(s, 'onCombatEnd', content).player.status.momentum ?? 0).toBe(before);
  });
});
