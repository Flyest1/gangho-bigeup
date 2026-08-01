import type { AppApi } from '../app';
import type { RunState } from '../../engine/run';
import { el } from '../dom';

// Task 17 에서 실제 결과(승리/패배 요약) UI로 교체될 자리표시. 이 화면에
// 도달했을 때는 이미 강호행이 끝난 뒤(승리 또는 패배)라 되돌아갈 지도가 없다.
// 그래서 다른 다섯 자리표시와 달리 '맵으로'가 아니라 '타이틀로' 버튼을 둔다 —
// 브리핑이 요구한 문구를 그대로 옮기면 클릭해도 아무 데도 못 가는 죽은 버튼이
// 되어 버리기 때문에, 실제로 갈 수 있는 곳으로 이어지는 버튼을 넣었다.
export function renderResult(api: AppApi, run: RunState): HTMLElement {
  const label = run.result === 'victory' ? '승리' : '패배';
  return el('main', { class: 'screen' }, [
    el('h1', { textContent: `결과 — ${label}` }),
    el('p', { textContent: '(자리표시) Task 17에서 실제 결과 화면으로 교체됩니다.' }),
    el('button', { class: 'btn', textContent: '타이틀로', onclick: () => api.toTitle() }),
  ]);
}
