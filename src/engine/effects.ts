import { computeDamage } from './damage';
import { Rng } from './rng';
import { beats, matchup } from './stance';
import { addStatus } from './status';
import type {
  CombatState, EffectAtom, EffectTarget, EnemyState, Line, Stance, StatusMap,
} from './types';

export interface EffectSource {
  line: Line;
  targetUid: string | null;
  /** 이 발동에 실린 연계 피해 보너스. */
  comboBonus: number;
  /** 적이 원인일 때 그 적의 uid. */
  fromEnemyUid?: string;
}

const STANCES: Stance[] = ['wai', 'gyeong', 'nae'];

export function comboBonusFor(line: Stance): { damageBonus: number; extra: EffectAtom[] } {
  if (line === 'wai') return { damageBonus: 6, extra: [] };
  if (line === 'gyeong') return { damageBonus: 0, extra: [{ op: 'draw', value: 1 }] };
  return { damageBonus: 0, extra: [{ op: 'block', value: 5 }] };
}

export function drawCards(state: CombatState, count: number): CombatState {
  let draw = [...state.draw];
  let discard = [...state.discard];
  const hand = [...state.hand];
  let rngState = state.rngState;

  for (let i = 0; i < count; i++) {
    if (draw.length === 0) {
      if (discard.length === 0) break;
      const rng = new Rng(rngState);
      draw = rng.shuffle(discard);
      discard = [];
      rngState = rng.state;
    }
    const next = draw.shift();
    if (next) hand.push(next);
  }

  return { ...state, draw, discard, hand, rngState };
}

export function damageEnemy(
  state: CombatState, uid: string, base: number, line: Line, comboBonus: number,
): CombatState {
  const index = state.enemies.findIndex((e) => e.uid === uid);
  if (index < 0) return state;
  const target = state.enemies[index]!;
  if (target.hp <= 0) return state;

  const result = computeDamage({
    base,
    comboBonus,
    attackerLine: line,
    attackerStatus: state.player.status,
    defenderStance: target.stance,
    defenderStatus: target.status,
    defenderBlock: target.block,
  });

  const enemies = [...state.enemies];
  enemies[index] = {
    ...target,
    hp: Math.max(0, target.hp - result.hpLoss),
    block: target.block - result.blockLoss,
    status: result.defenderStatus,
  };
  return { ...state, enemies };
}

export function damagePlayer(
  state: CombatState,
  base: number,
  line: Line,
  opts: { ignoreBlock?: boolean; attackerStatus?: StatusMap } = {},
): CombatState {
  const result = computeDamage({
    base,
    attackerLine: line,
    // 공격자(적)의 기세·쇠약이 반드시 실려야 한다. 비워 두면 적이 자신에게 거는
    // 기세와 플레이어가 적에게 거는 쇠약이 통째로 무의미해진다.
    attackerStatus: opts.attackerStatus ?? {},
    defenderStance: state.player.stance,
    defenderStatus: state.player.status,
    defenderBlock: state.player.block,
    ignoreBlock: opts.ignoreBlock,
  });

  return {
    ...state,
    player: {
      ...state.player,
      hp: Math.max(0, state.player.hp - result.hpLoss),
      block: state.player.block - result.blockLoss,
      status: result.defenderStatus,
    },
  };
}

// target은 'enemy' | 'allEnemies'로만 좁혀 둔다. 'self'는 EffectTarget의 멤버지만
// 이 함수의 호출자 셋(damage의 target은 애초에 'self'를 못 갖는 타입이고,
// applyStatus는 target==='self'일 때 이 함수를 부르기 전에 분기해 처리하며,
// ifBreak·counterStance는 'enemy'를 하드코딩한다) 중 누구도 'self'를 들고 오지
// 않는다. 예전에는 이 함수가 EffectTarget 전체를 받으면서도 'self'를 따로
// 다루지 않아, 언젠가 실수로 넘어오면 조용히 "적 하나"로 처리해 버릴 뻔한 죽은
// 분기였다 — 타입에서 아예 빼서 그 경우 자체가 컴파일에서 막히게 한다.
function resolveTargets(
  state: CombatState, target: Exclude<EffectTarget, 'self'>, src: EffectSource,
): EnemyState[] {
  const alive = state.enemies.filter((e) => e.hp > 0);
  if (target === 'allEnemies') return alive;
  const chosen = alive.find((e) => e.uid === src.targetUid);
  return chosen ? [chosen] : alive.slice(0, 1);
}

export function applyEffects(
  state: CombatState, atoms: EffectAtom[], src: EffectSource,
): CombatState {
  let s = state;

  for (const atom of atoms) {
    switch (atom.op) {
      case 'damage': {
        const hits = atom.hits ?? 1;
        const targets = resolveTargets(s, atom.target ?? 'enemy', src);
        for (let i = 0; i < hits; i++) {
          for (const t of targets) s = damageEnemy(s, t.uid, atom.value, src.line, src.comboBonus);
        }
        break;
      }
      case 'block':
        s = { ...s, player: { ...s.player, block: s.player.block + atom.value } };
        break;
      case 'loseBlock':
        s = { ...s, player: { ...s.player, block: 0 } };
        break;
      case 'keepBlock':
        s = { ...s, keepBlock: true };
        break;
      case 'draw':
        s = drawCards(s, atom.value);
        break;
      case 'gainQi':
        s = { ...s, player: { ...s.player, qi: s.player.qi + atom.value } };
        break;
      case 'heal':
        s = { ...s, player: { ...s.player, hp: Math.min(s.player.maxHp, s.player.hp + atom.value) } };
        break;
      case 'applyStatus': {
        if (atom.target === 'self') {
          s = { ...s, player: { ...s.player, status: addStatus(s.player.status, atom.status, atom.value) } };
          break;
        }
        const targets = resolveTargets(s, atom.target ?? 'enemy', src);
        const uids = new Set(targets.map((t) => t.uid));
        s = {
          ...s,
          enemies: s.enemies.map((e) =>
            uids.has(e.uid) ? { ...e, status: addStatus(e.status, atom.status, atom.value) } : e,
          ),
        };
        break;
      }
      case 'ifCombo':
        if (s.combo.count >= atom.min && s.combo.line !== null) s = applyEffects(s, atom.then, src);
        break;
      case 'ifBreak': {
        const target = resolveTargets(s, 'enemy', src)[0];
        if (target && matchup(src.line, target.stance) === 'break') s = applyEffects(s, atom.then, src);
        break;
      }
      case 'counterStance': {
        const target = resolveTargets(s, 'enemy', src)[0];
        if (target) {
          const counter = STANCES.find((st) => beats(st, target.stance));
          if (counter) s = { ...s, player: { ...s.player, stance: counter } };
        }
        break;
      }
    }
  }

  return s;
}
