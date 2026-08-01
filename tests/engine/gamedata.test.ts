import { describe, it, expect } from 'vitest';
import { CONTENT, SCHOOLS } from '../../src/engine/gamedata';
import { startCombat, applyAction, effectiveCard } from '../../src/engine/combat';

describe('콘텐츠 분량', () => {
  it('카드가 60장이다', () => {
    expect(CONTENT.cards()).toHaveLength(60);
  });

  it('공용 20장 · 개방 40장', () => {
    const cards = CONTENT.cards();
    expect(cards.filter((c) => c.school === 'common')).toHaveLength(20);
    expect(cards.filter((c) => c.school === 'gaebang')).toHaveLength(40);
  });

  it('기물이 20종이다', () => {
    expect(CONTENT.relics()).toHaveLength(20);
  });

  it('적이 18종이다', () => {
    const all = [1, 2, 3].flatMap((act) =>
      (['normal', 'elite', 'boss'] as const).flatMap((tier) => CONTENT.enemiesOf(act, tier)));
    expect(all).toHaveLength(18);
  });

  it('막마다 일반 적 4종·정예 1종·보스 1종이 있다', () => {
    for (const act of [1, 2, 3]) {
      expect(CONTENT.enemiesOf(act, 'normal').length).toBeGreaterThanOrEqual(4);
      expect(CONTENT.enemiesOf(act, 'elite')).toHaveLength(1);
      expect(CONTENT.enemiesOf(act, 'boss')).toHaveLength(1);
    }
  });
});

describe('데이터 무결성', () => {
  it('카드 id가 중복되지 않는다', () => {
    const ids = CONTENT.cards().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('모든 카드가 효과를 하나 이상 가진다', () => {
    for (const c of CONTENT.cards()) expect(c.effects.length).toBeGreaterThan(0);
  });

  it('코스트가 0~3이다', () => {
    for (const c of CONTENT.cards()) {
      expect(c.cost).toBeGreaterThanOrEqual(0);
      expect(c.cost).toBeLessThanOrEqual(3);
    }
  });

  it('기본 등급 카드는 시작 덱에만 쓰인다', () => {
    const basics = CONTENT.cards().filter((c) => c.rarity === 'basic').map((c) => c.id);
    for (const id of basics) expect(SCHOOLS.gaebang.startingDeck).toContain(id);
  });

  it('강화 정의가 있으면 원본과 다르다', () => {
    for (const c of CONTENT.cards()) {
      if (!c.upgrade) continue;
      expect(effectiveCard(c, true)).not.toEqual(effectiveCard(c, false));
    }
  });
});

describe('문파', () => {
  it('개방 시작 덱이 10장이고 전부 실재하는 카드다', () => {
    expect(SCHOOLS.gaebang.startingDeck).toHaveLength(10);
    for (const id of SCHOOLS.gaebang.startingDeck) expect(() => CONTENT.card(id)).not.toThrow();
  });

  it('시작 기물이 실재한다', () => {
    expect(() => CONTENT.relic(SCHOOLS.gaebang.startingRelic)).not.toThrow();
  });

  it('개방은 외공 기반에 체력 80이다', () => {
    expect(SCHOOLS.gaebang.line).toBe('wai');
    expect(SCHOOLS.gaebang.maxHp).toBe(80);
  });
});

describe('실전 구동', () => {
  it('모든 카드를 실제 전투에서 낼 수 있다', () => {
    for (const card of CONTENT.cards()) {
      let s = startCombat({
        seed: 99,
        player: { hp: 200, maxHp: 200, maxQi: 9, stance: 'wai', relics: [] },
        enemyIds: ['deulgae', 'sanjeok'],
        deck: [{ uid: 'x', defId: card.id, upgraded: false }],
      }, CONTENT);
      expect(() => {
        s = applyAction(s, { type: 'playCard', uid: 'x', targetUid: 'e0' }, CONTENT);
      }).not.toThrow();
    }
  });

  it('모든 적이 실제로 행동한다', () => {
    for (const act of [1, 2, 3]) {
      for (const tier of ['normal', 'elite', 'boss'] as const) {
        for (const def of CONTENT.enemiesOf(act, tier)) {
          let s = startCombat({
            seed: 5,
            player: { hp: 500, maxHp: 500, maxQi: 3, stance: 'wai', relics: [] },
            enemyIds: [def.id],
            deck: Array.from({ length: 10 }, (_, i) => ({ uid: `d${i}`, defId: 'bangsin', upgraded: false })),
          }, CONTENT);
          expect(() => { for (let t = 0; t < 6; t++) s = applyAction(s, { type: 'endTurn' }, CONTENT); }).not.toThrow();
        }
      }
    }
  });

  it('모든 기물을 지고 전투를 시작할 수 있다', () => {
    for (const relic of CONTENT.relics()) {
      expect(() => startCombat({
        seed: 3,
        player: { hp: 80, maxHp: 80, maxQi: 3, stance: 'wai', relics: [relic.id] },
        enemyIds: ['deulgae'],
        deck: Array.from({ length: 10 }, (_, i) => ({ uid: `d${i}`, defId: 'byeokta', upgraded: false })),
      }, CONTENT)).not.toThrow();
    }
  });
});
