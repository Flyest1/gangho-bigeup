// src/engine/content.ts
import type { EnemyDef } from './enemies';
import type { CardDef } from './types';

export interface ContentIndex {
  card(id: string): CardDef;
  enemy(id: string): EnemyDef;
  cards(): CardDef[];
  enemiesOf(act: number, tier: EnemyDef['tier']): EnemyDef[];
}

export function makeContentIndex(input: { cards: CardDef[]; enemies: EnemyDef[] }): ContentIndex {
  const cardMap = new Map(input.cards.map((c) => [c.id, c]));
  const enemyMap = new Map(input.enemies.map((e) => [e.id, e]));

  return {
    card(id) {
      const def = cardMap.get(id);
      if (!def) throw new Error(`알 수 없는 카드: ${id}`);
      return def;
    },
    enemy(id) {
      const def = enemyMap.get(id);
      if (!def) throw new Error(`알 수 없는 적: ${id}`);
      return def;
    },
    cards: () => [...cardMap.values()],
    enemiesOf: (act, tier) => input.enemies.filter((e) => e.act === act && e.tier === tier),
  };
}
