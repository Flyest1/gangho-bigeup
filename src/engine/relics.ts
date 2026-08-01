// src/engine/relics.ts
import type { ContentIndex } from './content';
import { applyEffects } from './effects';
import type { CombatState, EffectAtom, Rarity } from './types';

export type RelicHook = 'onCombatStart' | 'onTurnStart' | 'onKill' | 'onCombatEnd';

export interface RelicMods {
  maxHp: number;
  maxQi: number;
  handSize: number;
  startBlock: number;
  comboThreshold: number;
}

export interface RelicDef {
  id: string;
  name: string;
  hanja: string;
  rarity: Rarity;
  text: string;
  mods?: Partial<RelicMods>;
  triggers?: Array<{ hook: RelicHook; onlyTurn?: number; effects: EffectAtom[] }>;
}

const ZERO: RelicMods = { maxHp: 0, maxQi: 0, handSize: 0, startBlock: 0, comboThreshold: 0 };

export function relicMods(relicIds: string[], content: ContentIndex): RelicMods {
  const out: RelicMods = { ...ZERO };
  for (const id of relicIds) {
    let def: RelicDef;
    try {
      def = content.relic(id);
    } catch {
      continue;
    }
    for (const key of Object.keys(ZERO) as Array<keyof RelicMods>) {
      out[key] += def.mods?.[key] ?? 0;
    }
  }
  return out;
}

export function triggerRelics(
  state: CombatState, hook: RelicHook, content: ContentIndex,
): CombatState {
  let s = state;
  for (const id of state.player.relics) {
    let def: RelicDef;
    try {
      def = content.relic(id);
    } catch {
      continue;
    }
    for (const trigger of def.triggers ?? []) {
      if (trigger.hook !== hook) continue;
      if (trigger.onlyTurn !== undefined && trigger.onlyTurn !== s.turn) continue;
      s = applyEffects(s, trigger.effects, {
        line: 'sul',
        targetUid: s.enemies.find((e) => e.hp > 0)?.uid ?? null,
        comboBonus: 0,
      });
    }
  }
  return s;
}
