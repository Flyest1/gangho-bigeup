// src/ui/screens/rest.ts
//
// 객잔. 회복량은 `restHealAmount` 가 낸 값을 그대로 버튼 글자에 옮긴다 — 화면이
// 비율(REST_HEAL_RATIO)을 따로 알고 다시 계산하면, 기물로 최대 체력이 바뀌는
// 순간 버튼 글자와 실제 회복량이 어긋난다. 수련 목록도 `canUpgrade` 로 걸러,
// 강화판이 없거나 이미 강화된 카드는 애초에 목록에 나타나지 않는다.
import { canUpgrade, restHealAmount, type RunState } from '../../engine/run';
import { CONTENT } from '../../engine/gamedata';
import type { AppApi } from '../app';
import { renderDeckList } from '../components/deckview';
import { el, trapFocus } from '../dom';

export function renderRest(api: AppApi, run: RunState): HTMLElement {
  const root = el('main', { class: 'screen rest' });
  root.append(el('h1', { textContent: '객잔' }));

  const heal = restHealAmount(run, CONTENT);
  const upgradeable = run.player.deck.filter((c) => canUpgrade(c, CONTENT));

  const healBtn = el('button', {
    class: 'btn primary rest-action', type: 'button',
    textContent: `휴식 — 체력 ${heal} 회복`,
  });
  healBtn.addEventListener('click', () => api.dispatch({ type: 'rest', choice: 'heal' }));

  const upgradeBtn = el('button', {
    class: 'btn rest-action', type: 'button',
    textContent: '수련 — 초식 1장 강화',
    disabled: upgradeable.length === 0,
  });
  if (upgradeable.length === 0) {
    upgradeBtn.setAttribute('aria-disabled', 'true');
    upgradeBtn.title = '강화할 수 있는 초식이 없다.';
  }
  upgradeBtn.addEventListener('click', openUpgradeList);

  root.append(el('div', { class: 'rest-actions' }, [healBtn, upgradeBtn]));

  function buildOverlay(onClose: () => void): HTMLElement {
    const close = el('button', { class: 'btn', type: 'button', textContent: '닫기' });
    close.addEventListener('click', onClose);

    const list = renderDeckList(run.player.deck, {
      filter: (c) => canUpgrade(c, CONTENT),
      emptyText: '강화할 수 있는 초식이 없다.',
      onPick: (uid) => api.dispatch({ type: 'rest', choice: 'upgrade', uid }),
    });

    const box = el('div', { class: 'modal-view' }, [
      el('div', { class: 'modal-head' }, [
        el('h2', { textContent: '수련 — 강화할 초식 고르기' }),
        close,
      ]),
      list,
    ]);
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', '수련');
    box.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    });
    return box;
  }

  function openUpgradeList(): void {
    let untrap: (() => void) | null = null;
    const overlay = buildOverlay(() => {
      untrap?.();
      overlay.remove();
    });
    root.append(overlay);
    untrap = trapFocus(overlay);
  }

  return root;
}
