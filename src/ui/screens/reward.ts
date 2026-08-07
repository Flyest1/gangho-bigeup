// src/ui/screens/reward.ts
//
// 엽전을 먼저 보이고, 기물 보상이 있으면 카드 위에 따로 띄운 뒤, 초식 3장을
// 실제 카드 면(전투 화면과 같은 컴포넌트)으로 나란히 놓는다. 어떤 카드를
// 주는지·기물이 무엇인지는 전부 `run.reward` 가 이미 정해 온 값이고, 여기서는
// 옮겨 적기만 한다.
import { CONTENT } from '../../engine/gamedata';
import type { RunState } from '../../engine/run';
import type { AppApi } from '../app';
import { cardAriaLabel, renderCardFace } from '../components/card';
import { renderRelicStrip } from '../components/relics';
import { el } from '../dom';

export function renderReward(api: AppApi, run: RunState): HTMLElement {
  const reward = run.reward;
  const root = el('main', { class: 'screen reward' });
  root.append(el('h1', { textContent: '보상' }));

  // 이미 가진 기물 띠. 아래의 `.reward-relic`(이번에 주는 기물)과는 다른 것이라
  // 상자 모양도 클래스도 다르다 — 둘이 같아 보이면 "받은 것"과 "가진 것"이 섞인다.
  const owned = renderRelicStrip(run.player.relics);
  if (owned) root.append(owned);

  if (!reward) {
    // 도달할 수 없는 상태(run.ts 가 screen='reward' 와 reward 를 함께 세운다)지만,
    // 손상된 저장이 여기까지 왔을 때 흰 화면 대신 나갈 길을 준다. `takeCard`는
    // reward 가 null 이면 run.ts(leaveReward)가 그대로 되돌리는 무효 액션이라
    // 나가는 길이 되지 못한다 — `toTitle`은 항상 유효하고, 진행 중인 런은
    // 그대로 둔 채 타이틀로만 뺀다(타이틀의 '이어하기'로 다시 들어올 수 있다).
    root.append(
      el('p', { textContent: '보상 정보가 없다.' }),
      el('button', {
        class: 'btn', type: 'button', textContent: '타이틀로',
        onclick: () => api.toTitle(),
      }),
    );
    return root;
  }

  root.append(el('p', { class: 'reward-gold', textContent: `엽전 ${reward.gold} 획득` }));

  if (reward.relic) {
    const def = CONTENT.relic(reward.relic);
    const box = el('div', { class: 'reward-relic' }, [
      el('span', { class: 'relic-hanja', textContent: def.hanja }),
      el('span', { class: 'relic-name', textContent: def.name }),
      el('span', { class: 'relic-text', textContent: def.text }),
    ]);
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', `기물 획득: ${def.name}, ${def.text}`);
    root.append(box);
  }

  const cardsRow = el('div', { class: 'reward-cards' });
  for (const cardId of reward.cards) {
    const def = CONTENT.card(cardId);
    const face = renderCardFace(def, { upgraded: false, playable: true });
    const btn = el('button', { class: 'reward-card-btn', type: 'button' }, [face]);
    btn.setAttribute('aria-label', `${cardAriaLabel(def, false)}, 이 초식을 보상으로 받는다`);
    btn.addEventListener('click', () => api.dispatch({ type: 'takeCard', cardId }));
    cardsRow.append(btn);
  }
  root.append(cardsRow);

  const skip = el('button', { class: 'btn quiet reward-skip', type: 'button', textContent: '넘기기' });
  skip.addEventListener('click', () => api.dispatch({ type: 'takeCard', cardId: null }));
  root.append(skip);

  return root;
}
