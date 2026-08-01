// src/ui/screens/combat.ts
//
// 전투 화면. 위에서 아래로 상단바 · 적 열 · 자세 띠 · 손패 · 행동바.
//
// 규칙은 하나도 여기서 다시 계산하지 않는다. 발동 가능 여부는 `canPlay`, 상성은
// `matchup`, 연계는 `comboFires`, 강화 수치는 `effectiveCard` 가 낸 값을 그대로
// 옮겨 적기만 한다. 화면이 두 번째 규칙 구현이 되는 순간 둘은 반드시 어긋난다.
import { inkBackdrop } from '../../art/svg';
import { sfx } from '../../audio/sfx';
import { applyAction, canPlay, effectiveCard, type CombatAction } from '../../engine/combat';
import { CONTENT } from '../../engine/gamedata';
import type { RunState } from '../../engine/run';
import { comboFires, matchup } from '../../engine/stance';

import type {
  CardDef, CardInstance, CombatState, EnemyState, Line, Matchup, Stance,
} from '../../engine/types';
import type { AppApi } from '../app';
import { renderStatusBadges, renderMeter } from '../components/bars';
import { cardAriaLabel, renderCardFace, renderCardRow } from '../components/card';
import { renderEnemy } from '../components/enemy';
import {
  MATCHUP_LABEL, comboThreshold, renderLineChip, renderStanceBar, summarizeVerdict, verdictAriaText,
} from '../components/stance';
import { clear, el } from '../dom';
import { bindCombatKeys } from '../input';

/**
 * 여러 대상 중 하나라도 파훼면 파훼로, 아니면 저항/평타 중 있는 대로 대표 판정을
 * 고른다. 소리는 한 번만 나므로 "이번 발동에서 가장 중요한 신호"를 골라야 한다 —
 * 파훼가 이 게임에서 가장 중요한 순간이라는 브리핑의 요구를 그대로 따른다.
 */
function worstMatchup(pairs: Array<{ attacker: Line; defender: Stance }>): Matchup {
  let seen: Matchup = 'neutral';
  for (const { attacker, defender } of pairs) {
    const m = matchup(attacker, defender);
    if (m === 'break') return 'break';
    if (m === 'resisted') seen = 'resisted';
  }
  return seen;
}

/**
 * 카드 한 장을 실제로 낸 뒤(before→after)의 결과를 보고 소리를 고른다. 규칙을
 * 다시 계산하지 않는다 — `applyAction`이 낸 결과를 진단만 한다. 상성만은
 * 예외인데, `computeDamage`가 판정 자체를 상태에 남기지 않으므로 "친 계열 대
 * 맞기 전 자세"를 `matchup`(엔진 함수)에 그대로 넣어 다시 물어보는 것뿐이다.
 */
function reactToCardPlay(def: CardDef, before: CombatState, after: CombatState): void {
  if (after.player.block > before.player.block) sfx.play('block');

  const struck = before.enemies.filter((e) => {
    const now = after.enemies.find((a) => a.uid === e.uid);
    return !now || now.hp < e.hp || now.block < e.block;
  });
  if (struck.length > 0 && def.line !== 'sul') {
    const m = worstMatchup(struck.map((e) => ({ attacker: def.line, defender: e.stance })));
    sfx.play(m === 'break' ? 'break' : 'hit');
  }

  const threshold = comboThreshold(before);
  if (!comboFires(before.combo, threshold) && comboFires(after.combo, threshold)) {
    sfx.play('combo');
  }
}

/** 적 턴 전체(여러 적이 한꺼번에 움직일 수 있다)의 결과를 보고 소리를 고른다. */
function reactToEnemyTurn(before: CombatState, after: CombatState): void {
  if (after.player.hp < before.player.hp) {
    const attackers = before.enemies.filter((e) => e.hp > 0 && e.intent?.kind === 'attack');
    const m = worstMatchup(
      attackers.map((e) => ({ attacker: e.intent!.line, defender: before.player.stance })),
    );
    sfx.play(m === 'break' ? 'break' : 'hit');
  }
}

function reactToPhase(before: CombatState, after: CombatState): void {
  if (before.phase !== 'won' && after.phase === 'won') sfx.play('victory');
  if (before.phase !== 'lost' && after.phase === 'lost') sfx.play('defeat');
}

type PileKind = 'draw' | 'discard';

const PILE_LABEL: Record<PileKind, string> = { draw: '뽑을 패', discard: '버린 패' };

export function renderCombat(api: AppApi, run: RunState): HTMLElement {
  const combat = run.combat;
  if (!combat) {
    // 도달할 수 없는 상태(run.ts 가 screen='combat' 과 combat 을 함께 세운다)지만,
    // 손상된 저장이 여기까지 오면 흰 화면 대신 나갈 길을 준다.
    return el('main', { class: 'screen combat' }, [
      el('h1', { textContent: '전투' }),
      el('p', { textContent: '전투 상태가 없습니다.' }),
      el('button', {
        class: 'btn', type: 'button', textContent: '지도로',
        onclick: () => api.dispatch({ type: 'leave' }),
      }),
    ]);
  }
  return renderBattle(api, run, combat);
}

function renderBattle(api: AppApi, run: RunState, combat: CombatState): HTMLElement {
  const root = el('main', { class: 'screen combat' });

  // 선택 상태는 이 호출의 클로저에만 산다. dispatch 하면 셸이 화면을 통째로 다시
  // 만들므로 자연히 초기화된다.
  const alive = (): EnemyState[] => combat.enemies.filter((e) => e.hp > 0);
  let selectedUid: string | null = null;
  let focusUid: string | null = alive()[0]?.uid ?? null;
  let pile: PileKind | null = null;

  const acting = combat.phase === 'player';

  const defOf = (card: CardInstance): CardDef =>
    effectiveCard(CONTENT.card(card.defId), card.upgraded);

  const focusEnemy = (): EnemyState | undefined => {
    const list = alive();
    return list.find((e) => e.uid === focusUid) ?? list[0];
  };

  const selectedCard = (): CardInstance | undefined =>
    combat.hand.find((c) => c.uid === selectedUid);

  function playCard(uid: string, targetUid?: string): void {
    selectedUid = null;
    const action: CombatAction = { type: 'playCard', uid, targetUid };
    // 소리는 실제 결과를 보고 고른다. `applyAction`은 순수 함수라 여기서 한 번
    // 더 불러도(디스패치가 실제 반영에서 다시 부른다) 결과가 갈리지 않는다 —
    // 규칙을 다시 계산하는 게 아니라 같은 규칙을 한 번 더 물어보는 것뿐이다.
    const card = combat.hand.find((c) => c.uid === uid);
    const result = applyAction(combat, action, CONTENT);
    sfx.play('card');
    if (card) reactToCardPlay(defOf(card), combat, result);
    reactToPhase(combat, result);
    api.dispatch({ type: 'combat', action });
  }

  /** 탭 한 번: 대상이 필요 없거나 적이 하나면 즉시 발동, 아니면 선택만 한다. */
  function pick(card: CardInstance): void {
    if (!canPlay(combat, card.uid, CONTENT)) return;
    const def = defOf(card);
    const targets = alive();
    if (def.target !== 'enemy' || targets.length <= 1) {
      playCard(card.uid);
      return;
    }
    selectedUid = selectedUid === card.uid ? null : card.uid;
    paint();
  }

  function tapEnemy(enemy: EnemyState): void {
    const chosen = selectedCard();
    if (chosen) {
      playCard(chosen.uid, enemy.uid);
      return;
    }
    focusUid = enemy.uid;
    paint();
  }

  function cancel(): void {
    if (pile !== null) {
      pile = null;
      paint();
      return;
    }
    if (selectedUid !== null) {
      selectedUid = null;
      paint();
    }
  }

  function endTurn(): void {
    if (!acting) return;
    selectedUid = null;
    const action: CombatAction = { type: 'endTurn' };
    const result = applyAction(combat, action, CONTENT);
    reactToEnemyTurn(combat, result);
    reactToPhase(combat, result);
    api.dispatch({ type: 'combat', action });
  }

  // ── 구역 ────────────────────────────────────────────────────────────────

  function topBar(): HTMLElement {
    const p = combat.player;
    const bars = el('div', { class: 'topbar-row bars' }, [
      renderMeter({ label: '체력', value: p.hp, max: p.maxHp, className: 'meter-hp' }),
      renderMeter({
        label: '호신강기', value: p.block, max: p.maxHp,
        className: 'meter-block', text: `⛨ ${p.block}`,
      }),
    ]);

    const qi = el('span', { class: 'qi' }, [el('span', { class: 'qi-label', textContent: '내공' })]);
    for (let i = 0; i < Math.max(p.maxQi, p.qi); i++) {
      qi.append(el('span', {
        class: `qi-pip${i < p.qi ? ' on' : ''}`, textContent: i < p.qi ? '●' : '○',
      }));
    }
    qi.append(el('span', { class: 'qi-text', textContent: `${p.qi}/${p.maxQi}` }));
    qi.setAttribute('role', 'meter');
    qi.setAttribute('aria-label', `내공 ${p.qi} / ${p.maxQi}`);
    qi.setAttribute('aria-valuenow', String(p.qi));
    qi.setAttribute('aria-valuemin', '0');
    qi.setAttribute('aria-valuemax', String(Math.max(p.maxQi, p.qi)));
    bars.append(qi);

    const meta = el('div', { class: 'topbar-row meta' }, [
      el('span', { class: 'turn-indicator', textContent: `${combat.turn}턴` }),
      el('span', { class: 'floor', textContent: `${run.act}막 · ${run.stats.floors}층` }),
      el('span', { class: 'my-stance' }, [
        el('span', { class: 'my-stance-label', textContent: '내 자세' }),
        renderLineChip(combat.player.stance),
      ]),
      renderStatusBadges(p.status),
    ]);

    const relics = el('div', { class: 'relics' });
    relics.setAttribute('aria-label', '기물');
    for (const id of p.relics) {
      let name = id;
      let hanja = '?';
      let text = '';
      try {
        const def = CONTENT.relic(id);
        name = def.name;
        hanja = def.hanja;
        text = def.text;
      } catch {
        text = '알 수 없는 기물';
      }
      const chip = el('span', { class: 'relic', title: `${name} — ${text}` }, [
        el('span', { class: 'relic-hanja', textContent: hanja }),
        el('span', { class: 'relic-name', textContent: name }),
      ]);
      chip.setAttribute('role', 'img');
      chip.setAttribute('aria-label', `기물 ${name}, ${text}`);
      relics.append(chip);
    }

    const bar = el('header', { class: 'topbar' }, [bars, meta]);
    if (p.relics.length > 0) bar.append(relics);
    return bar;
  }

  function enemyRow(): HTMLElement {
    const row = el('section', { class: 'enemy-row' });
    row.setAttribute('aria-label', '적');
    const targeting = selectedCard() !== undefined;

    for (const enemy of alive()) {
      const node = renderEnemy(enemy, {
        selected: targeting ? false : enemy.uid === focusEnemy()?.uid,
        playerStance: combat.player.stance,
        targetable: targeting,
      });
      node.addEventListener('click', () => tapEnemy(enemy));
      row.append(node);
    }
    return row;
  }

  function stanceZone(): HTMLElement {
    const chosen = selectedCard();
    const previewLine: Line | null = chosen ? defOf(chosen).line : null;
    return renderStanceBar(combat, { focusUid: focusEnemy()?.uid ?? null, previewLine });
  }

  function handSlot(card: CardInstance, index: number): HTMLElement {
    const def = defOf(card);
    const playable = canPlay(combat, card.uid, CONTENT);
    const face = renderCardFace(def, { upgraded: card.upgraded, playable });

    // 이 초식이 실제로 맞는 적들. 적 전체 초식은 살아있는 전부, 하나를 겨누는
    // 초식은 초점 적 하나다. 판정은 맞는 적 전부에 대해 참일 때만 한 장으로 적고,
    // 갈리면 갈린다고 적는다 — 상성은 적마다 따로 계산되기 때문이다.
    const hit: EnemyState[] = def.target === 'allEnemies'
      ? alive()
      : def.target === 'enemy' ? [focusEnemy()].filter((e): e is EnemyState => e !== undefined) : [];
    let verdict = '';
    if (hit.length > 0 && def.line !== 'sul') {
      const summary = summarizeVerdict(def.line, hit);
      if (summary.kind !== 'none') {
        verdict = verdictAriaText(summary);
        const badge = summary.kind === 'uniform' && summary.matchup
          ? el('span', { class: `card-mu mu-${summary.matchup}` }, [
            el('span', { class: 'mu-hanja', textContent: MATCHUP_LABEL[summary.matchup].hanja }),
            el('span', { class: 'mu-name', textContent: MATCHUP_LABEL[summary.matchup].name }),
          ])
          : el('span', { class: 'card-mu mu-mixed' }, [
            el('span', {
              class: 'mu-hanja',
              textContent: [...new Set(summary.perEnemy.map((p) => MATCHUP_LABEL[p.matchup].hanja))].join(''),
            }),
            el('span', { class: 'mu-name', textContent: '갈림' }),
          ]);
        badge.setAttribute('aria-hidden', 'true');
        face.append(badge);
        if (summary.kind === 'uniform' && summary.matchup) {
          face.classList.add(`verdict-${summary.matchup}`);
        }
      }
    }

    const slot = el('button', {
      class: `hand-slot${card.uid === selectedUid ? ' selected' : ''}`,
      type: 'button',
      disabled: !playable,
      dataset: { uid: card.uid, fkey: `card:${card.uid}` },
    }, [face]);

    if (index < 9) {
      const key = el('span', { class: 'hand-key', textContent: String(index + 1) });
      key.setAttribute('aria-hidden', 'true');
      slot.append(key);
    }

    const label = [cardAriaLabel(def, card.upgraded)];
    if (verdict) label.push(verdict);
    if (!playable) label.push('내공 부족');
    slot.setAttribute('aria-label', label.join(', '));
    slot.setAttribute('aria-pressed', String(card.uid === selectedUid));

    slot.addEventListener('click', () => pick(card));
    return slot;
  }

  function handRow(): HTMLElement {
    const hand = el('section', { class: 'hand' });
    hand.setAttribute('aria-label', '손패');
    if (combat.hand.length === 0) {
      hand.append(el('p', { class: 'hand-empty', textContent: '손패가 비었다. 턴을 넘겨라.' }));
      return hand;
    }
    combat.hand.forEach((card, i) => hand.append(handSlot(card, i)));
    return hand;
  }

  function pileButton(kind: PileKind, count: number): HTMLElement {
    const button = el('button', {
      class: 'btn', type: 'button', dataset: { fkey: `pile:${kind}` },
      textContent: `${PILE_LABEL[kind]} ${count}`,
    });
    button.setAttribute('aria-label', `${PILE_LABEL[kind]} ${count}장 보기`);
    button.addEventListener('click', () => {
      pile = pile === kind ? null : kind;
      paint();
    });
    return button;
  }

  function actionBar(): HTMLElement {
    const end = el('button', {
      class: 'btn primary end-turn', type: 'button', textContent: '턴 종료',
      disabled: !acting, title: '스페이스 / 엔터',
      dataset: { fkey: 'end-turn' },
    });
    end.addEventListener('click', endTurn);

    // 브리핑의 행동바 넷째 칸은 `설정`이지만 설정 화면이 아직 없다. 눌러도 아무
    // 일도 없는 버튼을 놓는 대신, 진행 중인 판을 저장한 채 타이틀로 빠지는
    // 실제 동작을 넣었다 (타이틀의 `이어하기`로 그대로 돌아온다).
    const leave = el('button', {
      class: 'btn quiet', type: 'button', textContent: '타이틀로',
      dataset: { fkey: 'to-title' },
    });
    leave.setAttribute('aria-label', '타이틀로 — 진행 상황은 저장된다');
    leave.addEventListener('click', () => api.toTitle());

    return el('nav', { class: 'combat-actions' }, [
      end,
      pileButton('draw', combat.draw.length),
      pileButton('discard', combat.discard.length),
      leave,
    ]);
  }

  function pileOverlay(kind: PileKind): HTMLElement {
    // 뽑을 패는 순서를 보이면 안 되는 정보다. 이름순으로 정렬해 내용만 보여준다.
    const cards = kind === 'draw'
      ? [...combat.draw].sort((a, b) => CONTENT.card(a.defId).name.localeCompare(CONTENT.card(b.defId).name, 'ko'))
      : [...combat.discard].reverse();

    const list = el('ul', { class: 'pile-list' });
    for (const card of cards) list.append(renderCardRow(defOf(card), card.upgraded));
    if (cards.length === 0) list.append(el('li', { class: 'pile-empty', textContent: '비어 있다.' }));

    const close = el('button', { class: 'btn', type: 'button', textContent: '닫기' });
    close.addEventListener('click', () => { pile = null; paint(); });

    const box = el('div', { class: 'pile-view' }, [
      el('div', { class: 'pile-head' }, [
        el('h2', { textContent: `${PILE_LABEL[kind]} ${cards.length}장` }),
        close,
      ]),
      list,
    ]);
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', PILE_LABEL[kind]);
    return box;
  }

  // ── 그리기 ──────────────────────────────────────────────────────────────

  function activeKey(): string | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    return active.closest<HTMLElement>('[data-fkey]')?.dataset.fkey ?? null;
  }

  function paint(): void {
    // 손패는 가로 스크롤이다. 다시 그릴 때 스크롤 위치를 안 지키면 카드를 고를
    // 때마다 손패가 맨 앞으로 튕겨, 방금 고른 카드가 화면 밖으로 사라진다.
    const key = activeKey();
    const scrolled = root.querySelector<HTMLElement>('.hand')?.scrollLeft ?? 0;

    clear(root);
    // 원경 산세 실루엣 — 순수 장식이라 aria-hidden, 클릭도 통과시킨다(CSS pointer-events:none).
    const backdrop = inkBackdrop(run.act);
    backdrop.classList.add('combat-backdrop');
    root.append(backdrop, topBar(), enemyRow(), stanceZone(), handRow(), actionBar());
    if (pile !== null) root.append(pileOverlay(pile));

    const hand = root.querySelector<HTMLElement>('.hand');
    if (hand) hand.scrollLeft = scrolled;
    if (key !== null) {
      const next = root.querySelector<HTMLElement>(`[data-fkey="${key}"]`);
      next?.focus({ preventScroll: true });
      next?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  // 빈 곳을 탭하면 선택이 풀린다. paint() 가 자식만 갈아치우므로 뿌리의 리스너는 산다.
  root.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('button')) return;
    cancel();
  });

  paint();

  // 해제 함수는 버리지 않고 무시한다 — 셸에 화면 해제 훅이 없어 부를 자리가 없고,
  // bindCombatKeys 는 root 가 문서에서 떨어지면 스스로 떨어지도록 만들어 두었다.
  bindCombatKeys(root, {
    play: (index) => {
      const card = combat.hand[index];
      if (card) pick(card);
    },
    endTurn,
    cancel,
  });

  return root;
}
