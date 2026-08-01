// src/ui/components/stance.ts
//
// 이 게임의 중심 정보. 자세와 상성이 보이지 않으면 남는 것은 열등한 덱빌더뿐이다.
// 판정은 전부 엔진(`matchup`/`stanceMultiplier`/`comboFires`)에서 가져오고, 여기서는
// 그 결과를 색이 아닌 글자·도형으로 옮기는 일만 한다.
import { comboBonusFor } from '../../engine/effects';
import { CONTENT } from '../../engine/gamedata';
import { relicMods } from '../../engine/relics';
import { COMBO_THRESHOLD, LINE_LABEL, comboFires, matchup, stanceMultiplier } from '../../engine/stance';
import type { CombatState, EnemyState, Line, Matchup, Stance } from '../../engine/types';
import { el } from '../dom';

export const MATCHUP_LABEL: Record<Matchup, { name: string; hanja: string }> = {
  break: { name: '파훼', hanja: '破' },
  neutral: { name: '평타', hanja: '平' },
  resisted: { name: '저항', hanja: '抗' },
};

/** 배율은 엔진에서 받아 `×1.5` 처럼 적는다. 소수점 뒤 0 은 떼어낸다. */
export function multiplierText(m: Matchup): string {
  return `×${String(stanceMultiplier(m))}`;
}

/**
 * 계열 표시. 색·한자·도형을 항상 함께 낸다. 글자 셋을 따로따로 읽어주면 소리가
 * 지저분해지므로 묶음 자체에 `role="img"` 와 이름을 달고 안쪽은 숨긴다.
 */
export function renderLineChip(line: Line, opts: { withName?: boolean } = {}): HTMLElement {
  const label = LINE_LABEL[line];
  const chip = el('span', { class: `line-chip line-${line}` }, [
    el('span', { class: 'line-shape', textContent: label.shape }),
    el('span', { class: 'line-hanja', textContent: label.hanja }),
  ]);
  if (opts.withName !== false) {
    chip.append(el('span', { class: 'line-name', textContent: label.name }));
  }
  chip.setAttribute('role', 'img');
  chip.setAttribute('aria-label', label.name);
  chip.setAttribute('title', `${label.name} ${label.hanja}`);
  return chip;
}

/** 상성 도장. 파훼는 크고 진하게, 저항은 읽히되 눌러서. */
export function renderMatchupChip(m: Matchup): HTMLElement {
  const label = MATCHUP_LABEL[m];
  const chip = el('span', { class: `mu mu-${m}` }, [
    el('span', { class: 'mu-hanja', textContent: label.hanja }),
    el('span', { class: 'mu-name', textContent: label.name }),
    el('span', { class: 'mu-mult', textContent: multiplierText(m) }),
  ]);
  chip.setAttribute('role', 'img');
  chip.setAttribute('aria-label', `${label.name} ${multiplierText(m)}`);
  return chip;
}

const CONSEQUENCE: Record<Matchup, string> = {
  break: '호신강기를 뚫는다',
  neutral: '그대로 들어간다',
  resisted: '깎여서 들어간다',
};

function stanceRow(
  opts: {
    who: string;
    /** 내가 치는 줄인가(mine) 적이 치는 줄인가(theirs). 같은 파훼라도 뜻이 반대다. */
    tone: 'mine' | 'theirs';
    attacker: Line;
    defenderStance: Stance;
    defenderName: string;
    note?: string;
  },
): HTMLElement {
  const m = matchup(opts.attacker, opts.defenderStance);
  const row = el('div', { class: `stance-row tone-${opts.tone} verdict-${m}` }, [
    el('span', { class: 'stance-who', textContent: opts.who }),
    renderLineChip(opts.attacker),
    el('span', { class: 'stance-arrow', textContent: '→' }),
    renderMatchupChip(m),
    el('span', { class: 'stance-arrow', textContent: '→' }),
    renderLineChip(opts.defenderStance),
    el('span', { class: 'stance-target', textContent: opts.defenderName }),
  ]);
  row.append(el('span', {
    class: 'stance-note',
    textContent: opts.note ? `${CONSEQUENCE[m]} · ${opts.note}` : CONSEQUENCE[m],
  }));
  row.setAttribute('aria-label',
    `${opts.who} ${LINE_LABEL[opts.attacker].name}으로 ${opts.defenderName}의 `
    + `${LINE_LABEL[opts.defenderStance].name} 자세를 치면 `
    + `${MATCHUP_LABEL[m].name} ${multiplierText(m)}, ${CONSEQUENCE[m]}`);
  return row;
}

/** 이 전투에서 연계가 터지는 장수. 기물 보정을 포함한다. */
export function comboThreshold(state: CombatState): number {
  return Math.max(1, COMBO_THRESHOLD + relicMods(state.player.relics, CONTENT).comboThreshold);
}

/** 연계 보너스 문구도 엔진이 주는 값에서 만든다. 숫자를 여기 적어두지 않는다. */
export function comboBonusText(line: Stance): string {
  const bonus = comboBonusFor(line);
  const parts: string[] = [];
  if (bonus.damageBonus > 0) parts.push(`피해 +${bonus.damageBonus}`);
  for (const atom of bonus.extra) {
    if (atom.op === 'draw') parts.push(`카드 ${atom.value}장`);
    else if (atom.op === 'block') parts.push(`호신강기 ${atom.value}`);
    else if (atom.op === 'gainQi') parts.push(`내공 ${atom.value}`);
  }
  return parts.join(' · ');
}

/**
 * 연계 카운터. 점으로 진행을 보이고, 임계에 닿으면 강조한다. 계열을 바꾸면
 * 처음부터라는 사실이 매 턴의 판단이므로 문구로 못박는다.
 */
export function renderComboTrack(state: CombatState): HTMLElement {
  const threshold = comboThreshold(state);
  const { line, count } = state.combo;
  const firing = comboFires(state.combo, threshold);
  const nextFires = line !== null && comboFires({ line, count: count + 1 }, threshold);

  const dots = el('span', { class: 'combo-dots' });
  for (let i = 0; i < threshold; i++) {
    const filled = line !== null && i < Math.min(count, threshold);
    dots.append(el('span', {
      class: `combo-dot${filled ? ' on' : ''}`,
      textContent: filled ? '●' : '○',
    }));
  }
  dots.setAttribute('aria-hidden', 'true');

  let text: string;
  if (line === null) {
    text = `같은 계열 ${threshold}장을 이으면 연계`;
  } else if (firing) {
    text = `연계 발동 중 — ${LINE_LABEL[line].name} ${comboBonusText(line)}`;
  } else if (nextFires) {
    text = `${LINE_LABEL[line].name} 한 장 더면 연계 — ${comboBonusText(line)}`;
  } else {
    text = `${LINE_LABEL[line].name} ${count}장 · ${threshold}장이면 연계`;
  }

  // firing 과 ready 는 서로 배타적이다 — 이미 터지는 중이면 '한 장 더'가 아니다.
  const box = el('div', { class: `combo${firing ? ' firing' : nextFires ? ' ready' : ''}` }, [
    el('span', { class: 'combo-label', textContent: '연계' }),
    dots,
    el('span', { class: 'combo-count', textContent: `${line === null ? 0 : count}/${threshold}` }),
    el('span', { class: 'combo-text', textContent: text }),
  ]);
  box.setAttribute('role', 'status');
  box.setAttribute('aria-label',
    `연계 ${line === null ? 0 : count} / ${threshold}. ${text}. 계열을 바꾸면 처음부터.`);
  return box;
}

export interface StanceBarOpts {
  /** 상성을 견줄 적. 없으면 살아있는 첫 적. */
  focusUid?: string | null;
  /** 손패에서 고른 초식의 계열. 있으면 내 공격 줄을 그 계열로 미리 본다. */
  previewLine?: Line | null;
}

/**
 * 자세 띠. 두 줄로 양방향을 함께 보인다.
 *
 * - 내가 치면: 내 자세(또는 고른 초식의 계열) 대 적의 **현재** 자세.
 * - 적이 치면: 적의 **의도 계열** 대 내 자세. 적은 의도한 행동의 계열로 때리고
 *   그 계열이 곧 다음 자세가 되므로, 자세가 아니라 의도를 attacker 로 놓아야
 *   실제로 일어날 일과 맞는다.
 */
export function renderStanceBar(state: CombatState, opts: StanceBarOpts = {}): HTMLElement {
  const alive = state.enemies.filter((e) => e.hp > 0);
  const focus: EnemyState | undefined =
    alive.find((e) => e.uid === opts.focusUid) ?? alive[0];

  const bar = el('section', { class: 'stance-bar' });
  bar.setAttribute('aria-label', '자세와 상성');

  const head = el('div', { class: 'stance-head' }, [
    el('h2', { class: 'stance-title', textContent: '자세' }),
  ]);
  if (focus && alive.length > 1) {
    head.append(el('span', { class: 'stance-focus', textContent: `대상 ${focus.name}` }));
  }
  bar.append(head);

  if (!focus) {
    bar.append(el('p', { class: 'stance-empty', textContent: '겨룰 상대가 없다.' }));
    bar.append(renderComboTrack(state));
    return bar;
  }

  const mine = opts.previewLine ?? state.player.stance;
  const preview = opts.previewLine !== null && opts.previewLine !== undefined;

  if (mine === 'sul') {
    // 술수는 자세가 되지 않는다. 상성 줄을 그리면 거짓말이 되므로 사실만 적는다.
    bar.append(el('div', { class: 'stance-row tone-mine verdict-neutral' }, [
      el('span', { class: 'stance-who', textContent: '내가 치면' }),
      renderLineChip('sul'),
      el('span', { class: 'stance-note', textContent: '술수는 자세를 바꾸지 않는다 — 자세는 그대로' }),
    ]));
  } else {
    const row = stanceRow({
      who: '내가 치면',
      tone: 'mine',
      attacker: mine,
      defenderStance: focus.stance,
      defenderName: focus.name,
      ...(preview ? { note: '고른 초식 기준' } : {}),
    });
    if (preview) row.classList.add('preview');
    bar.append(row);
  }

  const incoming: Line = focus.intent ? focus.intent.line : focus.stance;
  if (incoming === 'sul') {
    bar.append(el('div', { class: 'stance-row tone-theirs verdict-neutral' }, [
      el('span', { class: 'stance-who', textContent: '적이 치면' }),
      renderLineChip('sul'),
      el('span', { class: 'stance-note', textContent: '술수라 상성이 없다' }),
    ]));
  } else {
    bar.append(stanceRow({
      who: '적이 치면',
      tone: 'theirs',
      attacker: incoming,
      defenderStance: state.player.stance,
      defenderName: '나',
      ...(focus.intent && focus.intent.kind !== 'attack' ? { note: '이번엔 공격이 아니다' } : {}),
    }));
  }

  bar.append(renderComboTrack(state));
  return bar;
}
