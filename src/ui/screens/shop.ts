// src/ui/screens/shop.ts
//
// 장터. `run.pendingRemoval` 이 참이면 무엇을 보여줄지는 이미 엔진이 정해
// 두었다 — 진열대 대신 제거할 초식을 고르는 목록을 띄운다. 가격·구매 가능
// 여부는 전부 `run.player.gold`·`item.price` 를 그대로 비교만 할 뿐, 값 자체는
// 다시 계산하지 않는다.
import { CONTENT } from '../../engine/gamedata';
import type { RunState, ShopItem } from '../../engine/run';
import type { AppApi } from '../app';
import { cardAriaLabel, renderCardFace } from '../components/card';
import { renderDeckList } from '../components/deckview';
import { el } from '../dom';

const REMOVE_ITEM = { hanja: '除', name: '초식 제거', text: '덱에서 초식 한 장을 골라 지운다.' };

export function renderShop(api: AppApi, run: RunState): HTMLElement {
  const root = el('main', { class: 'screen shop' });
  root.append(el('h1', { textContent: '장터' }));

  const leave = el('button', { class: 'btn quiet shop-leave', type: 'button', textContent: '나가기' });
  leave.addEventListener('click', () => api.dispatch({ type: 'leave' }));

  if (run.pendingRemoval) {
    root.append(
      el('p', { class: 'shop-hint', textContent: '제거할 초식을 고르시오.' }),
      renderDeckList(run.player.deck, {
        emptyText: '덱이 비어 있다.',
        onPick: (uid) => api.dispatch({ type: 'removeCard', uid }),
      }),
      leave,
    );
    return root;
  }

  function shopItemCard(item: ShopItem, index: number): HTMLElement {
    const affordable = run.player.gold >= item.price;
    const buy = el('button', {
      class: 'btn shop-buy', type: 'button', textContent: '구매', disabled: !affordable,
    });
    if (!affordable) buy.setAttribute('aria-disabled', 'true');
    buy.addEventListener('click', () => {
      if (affordable) api.dispatch({ type: 'buy', index });
    });

    let body: HTMLElement;
    let label: string;
    if (item.kind === 'card') {
      const def = CONTENT.card(item.id);
      body = renderCardFace(def, { upgraded: false, playable: true });
      label = cardAriaLabel(def, false);
    } else if (item.kind === 'relic') {
      const def = CONTENT.relic(item.id);
      body = el('div', { class: 'shop-relic' }, [
        el('span', { class: 'relic-hanja', textContent: def.hanja }),
        el('span', { class: 'relic-name', textContent: def.name }),
        el('span', { class: 'relic-text', textContent: def.text }),
      ]);
      label = `기물 ${def.name}, ${def.text}`;
    } else {
      body = el('div', { class: 'shop-remove' }, [
        el('span', { class: 'relic-hanja', textContent: REMOVE_ITEM.hanja }),
        el('span', { class: 'relic-name', textContent: REMOVE_ITEM.name }),
        el('span', { class: 'relic-text', textContent: REMOVE_ITEM.text }),
      ]);
      label = `${REMOVE_ITEM.name}, ${REMOVE_ITEM.text}`;
    }

    const foot = el('div', { class: 'shop-item-foot' }, [
      el('span', { class: 'shop-item-price', textContent: `${item.price}냥` }),
      buy,
    ]);
    buy.setAttribute('aria-label', `${label}, ${item.price}냥, 구매${affordable ? '' : ', 엽전이 모자라 살 수 없다'}`);

    return el('article', { class: `shop-item shop-item-${item.kind}` }, [body, foot]);
  }

  const list = el('div', { class: 'shop-items' });
  (run.shop ?? []).forEach((item, index) => list.append(shopItemCard(item, index)));
  root.append(list, leave);
  return root;
}
