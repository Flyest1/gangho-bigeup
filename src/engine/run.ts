import { applyAction, startCombat, type CombatAction } from './combat';
import type { ContentIndex } from './content';
import { SCHOOLS } from './gamedata';
import { generateMap, nodeAt, type GameMap, type NodeType } from './map';
import { relicMods, triggerRelics } from './relics';
import { Rng, seedFrom } from './rng';
import type { CardInstance, CombatState, Rarity } from './types';

export type RunScreen = 'map' | 'combat' | 'reward' | 'rest' | 'shop' | 'result';

export interface ShopItem {
  kind: 'card' | 'relic' | 'remove';
  id: string;
  price: number;
}

export interface RewardState {
  gold: number;
  cards: string[];
  relic: string | null;
}

export interface RunState {
  version: 1;
  seedText: string;
  school: 'gaebang';
  act: number;
  map: GameMap;
  currentNodeId: string | null;
  screen: RunScreen;
  player: {
    hp: number;
    maxHp: number;
    gold: number;
    deck: CardInstance[];
    relics: string[];
  };
  combat: CombatState | null;
  reward: RewardState | null;
  shop: ShopItem[] | null;
  rngState: number;
  nextUid: number;
  result: 'ongoing' | 'victory' | 'defeat';
  stats: { floors: number; kills: number; elites: number };
}

export type RunAction =
  | { type: 'chooseNode'; nodeId: string }
  | { type: 'combat'; action: CombatAction }
  | { type: 'takeCard'; cardId: string | null }
  | { type: 'rest'; choice: 'heal' }
  | { type: 'rest'; choice: 'upgrade'; uid: string }
  | { type: 'buy'; index: number }
  | { type: 'leave' };

const REST_HEAL_RATIO = 0.3;

/**
 * 기물 보정을 포함한 실제 최대 체력.
 *
 * `run.player.maxHp` 는 문파 기본값만 담고, 기물의 maxHp 보정은 `startCombat` 이
 * 전투를 시작할 때마다 더한다. 그래서 전투 밖에서 `run.player.maxHp` 를 그대로 쓰면
 * 근골(+8)을 든 채로 88/80 같은 상태가 되고, 객잔에서 쉬면 회복은커녕 80으로 깎인다.
 * 전투 밖의 모든 계산과 화면 표시는 이 함수를 거쳐야 한다.
 */
export function effectiveMaxHp(run: RunState, content: ContentIndex): number {
  return run.player.maxHp + relicMods(run.player.relics, content).maxHp;
}

export function startRun(seedText: string, content: ContentIndex): RunState {
  const school = SCHOOLS.gaebang;
  const rng = new Rng(seedFrom(seedText));
  const map = generateMap(rng, 1);

  let nextUid = 0;
  const deck = school.startingDeck.map((defId) => ({
    uid: `c${nextUid++}`, defId, upgraded: false,
  }));

  return {
    version: 1,
    seedText,
    school: 'gaebang',
    act: 1,
    map,
    currentNodeId: null,
    screen: 'map',
    player: {
      hp: school.maxHp,
      maxHp: school.maxHp,
      gold: 0,
      deck,
      relics: [school.startingRelic],
    },
    combat: null,
    reward: null,
    shop: null,
    rngState: rng.state,
    nextUid,
    result: 'ongoing',
    stats: { floors: 0, kills: 0, elites: 0 },
  };
}

export function availableNodes(run: RunState): string[] {
  if (run.screen !== 'map') return [];
  if (run.currentNodeId === null) return [...run.map.layers[0]!];
  return [...nodeAt(run.map, run.currentNodeId).next];
}

function pickEnemies(rng: Rng, act: number, type: NodeType, content: ContentIndex): string[] {
  if (type === 'boss') return [content.enemiesOf(act, 'boss')[0]!.id];
  if (type === 'elite') return [content.enemiesOf(act, 'elite')[0]!.id];
  const pool = content.enemiesOf(act, 'normal');
  const count = rng.weighted([[1, 40], [2, 45], [3, 15]] as const);
  return Array.from({ length: count }, () => rng.pick(pool).id);
}

function rewardCards(rng: Rng, content: ContentIndex, school: 'gaebang'): string[] {
  const pool = content.cards().filter(
    (c) => c.rarity !== 'basic' && (c.school === 'common' || c.school === school),
  );
  const picked: string[] = [];
  const weights: Record<Rarity, number> = { basic: 0, common: 70, rare: 25, ultra: 5 };
  while (picked.length < 3) {
    const candidates = pool.filter((c) => !picked.includes(c.id));
    const chosen = rng.weighted(candidates.map((c) => [c.id, weights[c.rarity]] as const));
    picked.push(chosen);
  }
  return picked;
}

function pickRelic(rng: Rng, owned: string[], content: ContentIndex): string | null {
  const pool = content.relics().filter((r) => !owned.includes(r.id));
  return pool.length === 0 ? null : rng.pick(pool).id;
}

function makeShop(rng: Rng, run: RunState, content: ContentIndex): ShopItem[] {
  const cards = rewardCards(rng, content, run.school);
  const items: ShopItem[] = cards.map((id) => ({
    kind: 'card' as const, id, price: rng.range(45, 70),
  }));
  const relic = pickRelic(rng, run.player.relics, content);
  if (relic) items.push({ kind: 'relic', id: relic, price: rng.range(140, 180) });
  items.push({ kind: 'remove', id: 'remove', price: 70 });
  return items;
}

function enterNode(run: RunState, nodeId: string, content: ContentIndex): RunState {
  const node = nodeAt(run.map, nodeId);
  const rng = new Rng(run.rngState);
  const base: RunState = {
    ...run,
    currentNodeId: nodeId,
    stats: { ...run.stats, floors: run.stats.floors + 1 },
  };

  if (node.type === 'rest') {
    return { ...base, screen: 'rest', rngState: rng.state };
  }
  if (node.type === 'shop') {
    const shop = makeShop(rng, base, content);
    return { ...base, screen: 'shop', shop, rngState: rng.state };
  }

  const school = SCHOOLS[run.school];
  const combat = startCombat({
    seed: rng.int(0x7fffffff),
    player: {
      hp: run.player.hp,
      maxHp: run.player.maxHp,
      maxQi: school.maxQi,
      stance: school.line,
      relics: run.player.relics,
    },
    enemyIds: pickEnemies(rng, run.act, node.type, content),
    deck: run.player.deck,
  }, content);

  return { ...base, screen: 'combat', combat, rngState: rng.state };
}

function finishCombat(run: RunState, combat: CombatState, content: ContentIndex): RunState {
  const node = nodeAt(run.map, run.currentNodeId!);

  if (combat.phase === 'lost') {
    return {
      ...run, combat: null, screen: 'result', result: 'defeat',
      player: { ...run.player, hp: 0 },
    };
  }

  const settled = triggerRelics(combat, 'onCombatEnd', content);
  const rng = new Rng(run.rngState);
  const goldRange: [number, number] =
    node.type === 'boss' ? [40, 60] : node.type === 'elite' ? [25, 35] : [10, 20];

  const reward: RewardState = {
    gold: rng.range(goldRange[0], goldRange[1]),
    cards: rewardCards(rng, content, run.school),
    relic: node.type === 'elite' || node.type === 'boss'
      ? pickRelic(rng, run.player.relics, content)
      : null,
  };

  return {
    ...run,
    combat: null,
    screen: 'reward',
    reward,
    rngState: rng.state,
    player: { ...run.player, hp: settled.player.hp },
    stats: {
      ...run.stats,
      kills: run.stats.kills + 1,
      elites: run.stats.elites + (node.type === 'elite' ? 1 : 0),
    },
  };
}

function leaveReward(run: RunState, cardId: string | null, content: ContentIndex): RunState {
  const reward = run.reward;
  if (!reward) return run;

  let nextUid = run.nextUid;
  const deck = cardId
    ? [...run.player.deck, { uid: `c${nextUid++}`, defId: cardId, upgraded: false }]
    : run.player.deck;

  const relics = reward.relic ? [...run.player.relics, reward.relic] : run.player.relics;
  const grown = {
    ...run,
    nextUid,
    reward: null,
    player: { ...run.player, gold: run.player.gold + reward.gold, deck, relics },
  };

  const node = nodeAt(run.map, run.currentNodeId!);
  if (node.type !== 'boss') return { ...grown, screen: 'map' };

  if (run.act >= 3) return { ...grown, screen: 'result', result: 'victory' };

  const rng = new Rng(grown.rngState);
  return {
    ...grown,
    act: run.act + 1,
    map: generateMap(rng, run.act + 1),
    currentNodeId: null,
    screen: 'map',
    rngState: rng.state,
  };
}

export function applyRunAction(
  run: RunState, action: RunAction, content: ContentIndex,
): RunState {
  if (run.result !== 'ongoing') return run;

  switch (action.type) {
    case 'chooseNode': {
      if (run.screen !== 'map') return run;
      if (!availableNodes(run).includes(action.nodeId)) return run;
      return enterNode(run, action.nodeId, content);
    }

    case 'combat': {
      if (run.screen !== 'combat' || !run.combat) return run;
      const combat = applyAction(run.combat, action.action, content);
      if (combat.phase === 'won' || combat.phase === 'lost') {
        return finishCombat(run, combat, content);
      }
      return { ...run, combat };
    }

    case 'takeCard': {
      if (run.screen !== 'reward') return run;
      if (action.cardId !== null && !run.reward?.cards.includes(action.cardId)) return run;
      return leaveReward(run, action.cardId, content);
    }

    case 'rest': {
      if (run.screen !== 'rest') return run;
      if (action.choice === 'heal') {
        const cap = effectiveMaxHp(run, content);
        const heal = Math.floor(cap * REST_HEAL_RATIO);
        return {
          ...run, screen: 'map',
          player: { ...run.player, hp: Math.min(cap, run.player.hp + heal) },
        };
      }
      const card = run.player.deck.find((c) => c.uid === action.uid);
      if (!card || card.upgraded || !content.card(card.defId).upgrade) return run;
      return {
        ...run, screen: 'map',
        player: {
          ...run.player,
          deck: run.player.deck.map((c) => (c.uid === action.uid ? { ...c, upgraded: true } : c)),
        },
      };
    }

    case 'buy': {
      if (run.screen !== 'shop' || !run.shop) return run;
      const item = run.shop[action.index];
      if (!item || run.player.gold < item.price) return run;

      const shop = run.shop.filter((_, i) => i !== action.index);
      const gold = run.player.gold - item.price;

      if (item.kind === 'card') {
        let nextUid = run.nextUid;
        return {
          ...run, shop, nextUid: nextUid + 1,
          player: {
            ...run.player, gold,
            deck: [...run.player.deck, { uid: `c${nextUid}`, defId: item.id, upgraded: false }],
          },
        };
      }
      if (item.kind === 'relic') {
        return { ...run, shop, player: { ...run.player, gold, relics: [...run.player.relics, item.id] } };
      }
      return { ...run, shop, player: { ...run.player, gold } };
    }

    case 'leave':
      return run.screen === 'shop' ? { ...run, screen: 'map', shop: null } : run;
  }
}
