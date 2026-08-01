import { Rng } from './rng';
import type {
  EffectAtom, EnemyState, Intent, IntentKind, Line, Stance,
} from './types';

export interface EnemyAction {
  id: string;
  kind: IntentKind;
  line: Line;
  label: string;
  weight: number;
  /** 의도 표시에 쓰는 대표 수치 (피해량, 방어량 등). */
  value: number;
  hits?: number;
  effects: EffectAtom[];
  /** 연속 사용 허용 횟수. 기본 2. */
  maxInARow?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  hanja: string;
  portrait?: string;
  hp: [number, number];
  startStance: Stance;
  tier: 'normal' | 'elite' | 'boss';
  act: number;
  actions: EnemyAction[];
}

const DEFAULT_MAX_IN_A_ROW = 2;

export function spawnEnemy(def: EnemyDef, uid: string, rng: Rng): EnemyState {
  const hp = rng.range(def.hp[0], def.hp[1]);
  return {
    uid,
    defId: def.id,
    name: def.name,
    hp,
    maxHp: hp,
    block: 0,
    stance: def.startStance,
    status: {},
    intent: null,
    history: [],
  };
}

function trailingRepeat(history: readonly string[], id: string): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0 && history[i] === id; i--) n++;
  return n;
}

export function chooseIntent(def: EnemyDef, enemy: EnemyState, rng: Rng): Intent {
  const allowed = def.actions.filter(
    (a) => trailingRepeat(enemy.history, a.id) < (a.maxInARow ?? DEFAULT_MAX_IN_A_ROW),
  );
  const pool = allowed.length > 0 ? allowed : def.actions;
  const action = rng.weighted(pool.map((a) => [a, a.weight] as const));

  return {
    actionId: action.id,
    kind: action.kind,
    line: action.line,
    value: action.value,
    hits: action.hits ?? 1,
    label: action.label,
  };
}

export function findAction(def: EnemyDef, actionId: string): EnemyAction | undefined {
  return def.actions.find((a) => a.id === actionId);
}
