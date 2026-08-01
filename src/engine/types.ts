/** 무공 계열. 술수(sul)는 계열이 없어 상성과 연계 판정에서 제외된다. */
export type Line = 'wai' | 'gyeong' | 'nae' | 'sul';

/** 자세로 취할 수 있는 계열. 술수는 자세가 되지 않는다. */
export type Stance = 'wai' | 'gyeong' | 'nae';

export type Matchup = 'break' | 'neutral' | 'resisted';

export type Rarity = 'basic' | 'common' | 'rare' | 'ultra';

export type StatusId =
  | 'poison'      // 중독
  | 'naesang'     // 내상
  | 'vulnerable'  // 취약
  | 'weak'        // 쇠약
  | 'momentum'    // 기세
  | 'afterimage'; // 잔상

export type StatusMap = Partial<Record<StatusId, number>>;

export interface Combo {
  line: Stance | null;
  count: number;
}

export type CardSchool = 'common' | 'gaebang';
export type EffectTarget = 'enemy' | 'allEnemies' | 'self';
export type IntentKind = 'attack' | 'defend' | 'debuff' | 'buff' | 'special';
export type CombatPhase = 'player' | 'enemy' | 'won' | 'lost';

export type EffectAtom =
  | { op: 'damage'; value: number; hits?: number; target?: EffectTarget }
  | { op: 'block'; value: number }
  | { op: 'draw'; value: number }
  | { op: 'gainQi'; value: number }
  | { op: 'heal'; value: number }
  | { op: 'applyStatus'; status: StatusId; value: number; target?: EffectTarget }
  | { op: 'ifCombo'; min: number; then: EffectAtom[] }
  | { op: 'ifBreak'; then: EffectAtom[] }
  | { op: 'keepBlock' }
  | { op: 'loseBlock' }
  | { op: 'counterStance' };

export interface CardDef {
  id: string;
  name: string;
  hanja: string;
  school: CardSchool;
  line: Line;
  cost: number;
  rarity: Rarity;
  target: EffectTarget;
  text: string;
  effects: EffectAtom[];
  exhaust?: boolean;
  upgrade?: { text?: string; cost?: number; effects?: EffectAtom[] };
}

export interface CardInstance {
  uid: string;
  defId: string;
  upgraded: boolean;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  block: number;
  stance: Stance;
  status: StatusMap;
  relics: string[];
}

export interface Intent {
  actionId: string;
  kind: IntentKind;
  line: Line;
  value: number;
  hits: number;
  label: string;
}

export interface EnemyState {
  uid: string;
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  stance: Stance;
  status: StatusMap;
  intent: Intent | null;
  history: string[];
}

export interface CombatState {
  rngState: number;
  turn: number;
  phase: CombatPhase;
  player: PlayerState;
  enemies: EnemyState[];
  draw: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  exhaust: CardInstance[];
  combo: Combo;
  handSize: number;
  /** 순도 계열 효과. 다음 플레이어 턴 시작에 호신강기를 지우지 않는다. */
  keepBlock: boolean;
  log: string[];
}
