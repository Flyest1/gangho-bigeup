import type { AppApi } from '../app';
import type { RunState } from '../../engine/run';
import { el } from '../dom';

// Task 16 에서 실제 전투 UI(초식 선택, 기 표시 등)로 교체될 자리표시. 엔진에는
// 전투를 중도 포기하는 RunAction이 없으므로 '맵으로' 버튼은 지금은 아무 것도
// 바꾸지 않는다 — 실제 전투 진행은 Task 16의 몫이다.
export function renderCombat(api: AppApi, run: RunState): HTMLElement {
  return el('main', { class: 'screen' }, [
    el('h1', { textContent: '전투' }),
    el('p', { textContent: '(자리표시) Task 16에서 실제 전투 화면으로 교체됩니다.' }),
    el('button', { class: 'btn', textContent: '맵으로', onclick: () => api.dispatch({ type: 'leave' }) }),
  ]);
}
