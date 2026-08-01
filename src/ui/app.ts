import { CONTENT } from '../engine/gamedata';
import { applyRunAction, startRun, type RunAction, type RunState } from '../engine/run';
import { recordRunEnd, type SaveData } from '../engine/save';
import { randomSeedText } from '../engine/rng';
import { loadSave, persistSave } from '../platform/storage';
import { clear } from './dom';
import { renderTitle } from './screens/title';
import { renderCombat } from './screens/combat';
import { renderMap } from './screens/map';
import { renderReward } from './screens/reward';
import { renderRest } from './screens/rest';
import { renderShop } from './screens/shop';
import { renderResult } from './screens/result';

export interface AppState {
  save: SaveData;
  view: 'title' | 'run';
  notice: string | null;
}

export interface AppApi {
  dispatch(action: RunAction): void;
  newRun(seedText?: string): void;
  toTitle(): void;
  resume(): void;
  dismissNotice(): void;
  getState(): AppState;
}

export function mountApp(root: HTMLElement): void {
  const loaded = loadSave();
  const state: AppState = {
    save: loaded.save,
    view: loaded.save.run && loaded.save.run.result === 'ongoing' ? 'run' : 'title',
    notice: loaded.quarantined.length
      ? `저장 기록 일부가 손상되어 격리했습니다 (${loaded.quarantined.join(', ')}). 나머지는 그대로 이어집니다.`
      : null,
  };

  function commit(run: RunState | null): void {
    let save: SaveData = { ...state.save, run };
    if (run && run.result !== 'ongoing') {
      save = { ...save, meta: recordRunEnd(save.meta, run) };
    }
    state.save = save;
    persistSave(save);
    render();
  }

  const api: AppApi = {
    dispatch(action) {
      const run = state.save.run;
      if (!run) return;
      commit(applyRunAction(run, action, CONTENT));
    },
    newRun(seedText) {
      const seed = seedText && seedText.trim() ? seedText.trim() : randomSeedText();
      const run = startRun(seed, CONTENT);
      state.view = 'run';
      state.save = { ...state.save, meta: { ...state.save.meta, runsStarted: state.save.meta.runsStarted + 1 } };
      commit(run);
    },
    toTitle() {
      state.view = 'title';
      render();
    },
    resume() {
      state.view = 'run';
      render();
    },
    dismissNotice() {
      state.notice = null;
      render();
    },
    getState: () => state,
  };

  function screenFor(run: RunState): HTMLElement {
    switch (run.screen) {
      case 'combat': return renderCombat(api, run);
      case 'reward': return renderReward(api, run);
      case 'rest': return renderRest(api, run);
      case 'shop': return renderShop(api, run);
      case 'result': return renderResult(api, run);
      default: return renderMap(api, run);
    }
  }

  function render(): void {
    clear(root);
    const run = state.save.run;
    root.append(state.view === 'run' && run ? screenFor(run) : renderTitle(api, state));
    if (state.notice) root.append(renderNotice(state.notice, api));
  }

  render();
}

function renderNotice(text: string, api: AppApi): HTMLElement {
  const box = document.createElement('div');
  box.className = 'notice';
  box.setAttribute('role', 'status');
  box.textContent = text;
  const close = document.createElement('button');
  close.className = 'notice-close';
  close.textContent = '×';
  close.setAttribute('aria-label', '알림 닫기');
  close.addEventListener('click', () => api.dismissNotice());
  box.append(close);
  return box;
}
