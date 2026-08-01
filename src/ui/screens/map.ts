import type { AppApi } from '../app';
import type { RunState } from '../../engine/run';
import { el } from '../dom';

// Task 16 에서 실제 지도(노드 선택)로 교체될 자리표시. 이미 지도 화면이므로
// '맵으로' 버튼은 아무 것도 바꾸지 않는 무해한 자리 맞춤이다.
export function renderMap(api: AppApi, run: RunState): HTMLElement {
  return el('main', { class: 'screen' }, [
    el('h1', { textContent: `지도 — ${run.act}막` }),
    el('p', { textContent: '(자리표시) Task 16에서 실제 지도로 교체됩니다.' }),
    el('button', { class: 'btn', textContent: '맵으로', onclick: () => api.dispatch({ type: 'leave' }) }),
  ]);
}
