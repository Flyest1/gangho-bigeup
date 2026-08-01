import type { Combo, Line, Matchup, Stance } from './types';

export const COMBO_THRESHOLD = 3;

/** 외공▶경공▶내공▶외공. 술수는 순환에 참여하지 않는다. */
const CYCLE: Record<Stance, Stance> = { wai: 'gyeong', gyeong: 'nae', nae: 'wai' };

function isStance(line: Line): line is Stance {
  return line !== 'sul';
}

export function beats(a: Line, b: Line): boolean {
  if (!isStance(a) || !isStance(b)) return false;
  return CYCLE[a] === b;
}

export function matchup(attacker: Line, defenderStance: Stance | null): Matchup {
  if (defenderStance === null || !isStance(attacker)) return 'neutral';
  if (beats(attacker, defenderStance)) return 'break';
  if (beats(defenderStance, attacker)) return 'resisted';
  return 'neutral';
}

export function stanceMultiplier(m: Matchup): number {
  if (m === 'break') return 1.5;
  if (m === 'resisted') return 0.75;
  return 1;
}

export function nextStance(current: Stance, played: Line): Stance {
  return isStance(played) ? played : current;
}

export function updateCombo(combo: Combo, line: Line): Combo {
  if (!isStance(line)) return combo;
  if (combo.line === line) return { line, count: combo.count + 1 };
  return { line, count: 1 };
}

export function comboFires(combo: Combo): boolean {
  return combo.line !== null && combo.count >= COMBO_THRESHOLD;
}

/** 색만으로 구분하지 않도록 이름·한자·도형을 함께 제공한다. */
export const LINE_LABEL: Record<Line, { name: string; hanja: string; shape: string }> = {
  wai: { name: '외공', hanja: '外', shape: '◆' },
  gyeong: { name: '경공', hanja: '輕', shape: '▲' },
  nae: { name: '내공', hanja: '內', shape: '●' },
  sul: { name: '술수', hanja: '術', shape: '■' },
};
