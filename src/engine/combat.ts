// src/engine/combat.ts
import type { ContentIndex } from './content';
import { applyEffects, comboBonusFor, damagePlayer, drawCards } from './effects';
import { chooseIntent, findAction, spawnEnemy, type EnemyDef } from './enemies';
import { Rng } from './rng';
import { comboFires, nextStance, updateCombo } from './stance';
import { addStatus, consumeStatus, getStatus, tickStatus } from './status';
import type {
  CardDef, CardInstance, CombatState, EffectAtom, EnemyState, Stance,
} from './types';

export interface CombatSetup {
  seed: number;
  player: { hp: number; maxHp: number; maxQi: number; stance: Stance; relics: string[] };
  enemyIds: string[];
  deck: CardInstance[];
  handSize?: number;
}

export type CombatAction =
  | { type: 'playCard'; uid: string; targetUid?: string }
  | { type: 'endTurn' };

export function effectiveCard(def: CardDef, upgraded: boolean): CardDef {
  if (!upgraded || !def.upgrade) return def;
  return {
    ...def,
    cost: def.upgrade.cost ?? def.cost,
    text: def.upgrade.text ?? def.text,
    effects: def.upgrade.effects ?? def.effects,
  };
}

export function startCombat(setup: CombatSetup, content: ContentIndex): CombatState {
  const rng = new Rng(setup.seed);
  const enemies = setup.enemyIds.map((id, i) => spawnEnemy(content.enemy(id), `e${i}`, rng));
  const withIntent = enemies.map((e) => ({
    ...e,
    intent: chooseIntent(content.enemy(e.defId), e, rng),
  }));

  const draw = rng.shuffle(setup.deck);

  const state: CombatState = {
    rngState: rng.state,
    turn: 0,
    phase: 'player',
    player: {
      hp: setup.player.hp,
      maxHp: setup.player.maxHp,
      qi: 0,
      maxQi: setup.player.maxQi,
      block: 0,
      stance: setup.player.stance,
      status: {},
      relics: [...setup.player.relics],
    },
    enemies: withIntent,
    draw,
    hand: [],
    discard: [],
    exhaust: [],
    combo: { line: null, count: 0 },
    handSize: setup.handSize ?? 5,
    keepBlock: false,
    log: [],
  };

  return beginPlayerTurn(state);
}

function beginPlayerTurn(state: CombatState): CombatState {
  let s: CombatState = { ...state, turn: state.turn + 1, phase: 'player' };

  if (!s.keepBlock) s = { ...s, player: { ...s.player, block: 0 } };
  s = { ...s, keepBlock: false };

  const poison = getStatus(s.player.status, 'poison');
  if (poison > 0) {
    s = { ...s, player: { ...s.player, hp: Math.max(0, s.player.hp - poison) } };
  }

  const naesang = getStatus(s.player.status, 'naesang');
  const qi = Math.max(0, s.player.maxQi - naesang);
  let status = tickStatus(s.player.status);
  if (naesang > 0) status = consumeStatus(status, 'naesang', naesang);

  s = { ...s, player: { ...s.player, qi, status } };
  s = drawCards(s, s.handSize);
  return settle(s);
}

/** 적 행동의 효과 원자는 플레이어를 향한다. 카드용 해석기와 다르다. */
function applyEnemyEffects(
  state: CombatState, atoms: EffectAtom[], enemyUid: string, line: CardDef['line'],
): CombatState {
  let s = state;

  const patchEnemy = (fn: (e: EnemyState) => EnemyState): void => {
    s = { ...s, enemies: s.enemies.map((e) => (e.uid === enemyUid ? fn(e) : e)) };
  };

  for (const atom of atoms) {
    switch (atom.op) {
      case 'damage': {
        const hits = atom.hits ?? 1;
        for (let i = 0; i < hits; i++) s = damagePlayer(s, atom.value, line);
        break;
      }
      case 'block':
        patchEnemy((e) => ({ ...e, block: e.block + atom.value }));
        break;
      case 'heal':
        patchEnemy((e) => ({ ...e, hp: Math.min(e.maxHp, e.hp + atom.value) }));
        break;
      case 'applyStatus':
        if ((atom.target ?? 'enemy') === 'self') {
          patchEnemy((e) => ({ ...e, status: addStatus(e.status, atom.status, atom.value) }));
        } else {
          s = { ...s, player: { ...s.player, status: addStatus(s.player.status, atom.status, atom.value) } };
        }
        break;
      default:
        break;
    }
  }

  return s;
}

function runEnemyTurn(state: CombatState, content: ContentIndex): CombatState {
  let s: CombatState = { ...state, phase: 'enemy' };
  const rng = new Rng(s.rngState);

  for (const snapshot of s.enemies) {
    const current = s.enemies.find((e) => e.uid === snapshot.uid);
    if (!current || current.hp <= 0) continue;

    const poison = getStatus(current.status, 'poison');
    let self: EnemyState = {
      ...current,
      hp: Math.max(0, current.hp - poison),
      block: 0,
      status: tickStatus(current.status),
    };
    s = { ...s, enemies: s.enemies.map((e) => (e.uid === self.uid ? self : e)) };
    if (self.hp <= 0) continue;

    const def: EnemyDef = content.enemy(self.defId);
    const intent = self.intent ?? chooseIntent(def, self, rng);
    const action = findAction(def, intent.actionId);
    if (action) {
      s = applyEnemyEffects(s, action.effects, self.uid, action.line);
      const after = s.enemies.find((e) => e.uid === self.uid);
      if (after) {
        self = {
          ...after,
          stance: nextStance(after.stance, action.line),
          history: [...after.history, action.id].slice(-4),
        };
        s = { ...s, enemies: s.enemies.map((e) => (e.uid === self.uid ? self : e)) };
      }
    }

    if (s.player.hp <= 0) break;

    const alive = s.enemies.find((e) => e.uid === self.uid);
    if (alive && alive.hp > 0) {
      const nextIntent = chooseIntent(def, alive, rng);
      s = { ...s, enemies: s.enemies.map((e) => (e.uid === alive.uid ? { ...e, intent: nextIntent } : e)) };
    }
  }

  return { ...s, rngState: rng.state };
}

/** 죽은 적을 치우고 승패를 판정한다. */
function settle(state: CombatState): CombatState {
  const enemies = state.enemies.filter((e) => e.hp > 0);
  const s = { ...state, enemies };
  if (s.player.hp <= 0) return { ...s, phase: 'lost' };
  if (enemies.length === 0) return { ...s, phase: 'won' };
  return s;
}

export function canPlay(state: CombatState, uid: string, content: ContentIndex): boolean {
  if (state.phase !== 'player') return false;
  const card = state.hand.find((c) => c.uid === uid);
  if (!card) return false;
  const def = effectiveCard(content.card(card.defId), card.upgraded);
  return state.player.qi >= def.cost;
}

export function applyAction(
  state: CombatState, action: CombatAction, content: ContentIndex,
): CombatState {
  if (state.phase === 'won' || state.phase === 'lost') return state;

  if (action.type === 'endTurn') {
    let s: CombatState = { ...state, discard: [...state.discard, ...state.hand], hand: [] };
    s = runEnemyTurn(s, content);
    s = settle(s);
    if (s.phase === 'won' || s.phase === 'lost') return s;
    return beginPlayerTurn(s);
  }

  if (!canPlay(state, action.uid, content)) return state;

  const card = state.hand.find((c) => c.uid === action.uid)!;
  const def = effectiveCard(content.card(card.defId), card.upgraded);

  const combo = updateCombo(state.combo, def.line);
  const fires = comboFires(combo);
  const bonus = fires && combo.line ? comboBonusFor(combo.line) : { damageBonus: 0, extra: [] };

  let s: CombatState = {
    ...state,
    hand: state.hand.filter((c) => c.uid !== action.uid),
    player: {
      ...state.player,
      qi: state.player.qi - def.cost,
      stance: nextStance(state.player.stance, def.line),
    },
    combo,
  };
  s = def.exhaust ? { ...s, exhaust: [...s.exhaust, card] } : { ...s, discard: [...s.discard, card] };

  const target = action.targetUid ?? s.enemies.find((e) => e.hp > 0)?.uid ?? null;
  s = applyEffects(s, [...def.effects, ...bonus.extra], {
    line: def.line,
    targetUid: target,
    comboBonus: bonus.damageBonus,
  });

  return settle(s);
}
