// src/ui/screens/result.ts
//
// 완주/전멸 요약. 클립보드 복사는 브라우저 API 이므로 실패(비보안 컨텍스트,
// 권한 거부 등)를 사용자에게 알리지 않고 그냥 넘어간다 — 시드는 다시 화면에도
// 적혀 있어 복사가 안 되어도 눈으로 옮겨 적을 길은 남는다.
import type { RunState } from '../../engine/run';
import type { AppApi } from '../app';
import { el } from '../dom';

export function renderResult(api: AppApi, run: RunState): HTMLElement {
  const victory = run.result === 'victory';
  const root = el('main', { class: `screen result ${victory ? 'victory' : 'defeat'}` });

  root.append(el('h1', {
    class: 'result-headline', textContent: victory ? '완주' : '전멸',
  }));

  const stats = el('dl', { class: 'result-stats' }, [
    el('dt', { textContent: '도달' }), el('dd', { textContent: `${run.act}막` }),
    el('dt', { textContent: '층수' }), el('dd', { textContent: `${run.stats.floors}층` }),
    el('dt', { textContent: '처치' }), el('dd', { textContent: `${run.stats.kills}` }),
  ]);
  root.append(stats);

  const feedback = el('span', { class: 'result-seed-feedback' });
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');

  const seedBtn = el('button', {
    class: 'btn quiet result-seed', type: 'button',
    textContent: `시드 ${run.seedText}`,
  });
  seedBtn.setAttribute('aria-label', `시드 ${run.seedText}, 눌러서 복사`);
  seedBtn.addEventListener('click', () => {
    try {
      navigator.clipboard?.writeText(run.seedText)
        .then(() => { feedback.textContent = '복사됨'; })
        .catch(() => { /* 조용히 넘어간다 */ });
    } catch {
      // 클립보드 API 자체가 없거나 던지는 환경 — 역시 조용히 넘어간다.
    }
  });
  root.append(el('div', { class: 'result-seed-row' }, [seedBtn, feedback]));

  const toTitle = el('button', { class: 'btn primary result-title', type: 'button', textContent: '타이틀로' });
  toTitle.addEventListener('click', () => api.toTitle());
  root.append(toTitle);

  return root;
}
