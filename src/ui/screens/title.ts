import { sfx } from '../../audio/sfx';
import type { AppApi, AppState } from '../app';
import { el } from '../dom';

/** 소리 켬/끔. 어디서든 닿을 수 있어야 하니 항상 첫 화면인 타이틀에 둔다. */
function renderSoundToggle(): HTMLElement {
  const btn = el('button', { class: 'btn quiet sound-toggle', type: 'button' });
  const sync = (): void => {
    btn.textContent = sfx.enabled ? '소리 켜짐 ♪' : '소리 꺼짐 ⨯';
    btn.setAttribute('aria-pressed', String(sfx.enabled));
  };
  sync();
  btn.addEventListener('click', () => {
    sfx.setEnabled(!sfx.enabled);
    sync();
  });
  return btn;
}

export function renderTitle(api: AppApi, state: AppState): HTMLElement {
  const { meta, run } = state.save;
  const seedInput = el('input', {
    class: 'seed-input', type: 'text', placeholder: '시드 (비우면 무작위)',
    maxLength: 24, id: 'seed-input',
  });

  const actions = el('div', { class: 'title-actions' }, [
    el('button', {
      class: 'btn primary', type: 'button', textContent: '새로운 강호행',
      onclick: () => api.newRun(seedInput.value),
    }),
  ]);

  if (run && run.result === 'ongoing') {
    actions.prepend(el('button', {
      class: 'btn primary', type: 'button', textContent: `이어하기 — ${run.act}막`,
      onclick: () => api.resume(),
    }));
  }

  return el('main', { class: 'screen title' }, [
    el('h1', { class: 'title-name', textContent: '강호비급' }),
    el('p', { class: 'title-hanja', textContent: '江湖祕笈' }),
    el('p', { class: 'title-tagline', textContent: '초식을 모아 강호를 오른다' }),
    el('label', { class: 'seed-label', htmlFor: 'seed-input', textContent: '시드' }),
    seedInput,
    actions,
    renderSoundToggle(),
    el('p', { class: 'title-stats', textContent:
      `강호행 ${meta.runsStarted}회 · 완주 ${meta.runsWon}회 · 최고 ${meta.bestAct}막 ${meta.bestFloors}층` }),
    el('p', { class: 'fan', textContent:
      '김용 원작 세계관을 참조한 비공식·비영리 팬메이드 작품입니다. 원작 문장과 저작물은 사용하지 않았습니다.' }),
  ]);
}
