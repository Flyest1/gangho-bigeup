// src/engine/combat.ts
import type { ContentIndex } from './content';
import { applyEffects, comboBonusFor, damagePlayer, drawCards } from './effects';
import { chooseIntent, findAction, spawnEnemy, type EnemyDef } from './enemies';
import { relicMods, triggerRelics } from './relics';
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

  const mods = relicMods(setup.player.relics, content);
  const maxHp = setup.player.maxHp + mods.maxHp;
  const maxQi = setup.player.maxQi + mods.maxQi;

  const state: CombatState = {
    rngState: rng.state,
    turn: 0,
    phase: 'player',
    player: {
      hp: Math.min(setup.player.hp, maxHp),
      maxHp,
      qi: 0,
      maxQi,
      block: mods.startBlock,
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
    handSize: (setup.handSize ?? 5) + mods.handSize,
    keepBlock: false,
    log: [],
  };

  const seeded = triggerRelics(state, 'onCombatStart', content);
  return beginPlayerTurn(seeded, content);
}

function beginPlayerTurn(state: CombatState, content: ContentIndex): CombatState {
  // 첫 턴(state.turn === 0 → 1)의 호신강기는 startCombat 이 mods.startBlock 으로 이미
  // 심어 두었고, 그 위에 onCombatStart 훅(예: 청동 노패의 block:8)이 얹은 몫도 이미
  // 실려 있다. 여기서 다시 mods.startBlock 으로 덮으면 onCombatStart 가 준 값이
  // 첫 프레임이 뜨기도 전에 지워진다 — 둘째 턴부터는 평소대로 되돌린다. 이 되돌림이
  // 없으면 낡은 죽립(매 턴 호신강기 5)이 첫 턴 이후로도 값을 그대로 들고 있어
  // '매 턴'이 아니라 '첫 턴만'이 되어 버린다.
  const firstTurn = state.turn === 0;
  let s: CombatState = { ...state, turn: state.turn + 1, phase: 'player' };
  const mods = relicMods(s.player.relics, content);

  if (!firstTurn && !s.keepBlock) s = { ...s, player: { ...s.player, block: mods.startBlock } };
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
  s = triggerRelics(s, 'onTurnStart', content);
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
        for (let i = 0; i < hits; i++) {
          // 매 타격마다 공격자를 다시 읽는다. s 는 타격마다 새 객체로 바뀌므로
          // 밖에서 한 번 잡아두면 그 사이에 바뀐 상태(예: 잔상 소모)를 놓친다.
          const attacker = s.enemies.find((e) => e.uid === enemyUid);
          s = damagePlayer(s, atom.value, line, { attackerStatus: attacker?.status ?? {} });
        }
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
      // 아래 원자들은 적 행동에서 의미가 없거나 지원하지 않는다. 목록을 명시해 두면
      // 새 원자를 추가할 때 여기서 컴파일이 깨지므로 조용히 무시되는 일이 없다.
      // `tools/validate_data.mjs`(Task 10)가 적 행동 데이터에서 이 목록을 거부한다.
      case 'draw':
      case 'gainQi':
      case 'keepBlock':
      case 'loseBlock':
      case 'ifCombo':
      case 'ifBreak':
      case 'counterStance':
        break;

      default: {
        const unreachable: never = atom;
        void unreachable;
        break;
      }
    }
  }

  return s;
}

function runEnemyTurn(state: CombatState, content: ContentIndex): CombatState {
  let s: CombatState = { ...state, phase: 'enemy' };

  // 난수는 항상 s.rngState 에서 읽어 s 로 되돌린다. 국소 Rng 를 턴 내내 쥐고 있다가
  // 마지막에 한 번 써 넣으면, 그 사이에 s.rngState 를 전진시킨 다른 코드(효과 원자,
  // 나중에 붙을 기물 훅)의 진행이 통째로 지워져 재현이 어긋난다.
  const consume = <T>(fn: (rng: Rng) => T): T => {
    const rng = new Rng(s.rngState);
    const out = fn(rng);
    s = { ...s, rngState: rng.state };
    return out;
  };

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
    const intent = self.intent ?? consume((rng) => chooseIntent(def, self, rng));
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
      const nextIntent = consume((rng) => chooseIntent(def, alive, rng));
      s = { ...s, enemies: s.enemies.map((e) => (e.uid === alive.uid ? { ...e, intent: nextIntent } : e)) };
    }
  }

  return s;
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
    return beginPlayerTurn(s, content);
  }

  if (!canPlay(state, action.uid, content)) return state;

  const card = state.hand.find((c) => c.uid === action.uid)!;
  const def = effectiveCard(content.card(card.defId), card.upgraded);

  const mods = relicMods(state.player.relics, content);
  const combo = updateCombo(state.combo, def.line);
  const fires = comboFires(combo, 3 + mods.comboThreshold);
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
