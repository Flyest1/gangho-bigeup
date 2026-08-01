// src/ui/components/deckview.ts
//
// 객잔(수련 대상 고르기) · 장터(제거 대상 고르기) · 맵(덱 보기)이 공유하는
// 덱 목록. 셋 다 "카드 실물의 요약 한 줄" 이 필요하고, 그중 둘은 그 줄을
// 눌러 고를 수 있어야 한다. 규칙(어떤 카드가 강화 가능한가 등)은 호출부가
// `filter` 로 건네고, 여기서는 다시 판정하지 않는다.
import { effectiveCard } from '../../engine/combat';
import { CONTENT } from '../../engine/gamedata';
import { LINE_LABEL } from '../../engine/stance';
import type { CardDef, CardInstance } from '../../engine/types';
import { el } from '../dom';
import { cardAriaLabel, renderCardRow } from './card';

export interface DeckListOpts {
  /** 있으면 각 줄이 진짜 버튼이 되어, 누르면 그 카드의 uid로 불린다. */
  onPick?(uid: string): void;
  /** 있으면 이 판정을 통과한 카드만 나열한다. */
  filter?(card: CardInstance): boolean;
  /** 나열할 카드가 하나도 없을 때 대신 보일 문구. */
  emptyText: string;
}

/** onPick 이 있을 때 쓰는, 눌러 고를 수 있는 한 줄. renderCardRow 와 같은 마크업이되 버튼이다. */
function pickableRow(def: CardDef, upgraded: boolean, onPick: (uid: string) => void, uid: string): HTMLElement {
  const line = LINE_LABEL[def.line];
  const button = el('button', { class: `card-row deck-row line-${def.line}`, type: 'button' }, [
    el('span', { class: 'card-row-cost', textContent: String(def.cost) }),
    el('span', { class: 'card-row-line', textContent: `${line.shape}${line.hanja}` }),
    el('span', { class: 'card-row-name', textContent: upgraded ? `${def.name}＋` : def.name }),
    el('span', { class: 'card-row-text', textContent: def.text }),
  ]);
  button.setAttribute('aria-label', cardAriaLabel(def, upgraded));
  button.addEventListener('click', () => onPick(uid));
  return el('li', {}, [button]);
}

export function renderDeckList(deck: CardInstance[], opts: DeckListOpts): HTMLElement {
  const list = el('ul', { class: 'deck-list' });
  const cards = opts.filter ? deck.filter(opts.filter) : deck;

  if (cards.length === 0) {
    list.append(el('li', { class: 'deck-list-empty', textContent: opts.emptyText }));
    return list;
  }

  const onPick = opts.onPick;
  for (const card of cards) {
    const def = effectiveCard(CONTENT.card(card.defId), card.upgraded);
    list.append(
      onPick ? pickableRow(def, card.upgraded, onPick, card.uid) : renderCardRow(def, card.upgraded),
    );
  }
  return list;
}
