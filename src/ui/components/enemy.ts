// src/ui/components/enemy.ts
import { CONTENT } from '../../engine/gamedata';
import { LINE_LABEL, matchup } from '../../engine/stance';
import type { EnemyState, Intent, IntentKind, Stance } from '../../engine/types';
import { el } from '../dom';
import { renderMeter, renderStatusBadges } from './bars';
import { MATCHUP_LABEL, renderLineChip, renderMatchupChip } from './stance';

/** 의도 기호. 색을 못 보거나 기호를 못 읽어도 이름과 수치가 남는다. */
export const INTENT_MARK: Record<IntentKind, { mark: string; name: string }> = {
  attack: { mark: '⚔', name: '공격' },
  defend: { mark: '⛨', name: '방어' },
  debuff: { mark: '⌁', name: '약화' },
  buff: { mark: '↑', name: '강화' },
  special: { mark: '◇', name: '특수' },
};

function valueText(intent: Intent): string {
  return intent.hits > 1 ? `${intent.value} ×${intent.hits}` : String(intent.value);
}

export function intentAriaLabel(intent: Intent): string {
  const kind = INTENT_MARK[intent.kind];
  const hits = intent.hits > 1 ? ` ${intent.hits}회` : '';
  return `다음 행동: ${intent.label}, ${kind.name} ${intent.value}${hits}, ${LINE_LABEL[intent.line].name}`;
}

/**
 * 의도 블록. 적이 무엇을 할지와 **어느 계열로** 할지를 함께 낸다. 계열을 보여야
 * 플레이어가 다음 턴의 자세를 미리 정할 수 있다.
 */
export function renderIntent(intent: Intent | null, playerStance?: Stance): HTMLElement {
  if (!intent) {
    const unknown = el('span', { class: 'intent intent-none', textContent: '의도 없음' });
    unknown.setAttribute('aria-label', '다음 행동을 알 수 없다');
    return unknown;
  }

  const kind = INTENT_MARK[intent.kind];
  const box = el('span', { class: `intent intent-${intent.kind}` }, [
    el('span', { class: 'intent-mark', textContent: kind.mark }),
    el('span', { class: 'intent-value', textContent: valueText(intent) }),
    renderLineChip(intent.line, { withName: false }),
    el('span', { class: 'intent-label', textContent: intent.label }),
  ]);

  if (playerStance && intent.kind === 'attack') {
    const m = matchup(intent.line, playerStance);
    box.append(renderMatchupChip(m));
    box.classList.add(`verdict-${m}`);
  }

  box.setAttribute('aria-label', intentAriaLabel(intent));
  return box;
}

export interface EnemyOpts {
  selected: boolean;
  /** 있으면 의도에 내 자세 기준 상성을, 이름 옆에 내 계열 기준 상성을 붙인다. */
  playerStance?: Stance;
  /** 손패에서 초식을 고른 상태라 탭이 곧 발동이 되는가. */
  targetable?: boolean;
}

/**
 * 적 하나. 뿌리가 곧 버튼이다 — 대상 선택이 탭 한 번이어야 하므로 div 위에
 * onclick 을 얹지 않는다. 버튼 안쪽은 전부 phrasing 요소(span)로 두었다.
 */
export function renderEnemy(enemy: EnemyState, opts: EnemyOpts): HTMLElement {
  let hanja = '';
  try {
    hanja = CONTENT.enemy(enemy.defId).hanja;
  } catch {
    hanja = '';
  }

  const node = el('button', {
    class: `enemy${opts.selected ? ' selected' : ''}${opts.targetable ? ' targetable' : ''}`,
    type: 'button',
    dataset: { hp: String(enemy.hp), uid: enemy.uid, fkey: `enemy:${enemy.uid}` },
  });

  const head = el('span', { class: 'enemy-head' }, [
    el('span', { class: 'enemy-name', textContent: enemy.name }),
    el('span', { class: 'enemy-hanja', textContent: hanja }),
  ]);
  if (opts.playerStance) {
    head.append(renderMatchupChip(matchup(opts.playerStance, enemy.stance)));
  }
  node.append(head);

  const stanceLine = el('span', { class: 'enemy-stance' }, [
    el('span', { class: 'enemy-stance-label', textContent: '자세' }),
    renderLineChip(enemy.stance),
  ]);
  node.append(stanceLine);

  node.append(renderMeter({
    label: `${enemy.name} 체력`,
    value: enemy.hp,
    max: enemy.maxHp,
    className: 'meter-hp',
  }));

  if (enemy.block > 0) {
    node.append(renderMeter({
      label: `${enemy.name} 호신강기`,
      value: enemy.block,
      max: enemy.maxHp,
      className: 'meter-block',
      text: `⛨ ${enemy.block}`,
    }));
  }

  node.append(renderStatusBadges(enemy.status));
  node.append(renderIntent(enemy.intent, opts.playerStance));

  const parts = [enemy.name, `체력 ${enemy.hp} / ${enemy.maxHp}`];
  if (enemy.block > 0) parts.push(`호신강기 ${enemy.block}`);
  parts.push(`자세 ${LINE_LABEL[enemy.stance].name}`);
  if (opts.playerStance) {
    parts.push(`내 ${LINE_LABEL[opts.playerStance].name}으로 치면 ${MATCHUP_LABEL[matchup(opts.playerStance, enemy.stance)].name}`);
  }
  if (enemy.intent) parts.push(intentAriaLabel(enemy.intent));
  parts.push(opts.targetable ? '탭하면 이 적에게 초식을 쓴다' : '탭하면 이 적을 견준다');

  node.setAttribute('aria-label', parts.join(', '));
  node.setAttribute('aria-pressed', String(opts.selected));
  return node;
}
