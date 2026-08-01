// src/ui/components/card.ts
import { lineSigil, seedFromId } from '../../art/svg';
import { LINE_LABEL } from '../../engine/stance';
import type { CardDef } from '../../engine/types';
import { el } from '../dom';

export function renderCardFace(
  def: CardDef, opts: { upgraded: boolean; playable: boolean },
): HTMLElement {
  const line = LINE_LABEL[def.line];
  const name = opts.upgraded ? `${def.name}＋` : def.name;

  // 문양은 장식이다 — 계열 구분은 여전히 색+도형+한자(line-chip)가 맡는다.
  // seed는 카드 id에서 뽑아 같은 카드는 항상 같은 문양이, 다른 카드는(같은
  // 계열이라도) 다른 문양이 나오게 한다.
  const sigil = lineSigil(def.line, seedFromId(def.id));
  sigil.classList.add('card-sigil');

  return el('article', {
    class: `card line-${def.line} rarity-${def.rarity}${opts.playable ? '' : ' unplayable'}`,
  }, [
    sigil,
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
