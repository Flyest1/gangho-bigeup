import { CONTENT } from '../engine/gamedata';
import { applyRunAction, startRun, type RunAction, type RunState } from '../engine/run';
import { recordRunEnd, type SaveData } from '../engine/save';
import { randomSeedText } from '../engine/rng';
import { loadSave, persistSave } from '../platform/storage';
import { noticeHost } from './dom';
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
  saveNotice: string | null;
}

export interface AppApi {
  dispatch(action: RunAction): void;
  newRun(seedText?: string): void;
  toTitle(): void;
  resume(): void;
  dismissNotice(): void;
  dismissSaveNotice(): void;
  getState(): AppState;
}

const SAVE_FAILED_NOTICE =
  '저장에 실패했습니다. 비공개 모드이거나 저장 공간이 가득 찬 것 같습니다. 이 판은 이어서 할 수 없습니다.';

export function mountApp(root: HTMLElement): void {
  const loaded = loadSave();
  const state: AppState = {
    save: loaded.save,
    view: loaded.save.run && loaded.save.run.result === 'ongoing' ? 'run' : 'title',
    notice: loaded.quarantined.length
      ? `저장 기록 일부가 손상되어 격리했습니다 (${loaded.quarantined.join(', ')}). 나머지는 그대로 이어집니다.`
      : null,
    saveNotice: null,
  };

  // 저장 실패를 이미 알렸는지 추적한다. persistSave가 계속 실패하는 동안(같은 고장)
  // commit마다 다시 알리면, 플레이어가 알림을 닫아도 다음 행동에서 바로 되살아나
  // 사실상 닫을 수 없는 알림이 된다. 그래서 '고장으로 새로 접어드는 순간'에만 알리고,
  // 저장이 다시 성공하면 무장 해제해 그 뒤의 실패를 다시 '새로운' 고장으로 취급한다.
  let saveBroken = false;

  // PWA 모듈(platform/pwa.ts)의 배너가 여기 얹힐 수도 있는 자리다. render()가
  // 화면을 다시 그릴 때마다(카드 한 장만 내도) 통째로 지웠다 새로 만들면 그
  // 배너까지 같이 사라진다 — 그래서 한 번만 만들어 계속 살려 두고, 아래 render()는
  // 이 자리 자체가 아니라 그 안에서 "우리 몫"(.notice-own)만 지웠다 다시 쌓는다.
  const host = noticeHost(root);

  function commit(run: RunState | null): void {
    let save: SaveData = { ...state.save, run };
    if (run && run.result !== 'ongoing') {
      save = { ...save, meta: recordRunEnd(save.meta, run) };
    }
    state.save = save;
    const ok = persistSave(save);
    if (ok) {
      saveBroken = false;
    } else if (!saveBroken) {
      saveBroken = true;
      state.saveNotice = SAVE_FAILED_NOTICE;
    }
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
    dismissSaveNotice() {
      state.saveNotice = null;
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
    // host(알림 자리)는 남겨 둔다 — 화면 콘텐츠만 지우고 다시 그린다. host는
    // 더 이상 position:fixed로 떠 있지 않고 #app의 평범한 flex 자식이라(layout.css),
    // 문서 순서가 실제로 위아래 배치를 정한다 — 지운 뒤 화면을 append하면 항상
    // host *다음*에 붙으므로, host는 계속 맨 앞(위)에 남는다. 알림이 있으면 그
    // 높이만큼 화면이 밀려 내려가고(자리를 차지할 뿐 덮지 않는다), 화면은
    // flex-shrink로 남은 공간에 맞춰 줄어든다(전투 화면은 적 열이, 다른 화면은
    // 스크롤이 그 축소를 흡수한다).
    for (const child of [...root.children]) {
      if (child !== host) child.remove();
    }
    const run = state.save.run;
    root.append(state.view === 'run' && run ? screenFor(run) : renderTitle(api, state));

    // 격리 알림(불러올 때)과 저장 실패 알림(저장할 때)은 서로 다른 상태라 하나가
    // 다른 하나를 지우지 않는다. 둘 다 떠 있을 수 있으므로 쌓아서 보여준다.
    // host는 PWA 배너와 공유하는 자리라, 우리 몫(.notice-own)만 지우고 다시 쌓는다 —
    // 다른 출처가 얹어 둔 자식(예: pwa-banner)은 손대지 않는다.
    host.querySelectorAll('.notice-own').forEach((n) => n.remove());
    const notices: Array<{ text: string; dismiss: () => void }> = [];
    if (state.notice) notices.push({ text: state.notice, dismiss: () => api.dismissNotice() });
    if (state.saveNotice) notices.push({ text: state.saveNotice, dismiss: () => api.dismissSaveNotice() });
    for (const n of notices) host.append(renderNotice(n.text, n.dismiss));
  }

  render();
}

function renderNotice(text: string, onDismiss: () => void): HTMLElement {
  const box = document.createElement('div');
  box.className = 'notice notice-own';
  box.setAttribute('role', 'status');
  box.textContent = text;
  const close = document.createElement('button');
  close.className = 'notice-close';
  close.textContent = '×';
  close.setAttribute('aria-label', '알림 닫기');
  close.addEventListener('click', onDismiss);
  box.append(close);
  return box;
}
