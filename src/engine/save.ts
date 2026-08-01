import { SCHOOLS } from './gamedata';
import type { RunScreen, RunState } from './run';

export interface MetaState {
  version: 1;
  runsStarted: number;
  runsWon: number;
  bestAct: number;
  bestFloors: number;
}

export interface SaveData {
  version: 1;
  meta: MetaState;
  run: RunState | null;
}

export function emptySave(): SaveData {
  return {
    version: 1,
    meta: { version: 1, runsStarted: 0, runsWon: 0, bestAct: 0, bestFloors: 0 },
    run: null,
  };
}

export function serialize(save: SaveData): string {
  return JSON.stringify(save);
}

function isMeta(value: unknown): value is MetaState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  return m.version === 1
    && typeof m.runsStarted === 'number'
    && typeof m.runsWon === 'number'
    && typeof m.bestAct === 'number'
    && typeof m.bestFloors === 'number';
}

/** 맵이 실제로 걸어다닐 수 있는 모양인지 본다. */
function isMap(value: unknown): value is { layers: string[][]; nodes: Record<string, unknown> } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  if (!Array.isArray(m.layers) || m.layers.length === 0) return false;
  if (typeof m.nodes !== 'object' || m.nodes === null || Array.isArray(m.nodes)) return false;
  return Object.keys(m.nodes as Record<string, unknown>).length > 0;
}

/** RunScreen 의 실제 멤버인가. 화면 전환 스위치(app.ts)의 `default: renderMap`이
 * 모든 값을 받아 주므로, 낯선 문자열이 통과하면 흰 화면 대신 "맵인데 걸을 수
 * 없는" 상태로 조용히 격리 없이 굳는다 — availableNodes 가 screen==='map' 일 때만
 * 실제 노드를 내주기 때문이다. */
function isRunScreen(value: unknown): value is RunScreen {
  return value === 'map' || value === 'combat' || value === 'reward'
    || value === 'rest' || value === 'shop' || value === 'result';
}

/** 층수·처치·정예 집계. recordRunEnd 가 run.stats.floors 를 곧바로 읽으므로
 * 없으면 저장할 때마다(전투 승패가 갈릴 때마다) 그 자리에서 터진다. */
function isStats(value: unknown): value is { floors: number; kills: number; elites: number } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return typeof s.floors === 'number' && typeof s.kills === 'number' && typeof s.elites === 'number';
}

function isRun(value: unknown): value is RunState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (r.version !== 1) return false;
  if (typeof r.seedText !== 'string' || typeof r.act !== 'number') return false;
  if (typeof r.rngState !== 'number') return false;
  if (!isRunScreen(r.screen)) return false;
  if (r.result !== 'ongoing' && r.result !== 'victory' && r.result !== 'defeat') return false;

  // run.school 은 현재 'gaebang' 하나뿐이지만 SCHOOLS 의 키로 확인해 둔다 — enterNode 가
  // `SCHOOLS[run.school]`을 곧바로 역참조하므로(run.ts:184), 없는 문파는 다음 전투
  // 진입에서 그 자리가 undefined 가 되어 `.maxQi` 읽기가 터진다.
  if (typeof r.school !== 'string') return false;
  if (!(r.school in SCHOOLS)) return false;
  if (typeof r.nextUid !== 'number') return false;
  if (!isStats(r.stats)) return false;

  if (!isMap(r.map)) return false;

  // currentNodeId 는 null 이거나 맵에 실재하는 노드를 가리켜야 한다. run.ts 는 이 값을
  // non-null 로 역참조하고 availableNodes 는 맵 화면을 그리는 즉시 호출되므로, 헛도는
  // id 가 통과하면 격리되는 대신 불러오자마자 터진다. 격리가 존재하는 이유가 이것이다.
  if (r.currentNodeId !== null) {
    if (typeof r.currentNodeId !== 'string') return false;
    if (!(r.currentNodeId in r.map.nodes)) return false;
  }

  // 전투 화면인데 전투 상태가 객체가 아니면 첫 액션에서 터진다.
  if (r.screen === 'combat' && (typeof r.combat !== 'object' || r.combat === null)) return false;

  const player = r.player as Record<string, unknown> | null;
  if (typeof player !== 'object' || player === null) return false;
  if (typeof player.hp !== 'number' || typeof player.maxHp !== 'number') return false;
  if (typeof player.gold !== 'number') return false;
  if (!Array.isArray(player.deck) || player.deck.length === 0) return false;
  if (!Array.isArray(player.relics)) return false;
  return true;
}

/** 구획별로 검증해 손상된 부분만 격리한다. */
export function parseSave(raw: string | null): { save: SaveData; quarantined: string[] } {
  if (raw === null || raw === '') return { save: emptySave(), quarantined: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { save: emptySave(), quarantined: ['전체'] };
  }

  // 배열도 typeof 'object' 이다. 걸러내지 않으면 meta·run 이 모두 undefined 로 읽혀
  // '키가 없는 정상 저장'과 구분되지 않고, 손상이 조용히 빈 저장으로 둔갑한다.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { save: emptySave(), quarantined: ['전체'] };
  }

  const source = parsed as Record<string, unknown>;
  const quarantined: string[] = [];
  const save = emptySave();

  if (isMeta(source.meta)) save.meta = source.meta;
  else if (source.meta !== undefined) quarantined.push('meta');

  if (source.run === null || source.run === undefined) save.run = null;
  else if (isRun(source.run)) save.run = source.run;
  else quarantined.push('run');

  return { save, quarantined };
}

export function recordRunEnd(meta: MetaState, run: RunState): MetaState {
  return {
    ...meta,
    runsWon: meta.runsWon + (run.result === 'victory' ? 1 : 0),
    bestAct: Math.max(meta.bestAct, run.act),
    bestFloors: Math.max(meta.bestFloors, run.stats.floors),
  };
}
