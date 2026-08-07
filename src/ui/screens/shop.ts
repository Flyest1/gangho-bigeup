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
import { renderRelicStrip } from '../components/relics';
import { el, trapFocus } from '../dom';

const REMOVE_ITEM = { hanja: '除', name: '초식 제거', text: '덱에서 초식 한 장을 골라 지운다.' };

export function renderShop(api: AppApi, run: RunState): HTMLElement {
  const root = el('main', { class: 'screen shop' });
  root.append(el('h1', { textContent: '장터' }));

  // 진열대에 놓인 기물과 이미 가진 기물은 다른 것이다. 중복 구매를 피하려면
  // 둘을 나란히 볼 수 있어야 하므로, 제거 목록 분기보다 앞에 둔다(두 분기 모두
  // 이 띠를 달고 나간다).
  const owned = renderRelicStrip(run.player.relics);
  if (owned) root.append(owned);

  const leave = el('button', { class: 'btn quiet shop-leave', type: 'button', textContent: '나가기' });
  leave.addEventListener('click', () => api.dispatch({ type: 'leave' }));

  if (run.pendingRemoval) {
    // 덱 보기·수련의 목록은 배경 화면 위에 얹히는 오버레이라 "연 버튼으로
    // 포커스를 되돌린다"는 게 뜻이 있다. 이 목록은 그게 아니다 — pendingRemoval
    // 은 RunState 에 실려 있는 값이라 어느 장터에 들어가든 이 화면 자체가 통째로
    // 이 모습으로 바뀐다(되돌아갈 "이전 화면"이 이 렌더 안에 없다). 그래서
    // trapFocus 의 오프너 복원은 쓰지 않되, Tab 가두기는 그대로 두고(알림 배너가
    // 떠 있어도 그리로 새지 않도록), 진입하자마자 초점을 이 구역의 제목으로 옮겨
    // 키보드 사용자가 항상 목록 맨 앞에서 시작하게 한다. Esc 는 `나가기`와
    // 같은 실제 동작(leave 디스패치)으로 이어져 막다른 길이 되지 않는다.
    const heading = el('h2', { class: 'shop-removal-heading', textContent: '제거할 초식 고르기', tabIndex: -1 });
    const section = el('section', { class: 'shop-removal' }, [
      heading,
      el('p', { class: 'shop-hint', textContent: '제거할 초식을 고르시오.' }),
      renderDeckList(run.player.deck, {
        emptyText: '덱이 비어 있다.',
        onPick: (uid) => api.dispatch({ type: 'removeCard', uid }),
      }),
      leave,
    ]);
    section.setAttribute('aria-label', '초식 제거');
    section.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        api.dispatch({ type: 'leave' });
      }
    });
    root.append(section);
    trapFocus(section);
    // trapFocus 자체도 첫 초점 요소(카드 목록의 첫 버튼)를 큐에 미뤄 잡아준다.
    // 이 화면은 목록 맨 앞이 아니라 제목에서 시작해야 하므로, 같은 방식으로
    // 한 틱 미뤄 그 뒤에 덮어쓴다 — 둘 다 문서에 붙기 전에 부르면 조용히
    // 무시되므로(위 trapFocus 주석 참조), 여기서도 순서를 지켜야 한다.
    queueMicrotask(() => heading.focus());
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
