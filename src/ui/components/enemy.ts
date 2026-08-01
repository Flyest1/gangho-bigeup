// src/ui/components/enemy.ts
import { portraitFor } from '../../art/portraits';
import { computeDamage } from '../../engine/damage';
import { CONTENT } from '../../engine/gamedata';
import { LINE_LABEL, matchup } from '../../engine/stance';
import type { EnemyState, Intent, IntentKind, Stance, StatusMap } from '../../engine/types';
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

/**
 * 의도가 실제로 얼마나 아플지. 정적 데이터의 intent.value를 그대로 보이면 공격자의
 * 기세·쇠약, 방어자의 취약이 전부 빠진 숫자가 된다 — 실제 피해는 damagePlayer가
 * computeDamage(엔진, 순수)로 계산하므로, 화면도 그 계산을 그대로 물어 표시용
 * amount를 얻는다(두 번째 구현이 아니라 같은 함수를 한 번 더 부르는 것뿐이다).
 * 공격이 아닌 의도(방어·강화 등)는 애초에 computeDamage가 다루는 대상이 아니므로
 * 원래 값 그대로 보인다.
 */
export function intentDisplayValue(
  intent: Intent, enemyStatus: StatusMap, playerStance: Stance | null, playerStatus: StatusMap,
): number {
  if (intent.kind !== 'attack') return intent.value;
  return computeDamage({
    base: intent.value,
    attackerLine: intent.line,
    attackerStatus: enemyStatus,
    defenderStance: playerStance,
    defenderStatus: playerStatus,
    defenderBlock: 0,
  }).amount;
}

function valueText(value: number, hits: number): string {
  return hits > 1 ? `${value} ×${hits}` : String(value);
}

export function intentAriaLabel(intent: Intent, value: number): string {
  const kind = INTENT_MARK[intent.kind];
  const hits = intent.hits > 1 ? ` ${intent.hits}회` : '';
  return `다음 행동: ${intent.label}, ${kind.name} ${value}${hits}, ${LINE_LABEL[intent.line].name}`;
}

export interface IntentContext {
  playerStance?: Stance;
  playerStatus?: StatusMap;
  enemyStatus?: StatusMap;
}

/**
 * 의도 블록. 적이 무엇을 할지와 **어느 계열로** 할지를 함께 낸다. 계열을 보여야
 * 플레이어가 다음 턴의 자세를 미리 정할 수 있다.
 */
export function renderIntent(intent: Intent | null, ctx: IntentContext = {}): HTMLElement {
  if (!intent) {
    const unknown = el('span', { class: 'intent intent-none', textContent: '의도 없음' });
    unknown.setAttribute('aria-label', '다음 행동을 알 수 없다');
    return unknown;
  }

  const value = intentDisplayValue(
    intent, ctx.enemyStatus ?? {}, ctx.playerStance ?? null, ctx.playerStatus ?? {},
  );
  const kind = INTENT_MARK[intent.kind];
  const box = el('span', { class: `intent intent-${intent.kind}` }, [
    el('span', { class: 'intent-mark', textContent: kind.mark }),
    el('span', { class: 'intent-value', textContent: valueText(value, intent.hits) }),
    renderLineChip(intent.line, { withName: false }),
    el('span', { class: 'intent-label', textContent: intent.label }),
  ]);

  if (ctx.playerStance && intent.kind === 'attack') {
    const m = matchup(intent.line, ctx.playerStance);
    box.append(renderMatchupChip(m));
    box.classList.add(`verdict-${m}`);
  }

  box.setAttribute('aria-label', intentAriaLabel(intent, value));
  return box;
}

export interface EnemyOpts {
  selected: boolean;
  /** 있으면 의도에 내 자세 기준 상성을, 이름 옆에 내 계열 기준 상성을 붙인다. */
  playerStance?: Stance;
  /** 방어자(나) 상태. 의도 수치에 취약 보정을 반영하려면 필요하다. */
  playerStatus?: StatusMap;
  /** 손패에서 초식을 고른 상태라 탭이 곧 발동이 되는가. */
  targetable?: boolean;
}

/**
 * 적 하나. 뿌리가 곧 버튼이다 — 대상 선택이 탭 한 번이어야 하므로 div 위에
 * onclick 을 얹지 않는다. 버튼 안쪽은 전부 phrasing 요소(span)로 두었다.
 */
export function renderEnemy(enemy: EnemyState, opts: EnemyOpts): HTMLElement {
  let hanja = '';
  let tier: 'normal' | 'elite' | 'boss' = 'normal';
  try {
    const def = CONTENT.enemy(enemy.defId);
    hanja = def.hanja;
    tier = def.tier;
  } catch {
    hanja = '';
  }

  const node = el('button', {
    class: `enemy${opts.selected ? ' selected' : ''}${opts.targetable ? ' targetable' : ''}`,
    type: 'button',
    dataset: { hp: String(enemy.hp), uid: enemy.uid, fkey: `enemy:${enemy.uid}` },
  });

  // 초상 — 보스 셋(매초풍·구천인·구양봉)은 실제 그림, 나머지는 defId 해시로
  // 그리는 얼굴. 이름표는 이미 이름·한자로 신원을 밝히므로 초상은 순수 장식이다.
  const portrait = portraitFor(enemy.defId);
  portrait.classList.add('enemy-portrait', `enemy-portrait-${tier}`);
  node.append(portrait);

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
  node.append(renderIntent(enemy.intent, {
    playerStance: opts.playerStance, playerStatus: opts.playerStatus, enemyStatus: enemy.status,
  }));

  const parts = [enemy.name, `체력 ${enemy.hp} / ${enemy.maxHp}`];
  if (enemy.block > 0) parts.push(`호신강기 ${enemy.block}`);
  parts.push(`자세 ${LINE_LABEL[enemy.stance].name}`);
  if (opts.playerStance) {
    parts.push(`내 ${LINE_LABEL[opts.playerStance].name}으로 치면 ${MATCHUP_LABEL[matchup(opts.playerStance, enemy.stance)].name}`);
  }
  if (enemy.intent) {
    const value = intentDisplayValue(
      enemy.intent, enemy.status, opts.playerStance ?? null, opts.playerStatus ?? {},
    );
    parts.push(intentAriaLabel(enemy.intent, value));
  }
  // 눈으로 보는 사람은 의도 옆의 상성 도장으로 이 적이 나를 어떻게 치는지 안다.
  // 그 판정이 이름표에도 실려야 한다 — 자세는 공격만큼이나 방어를 좌우하고,
  // 없으면 스크린리더 사용자는 자세 띠에 잡히는 초점 적 하나만 알게 된다.
  if (opts.playerStance && enemy.intent && enemy.intent.kind === 'attack') {
    const incoming = matchup(enemy.intent.line, opts.playerStance);
    parts.push(`이 적이 ${LINE_LABEL[enemy.intent.line].name}으로 치면 내가 ${MATCHUP_LABEL[incoming].name}`);
  }
  parts.push(opts.targetable ? '탭하면 이 적에게 초식을 쓴다' : '탭하면 이 적을 견준다');

  node.setAttribute('aria-label', parts.join(', '));
  node.setAttribute('aria-pressed', String(opts.selected));
  return node;
}
