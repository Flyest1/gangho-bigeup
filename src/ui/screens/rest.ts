import type { AppApi } from '../app';
import type { RunState } from '../../engine/run';
import { el } from '../dom';

// Task 16 에서 실제 객잔(치료/단련 선택) UI로 교체될 자리표시. '맵으로' 버튼은
// 실제 RunAction(rest: heal)을 그대로 써서 진짜로 지도 화면까지 돌아간다.
export function renderRest(api: AppApi, run: RunState): HTMLElement {
  return el('main', { class: 'screen' }, [
    el('h1', { textContent: '객잔' }),
    el('p', { textContent: '(자리표시) Task 16에서 실제 객잔 화면으로 교체됩니다.' }),
    el('button', {
      class: 'btn', textContent: '맵으로',
      onclick: () => api.dispatch({ type: 'rest', choice: 'heal' }),
    }),
  ]);
}
