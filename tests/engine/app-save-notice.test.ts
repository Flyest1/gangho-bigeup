// @vitest-environment happy-dom
//
// mountApp()은 storage.ts를 인자 없이 호출해 실제 전역 localStorage에 저장한다.
// 그 경로(그리고 render()가 만드는 실제 DOM)를 그대로 타야 "commit()이 persistSave의
// 반환값을 다시 무시하게 되면 테스트가 빨갛게 변하는지" 증명할 수 있어, 이 파일만
// happy-dom 환경으로 돌린다. tests/engine/storage.test.ts의 나머지는 environment: 'node'
// (DOM 없음) 그대로 둔다.
//
// localStorage.setItem = fn 처럼 그냥 대입하면 happy-dom의 Storage가 이를 '값이
// setItem인 항목 저장'으로 받아들여 원래 메서드를 가려주지 않는다(Web Storage의 이름
// 있는 속성 설정 동작). Object.defineProperty로 실제 프로퍼티를 재정의해야 메서드가
// 진짜로 바뀐다. localStorage 자체가 Proxy라 delete로는 되돌릴 수 없어(trap이
// 거부한다), 대신 원래 구현을 캡처해 두었다가 같은 방식으로 다시 정의해 되돌린다.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountApp } from '../../src/ui/app';

const originalSetItem = localStorage.setItem.bind(localStorage);

function breakSetItem(): void {
  Object.defineProperty(localStorage, 'setItem', {
    configurable: true,
    value: () => { throw new Error('QuotaExceeded'); },
  });
}

function restoreSetItem(): void {
  Object.defineProperty(localStorage, 'setItem', {
    configurable: true,
    value: originalSetItem,
  });
}

function noticeTexts(root: HTMLElement): string[] {
  return [...root.querySelectorAll('.notice')].map((n) => n.textContent ?? '');
}

function clickPrimary(root: HTMLElement): void {
  const button = root.querySelector('button.primary');
  if (!(button instanceof HTMLButtonElement)) throw new Error('주 버튼을 찾지 못했다');
  button.click();
}

describe('저장 실패 알림', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // 다음 테스트에 깨진 setItem이 새어나가지 않도록 원래 구현으로 되돌린다.
    restoreSetItem();
  });

  it('저장이 막히면 실패 알림이 뜬다', () => {
    breakSetItem();

    const root = document.createElement('div');
    mountApp(root);
    clickPrimary(root); // 타이틀의 "새로운 강호행" → commit() → persistSave() 실패

    const texts = noticeTexts(root);
    expect(texts.some((t) => t.includes('저장에 실패했습니다'))).toBe(true);
  });

  it('알림을 닫으면 같은 고장이 이어지는 동안 다시 뜨지 않는다', () => {
    breakSetItem();

    const root = document.createElement('div');
    mountApp(root);
    clickPrimary(root); // 첫 실패 → 알림 등장
    expect(noticeTexts(root).some((t) => t.includes('저장에 실패했습니다'))).toBe(true);

    const closeBtn = root.querySelector('.notice-close');
    if (!(closeBtn instanceof HTMLButtonElement)) throw new Error('닫기 버튼을 찾지 못했다');
    closeBtn.click(); // 알림 닫기
    expect(noticeTexts(root).some((t) => t.includes('저장에 실패했습니다'))).toBe(false);

    // 지도 자리표시의 "맵으로" 버튼 — 여전히 같은 고장(setItem이 계속 던짐)인 채로
    // 한 번 더 commit()을 거친다. 닫아 둔 알림이 되살아나면 안 된다.
    const mapButton = root.querySelector('button');
    if (!(mapButton instanceof HTMLButtonElement)) throw new Error('버튼을 찾지 못했다');
    mapButton.click();

    expect(noticeTexts(root).some((t) => t.includes('저장에 실패했습니다'))).toBe(false);
  });

  it('불러오기 격리 알림은 저장 실패 알림에 지워지지 않는다', () => {
    // 손상된 저장을 미리 심어 mountApp이 격리 알림을 띄우게 한다.
    localStorage.setItem('gangho.save.v1', '망가진{{');
    // 그 다음 저장 자체도 막는다 — 두 알림이 동시에 뜰 수 있는 상황이다.
    breakSetItem();

    const root = document.createElement('div');
    mountApp(root);
    clickPrimary(root);

    const texts = noticeTexts(root);
    expect(texts.some((t) => t.includes('손상되어 격리했습니다'))).toBe(true);
    expect(texts.some((t) => t.includes('저장에 실패했습니다'))).toBe(true);
  });
});
