import type { RunState } from './run';

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
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return m.version === 1
    && typeof m.runsStarted === 'number'
    && typeof m.runsWon === 'number'
    && typeof m.bestAct === 'number'
    && typeof m.bestFloors === 'number';
}

function isRun(value: unknown): value is RunState {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (r.version !== 1) return false;
  if (typeof r.seedText !== 'string' || typeof r.act !== 'number') return false;
  if (typeof r.map !== 'object' || r.map === null) return false;
  const player = r.player as Record<string, unknown> | null;
  if (typeof player !== 'object' || player === null) return false;
  if (typeof player.hp !== 'number' || typeof player.maxHp !== 'number') return false;
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

  if (typeof parsed !== 'object' || parsed === null) {
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
