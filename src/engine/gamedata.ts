// src/engine/gamedata.ts
import cardsCommon from '../data/cards_common.json';
import cardsGaebang from '../data/cards_gaebang.json';
import enemies from '../data/enemies.json';
import relics from '../data/relics.json';
import schools from '../data/schools.json';
import { makeContentIndex, type ContentIndex } from './content';
import type { EnemyDef } from './enemies';
import type { RelicDef } from './relics';
import type { CardDef, Stance } from './types';

export interface SchoolDef {
  id: 'gaebang';
  name: string;
  hanja: string;
  line: Stance;
  maxHp: number;
  maxQi: number;
  startingDeck: string[];
  startingRelic: string;
}

export const SCHOOLS = schools as unknown as Record<'gaebang', SchoolDef>;

export const CONTENT: ContentIndex = makeContentIndex({
  cards: [...(cardsCommon as unknown as CardDef[]), ...(cardsGaebang as unknown as CardDef[])],
  enemies: enemies as unknown as EnemyDef[],
  relics: relics as unknown as RelicDef[],
});
