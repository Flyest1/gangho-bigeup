// @vitest-environment happy-dom
//
// 탭 두 개가 한 저장을 공유하는 문제. 검증에서 실제로 관찰한 것: 탭 B를 열면
// 탭 A의 진행 중인 런을 그대로 이어받고, 그 뒤 양쪽이 각자 조작하면 나중에 쓴
// 쪽이 이긴다. 경고도 잠금도 없어서, 한 시간 플레이한 판이 다른 탭 때문에
// 사라져도 플레이어는 원인을 알 방법이 없다. 저장 실패는 배너로 알리면서
// 이 경우만 침묵했다.
//
// 여기서 고정하는 계약: 소유권을 잃은 탭은 (1) 더 이상 저장하지 않고,
// (2) 그 사실을 알리며, (3) 되찾을 길을 주고, (4) 되찾을 때는 제 기억이 아니라
// 저장소의 최신 판을 읽는다 — 그러지 않으면 되찾는 순간 상대 탭의 진행을 덮는다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountApp } from '../../src/ui/app';
import { SESSION_KEY } from '../../src/platform/session';
import { SAVE_KEY } from '../../src/platform/storage';

function noticeTexts(root: HTMLElement): string[] {
  return [...root.querySelectorAll('.notice')].map((n) => n.textContent ?? '');
}

function clickPrimary(root: HTMLElement): void {
  const button = root.querySelector('button.primary');
  if (!(button instanceof HTMLButtonElement)) throw new Error('주 버튼을 찾지 못했다');
  button.click();
}

function clickByText(root: HTMLElement, text: string): void {
  const button = [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  if (!button) throw new Error(`"${text}" 버튼을 찾지 못했다`);
  button.click();
}

/** 다른 탭이 소유권을 가져간 상황. 실제 브라우저에서 storage 이벤트는 '쓴 탭'이 아니라 다른 탭에만 온다. */
function otherTabClaims(): void {
  const previous = localStorage.getItem(SESSION_KEY);
  localStorage.setItem(SESSION_KEY, '다른탭');
  window.dispatchEvent(new StorageEvent('storage', {
    key: SESSION_KEY, oldValue: previous, newValue: '다른탭',
  }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { localStorage.clear(); });

describe('탭 소유권', () => {
  it('혼자 열려 있으면 아무 알림도 없고 저장도 정상이다', () => {
    const root = document.createElement('div');
    mountApp(root);
    clickPrimary(root);

    expect(noticeTexts(root)).toEqual([]);
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
  });

  it('다른 탭이 이어받으면 알린다', () => {
    const root = document.createElement('div');
    mountApp(root);
    clickPrimary(root);

    otherTabClaims();

    expect(noticeTexts(root).some((t) => t.includes('다른 탭'))).toBe(true);
  });

  it('소유권을 잃은 탭은 더 이상 저장하지 않는다', () => {
    const root = document.createElement('div');
    const api = mountApp(root);
    clickPrimary(root);

    otherTabClaims();
    // 상대 탭이 저장을 한 판 밀어 넣은 상태를 흉내 낸다.
    localStorage.setItem(SAVE_KEY, '{"version":1,"meta":{"version":1,"runsStarted":99,"runsWon":0,"bestAct":0,"bestFloors":0},"run":null}');

    const run = api.getState().save.run;
    if (!run) throw new Error('런이 시작되지 않았다');
    api.dispatch({ type: 'chooseNode', nodeId: run.map.layers[0]![0]! });

    // 이 탭의 조작이 상대 탭의 저장을 덮지 않았다.
    expect(localStorage.getItem(SAVE_KEY)).toContain('"runsStarted":99');
  });

  it('되찾으면 제 기억이 아니라 저장소의 최신 판을 읽는다', () => {
    const root = document.createElement('div');
    const api = mountApp(root);
    clickPrimary(root);
    expect(api.getState().save.meta.runsStarted).toBe(1);

    otherTabClaims();
    localStorage.setItem(SAVE_KEY, '{"version":1,"meta":{"version":1,"runsStarted":99,"runsWon":7,"bestAct":3,"bestFloors":18},"run":null}');

    clickByText(root, '이 탭에서 이어하기');

    // 낡은 메모리(runsStarted 1)를 그대로 다시 쓰면 상대 탭의 진행이 사라진다.
    expect(api.getState().save.meta.runsStarted).toBe(99);
    expect(api.getState().save.meta.runsWon).toBe(7);
    expect(noticeTexts(root).some((t) => t.includes('다른 탭'))).toBe(false);
  });

  it('되찾은 뒤에는 저장이 다시 된다', () => {
    const root = document.createElement('div');
    const api = mountApp(root);
    clickPrimary(root);

    otherTabClaims();
    clickByText(root, '이 탭에서 이어하기');

    api.newRun('되찾은뒤');
    expect(localStorage.getItem(SAVE_KEY)).toContain('되찾은뒤');
  });

  it('자기 자신이 쓴 소유권 표식에는 반응하지 않는다', () => {
    const root = document.createElement('div');
    mountApp(root);
    clickPrimary(root);

    const mine = localStorage.getItem(SESSION_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY, newValue: mine }));

    expect(noticeTexts(root)).toEqual([]);
  });

  it('저장 키가 바뀐 것만으로는 소유권을 잃지 않는다', () => {
    // 상대 탭이 저장만 하고 소유권을 주장하지 않는 경우는 없다(둘은 함께 간다).
    // 그래도 이 알림이 아무 storage 이벤트에나 튀어나오면 안 된다.
    const root = document.createElement('div');
    mountApp(root);
    clickPrimary(root);

    window.dispatchEvent(new StorageEvent('storage', { key: SAVE_KEY, newValue: '{}' }));

    expect(noticeTexts(root)).toEqual([]);
  });
});
