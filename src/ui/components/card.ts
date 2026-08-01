// src/ui/components/card.ts
import { LINE_LABEL } from '../../engine/stance';
import type { CardDef } from '../../engine/types';
import { el } from '../dom';

export function renderCardFace(
  def: CardDef, opts: { upgraded: boolean; playable: boolean },
): HTMLElement {
  const line = LINE_LABEL[def.line];
  const name = opts.upgraded ? `${def.name}＋` : def.name;

  return el('article', {
    class: `card line-${def.line} rarity-${def.rarity}${opts.playable ? '' : ' unplayable'}`,
  }, [
    el('div', { class: 'card-cost', textContent: String(def.cost) }),
    el('div', { class: 'card-line', title: line.name }, [
      el('span', { class: 'card-line-shape', textContent: line.shape }),
      el('span', { class: 'card-line-hanja', textContent: line.hanja }),
    ]),
    el('h3', { class: 'card-name', textContent: name }),
    el('p', { class: 'card-hanja', textContent: def.hanja }),
    el('p', { class: 'card-text', textContent: def.text }),
  ]);
}

export function cardAriaLabel(def: CardDef, upgraded: boolean): string {
  const line = LINE_LABEL[def.line];
  return `${def.name}${upgraded ? ' 강화' : ''}, ${line.name}, 내공 ${def.cost}, ${def.text}`;
}

/**
 * 덱·버린 패 목록에 쓰는 한 줄 요약. 카드 면을 그대로 쓰면 목록이 화면을 넘긴다.
 * 계열은 여기서도 색만으로 구분하지 않도록 도형·한자를 함께 적는다.
 */
export function renderCardRow(def: CardDef, upgraded: boolean): HTMLElement {
  const line = LINE_LABEL[def.line];
  return el('li', { class: `card-row line-${def.line}` }, [
    el('span', { class: 'card-row-cost', textContent: String(def.cost) }),
    el('span', { class: 'card-row-line', textContent: `${line.shape}${line.hanja}` }),
    el('span', { class: 'card-row-name', textContent: upgraded ? `${def.name}＋` : def.name }),
    el('span', { class: 'card-row-text', textContent: def.text }),
  ]);
}
