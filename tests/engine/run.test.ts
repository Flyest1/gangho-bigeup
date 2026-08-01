import { describe, it, expect } from 'vitest';
import { startRun, applyRunAction, availableNodes } from '../../src/engine/run';
import { CONTENT } from '../../src/engine/gamedata';
import { nodeAt } from '../../src/engine/map';
import type { RunState } from '../../src/engine/run';

function run0(seed = '개방행'): RunState {
  return startRun(seed, CONTENT);
}

/** 전투가 끝날 때까지 턴만 넘긴다. */
function grind(run: RunState, maxTurns = 60): RunState {
  let s = run;
  for (let i = 0; i < maxTurns && s.screen === 'combat'; i++) {
    s = applyRunAction(s, { type: 'combat', action: { type: 'endTurn' } }, CONTENT);
  }
  return s;
}

describe('런 시작', () => {
  it('1막 맵과 개방 시작 덱으로 시작한다', () => {
    const r = run0();
    expect(r.act).toBe(1);
    expect(r.screen).toBe('map');
    expect(r.player.deck).toHaveLength(10);
    expect(r.player.maxHp).toBe(80);
    expect(r.player.hp).toBe(80);
    expect(r.result).toBe('ongoing');
  });

  it('시작 기물을 가지고 시작한다', () => {
    expect(run0().player.relics).toEqual(['banjjok_bigeup']);
  });

  it('덱의 카드마다 uid가 다르다', () => {
    const uids = run0().player.deck.map((c) => c.uid);
    expect(new Set(uids).size).toBe(uids.length);
  });

  it('같은 시드는 같은 런을 만든다', () => {
    expect(run0('고정')).toEqual(run0('고정'));
  });

  it('처음 고를 수 있는 노드는 0층 하나뿐이다', () => {
    const r = run0();
    expect(availableNodes(r)).toEqual([r.map.layers[0]![0]!]);
  });
});

describe('노드 진입', () => {
  it('격전 노드에 들어가면 전투가 시작된다', () => {
    const r = applyRunAction(run0(), { type: 'chooseNode', nodeId: run0().map.layers[0]![0]! }, CONTENT);
    expect(r.screen).toBe('combat');
    expect(r.combat).not.toBeNull();
    expect(r.combat!.enemies.length).toBeGreaterThan(0);
  });

  it('갈 수 없는 노드는 무시된다', () => {
    const r = run0();
    const far = r.map.layers[3]![0]!;
    expect(applyRunAction(r, { type: 'chooseNode', nodeId: far }, CONTENT)).toBe(r);
  });

  it('전투에 이기면 보상 화면으로 간다', () => {
    let r = applyRunAction(run0(), { type: 'chooseNode', nodeId: run0().map.layers[0]![0]! }, CONTENT);
    r = { ...r, combat: { ...r.combat!, enemies: r.combat!.enemies.map((e) => ({ ...e, hp: 1 })) } };
    r = applyRunAction(r, { type: 'combat', action: { type: 'playCard', uid: r.combat!.hand[0]!.uid, targetUid: 'e0' } }, CONTENT);
    r = grind(r);
    expect(r.screen).toBe('reward');
    expect(r.reward!.gold).toBeGreaterThan(0);
    expect(r.reward!.cards).toHaveLength(3);
  });

  it('전투에 지면 패배로 끝난다', () => {
    let r = applyRunAction(run0(), { type: 'chooseNode', nodeId: run0().map.layers[0]![0]! }, CONTENT);
    r = { ...r, combat: { ...r.combat!, player: { ...r.combat!.player, hp: 1 } } };
    r = grind(r);
    expect(r.result).toBe('defeat');
    expect(r.screen).toBe('result');
  });
});

describe('기물 훅', () => {
  it('마른 육포를 지니고 있으면 전투가 끝날 때 체력을 6 회복한다', () => {
    let r = run0();
    r = { ...r, player: { ...r.player, relics: ['yukpo'] } };
    r = applyRunAction(r, { type: 'chooseNode', nodeId: r.map.layers[0]![0]! }, CONTENT);

    // 적을 한 마리·체력 1로 줄이고, 전투 중 체력을 50으로 강제해 둔다.
    // 이 상태에서 공격 초식 한 장이면 적 턴이 한 번도 돌기 전에 즉시 승리하므로,
    // 회복 훅이 발동하기 직전 체력이 정확히 50으로 고정된다.
    const enemy = r.combat!.enemies[0]!;
    r = {
      ...r,
      combat: {
        ...r.combat!,
        player: { ...r.combat!.player, hp: 50 },
        enemies: [{ ...enemy, hp: 1 }],
      },
    };

    const attackCard = r.combat!.hand.find((c) => CONTENT.card(c.defId).target === 'enemy')!;
    r = applyRunAction(
      r,
      { type: 'combat', action: { type: 'playCard', uid: attackCard.uid, targetUid: enemy.uid } },
      CONTENT,
    );

    expect(r.screen).toBe('reward');
    expect(r.player.hp).toBe(56);
  });
});

describe('보상', () => {
  function toReward(): RunState {
    let r = applyRunAction(run0(), { type: 'chooseNode', nodeId: run0().map.layers[0]![0]! }, CONTENT);
    r = { ...r, combat: { ...r.combat!, enemies: r.combat!.enemies.map((e) => ({ ...e, hp: 0 })) } };
    return applyRunAction(r, { type: 'combat', action: { type: 'endTurn' } }, CONTENT);
  }

  it('보상 초식 3장은 서로 다르고 기본 등급이 아니다', () => {
    const r = toReward();
    expect(new Set(r.reward!.cards).size).toBe(3);
    for (const id of r.reward!.cards) expect(CONTENT.card(id).rarity).not.toBe('basic');
  });

  it('초식을 고르면 덱에 들어가고 맵으로 돌아간다', () => {
    const r0 = toReward();
    const pick = r0.reward!.cards[0]!;
    const r = applyRunAction(r0, { type: 'takeCard', cardId: pick }, CONTENT);
    expect(r.player.deck).toHaveLength(11);
    expect(r.player.deck.some((c) => c.defId === pick)).toBe(true);
    expect(r.screen).toBe('map');
  });

  it('넘기면 덱이 그대로다', () => {
    const r = applyRunAction(toReward(), { type: 'takeCard', cardId: null }, CONTENT);
    expect(r.player.deck).toHaveLength(10);
    expect(r.screen).toBe('map');
  });

  it('엽전이 지급된다', () => {
    const r0 = toReward();
    const r = applyRunAction(r0, { type: 'takeCard', cardId: null }, CONTENT);
    expect(r.player.gold).toBe(r0.reward!.gold);
  });
});

describe('객잔', () => {
  function toRest(): RunState {
    const r = run0();
    const restId = r.map.layers[4]![0]!;
    return { ...r, currentNodeId: restId, screen: 'rest', player: { ...r.player, hp: 40 } };
  }

  it('휴식은 최대 체력의 30%를 회복한다', () => {
    const r = applyRunAction(toRest(), { type: 'rest', choice: 'heal' }, CONTENT);
    expect(r.player.hp).toBe(64);
    expect(r.screen).toBe('map');
  });

  it('회복은 최대 체력을 넘지 않는다', () => {
    const base = toRest();
    const r = applyRunAction({ ...base, player: { ...base.player, hp: 78 } }, { type: 'rest', choice: 'heal' }, CONTENT);
    expect(r.player.hp).toBe(80);
  });

  it('수련은 초식 1장을 강화한다', () => {
    const base = toRest();
    const uid = base.player.deck.find((c) => CONTENT.card(c.defId).upgrade)!.uid;
    const r = applyRunAction(base, { type: 'rest', choice: 'upgrade', uid }, CONTENT);
    expect(r.player.deck.find((c) => c.uid === uid)!.upgraded).toBe(true);
    expect(r.screen).toBe('map');
  });

  it('이미 강화된 카드는 다시 강화되지 않는다', () => {
    const base = toRest();
    const uid = base.player.deck[0]!.uid;
    const once = applyRunAction(base, { type: 'rest', choice: 'upgrade', uid }, CONTENT);
    expect(applyRunAction({ ...once, screen: 'rest' }, { type: 'rest', choice: 'upgrade', uid }, CONTENT).screen).toBe('rest');
  });

  it('근골(최대 체력 +8)을 지니면 88을 기준으로 회복하고, 80으로 깎이지 않는다', () => {
    const base = toRest();
    const s: RunState = {
      ...base,
      player: { ...base.player, hp: 50, relics: [...base.player.relics, 'geungol'] },
    };
    const r = applyRunAction(s, { type: 'rest', choice: 'heal' }, CONTENT);
    // 실효 최대 체력 = 80 + 8 = 88. 회복량 = floor(88 * 0.3) = 26. 50 + 26 = 76 ≤ 88.
    expect(r.player.hp).toBe(76);
  });
});

describe('장터', () => {
  it('장터 노드에 들어가면 초식 3·기물 1·제거 1이 진열된다', () => {
    for (let i = 0; i < 300; i++) {
      const r = startRun(`장터${i}`, CONTENT);
      const first = r.map.layers[0]![0]!;
      const shopId = nodeAt(r.map, first).next.find((id) => nodeAt(r.map, id).type === 'shop');
      if (!shopId) continue;

      const s = applyRunAction({ ...r, currentNodeId: first }, { type: 'chooseNode', nodeId: shopId }, CONTENT);
      expect(s.screen).toBe('shop');
      expect(s.shop!.filter((x) => x.kind === 'card')).toHaveLength(3);
      expect(s.shop!.filter((x) => x.kind === 'relic')).toHaveLength(1);
      expect(s.shop!.filter((x) => x.kind === 'remove')).toHaveLength(1);
      return;
    }
    throw new Error('300개 시드에서 1층 장터를 찾지 못했다');
  });

  it('구매하면 엽전이 줄고 물건이 사라진다', () => {
    const r = run0();
    const shop = [
      { kind: 'card' as const, id: 'gangsu', price: 50 },
      { kind: 'relic' as const, id: 'geungol', price: 150 },
    ];
    const s: RunState = { ...r, screen: 'shop', shop, player: { ...r.player, gold: 300 } };
    const after = applyRunAction(s, { type: 'buy', index: 0 }, CONTENT);
    expect(after.player.gold).toBe(250);
    expect(after.shop).toHaveLength(1);
    expect(after.player.deck).toHaveLength(11);
  });

  it('엽전이 모자라면 살 수 없다', () => {
    const r = run0();
    const s: RunState = {
      ...r, screen: 'shop', player: { ...r.player, gold: 10 },
      shop: [{ kind: 'card', id: 'gangsu', price: 50 }],
    };
    expect(applyRunAction(s, { type: 'buy', index: 0 }, CONTENT)).toBe(s);
  });

  it('나가면 맵으로 돌아간다', () => {
    const r = run0();
    const s: RunState = { ...r, screen: 'shop', shop: [] };
    expect(applyRunAction(s, { type: 'leave' }, CONTENT).screen).toBe('map');
  });
});

describe('막 진행', () => {
  it('관문을 이기면 다음 막으로 넘어간다', () => {
    const r = run0();
    const bossId = r.map.layers[5]![0]!;
    let s: RunState = { ...r, currentNodeId: bossId, screen: 'reward', reward: { gold: 50, cards: [], relic: null } };
    s = applyRunAction(s, { type: 'takeCard', cardId: null }, CONTENT);
    expect(s.act).toBe(2);
    expect(s.currentNodeId).toBeNull();
    expect(nodeAt(s.map, s.map.layers[0]![0]!).type).toBe('battle');
  });

  it('3막 관문을 이기면 완주다', () => {
    const r = run0();
    const s0: RunState = {
      ...r, act: 3, currentNodeId: r.map.layers[5]![0]!,
      screen: 'reward', reward: { gold: 50, cards: [], relic: null },
    };
    const s = applyRunAction(s0, { type: 'takeCard', cardId: null }, CONTENT);
    expect(s.result).toBe('victory');
    expect(s.screen).toBe('result');
  });
});

describe('카드 제거', () => {
  it('제거 항목을 사면 제거 대기 상태가 된다', () => {
    const r = startRun('제거', CONTENT);
    const s = { ...r, screen: 'shop' as const, player: { ...r.player, gold: 200 },
      shop: [{ kind: 'remove' as const, id: 'remove', price: 70 }] };
    const after = applyRunAction(s, { type: 'buy', index: 0 }, CONTENT);
    expect(after.pendingRemoval).toBe(true);
    expect(after.player.gold).toBe(130);
  });

  it('대기 상태에서만 카드가 지워진다', () => {
    const r = startRun('제거2', CONTENT);
    const uid = r.player.deck[0]!.uid;
    expect(applyRunAction(r, { type: 'removeCard', uid }, CONTENT).player.deck).toHaveLength(10);
    const armed = { ...r, screen: 'shop' as const, pendingRemoval: true };
    const done = applyRunAction(armed, { type: 'removeCard', uid }, CONTENT);
    expect(done.player.deck).toHaveLength(9);
    expect(done.pendingRemoval).toBe(false);
  });

  it('덱이 1장이면 지울 수 없다', () => {
    const r = startRun('제거3', CONTENT);
    const one = { ...r, screen: 'shop' as const, pendingRemoval: true,
      player: { ...r.player, deck: r.player.deck.slice(0, 1) } };
    expect(applyRunAction(one, { type: 'removeCard', uid: one.player.deck[0]!.uid }, CONTENT).player.deck).toHaveLength(1);
  });
});

describe('결정성', () => {
  it('같은 시드에 같은 액션 열은 같은 결과를 낸다', () => {
    const play = (): RunState => {
      let s = startRun('재현', CONTENT);
      s = applyRunAction(s, { type: 'chooseNode', nodeId: s.map.layers[0]![0]! }, CONTENT);
      return grind(s);
    };
    expect(play()).toEqual(play());
  });

  it('노드에 진입하면 rngState가 반드시 바뀐다', () => {
    // 재현성은 "같은 입력 → 같은 결과"만으로는 지켜지지 않는다. rngState 를 소비하고도
    // 되돌려 쓰지 않는 경로가 있으면, 시드를 재생해도 항상 같은 값에 머물러 있을 뿐이라
    // 위 테스트는 통과해 버린다. rngState 가 실제로 전진했는지를 직접 검사해야 그 구멍을 잡는다.
    const r0 = run0();
    const r1 = applyRunAction(r0, { type: 'chooseNode', nodeId: r0.map.layers[0]![0]! }, CONTENT);
    expect(r1.rngState).not.toBe(r0.rngState);
  });

  it('전투가 끝나 보상이 계산되면 rngState가 반드시 바뀐다', () => {
    // 보상(엽전·초식 3장·기물)은 전투가 끝나는 바로 그 액션(finishCombat) 안에서
    // 계산된다 — 이후의 takeCard 는 관문이 아닌 한 rng 를 건드리지 않는다. 그래서
    // rngState 전진 여부는 반드시 이 전환 시점에서 검사해야 한다.
    const r0 = applyRunAction(run0(), { type: 'chooseNode', nodeId: run0().map.layers[0]![0]! }, CONTENT);
    const beforeReward = { ...r0, combat: { ...r0.combat!, enemies: r0.combat!.enemies.map((e) => ({ ...e, hp: 0 })) } };
    const rewardState = applyRunAction(beforeReward, { type: 'combat', action: { type: 'endTurn' } }, CONTENT);
    expect(rewardState.rngState).not.toBe(beforeReward.rngState);
  });
});
