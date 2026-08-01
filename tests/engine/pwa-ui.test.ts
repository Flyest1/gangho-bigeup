// @vitest-environment happy-dom
//
// platform/pwa.ts 회귀. `virtual:pwa-register`는 실제 빌드에만 존재하는 가상
// 모듈이라 여기서는 통째로 스텁한다 — 그래야 `registerSW`에 건넨 콜백
// (onNeedRefresh/onOfflineReady)을 직접 호출해 배너가 뜨는지 확인할 수 있다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

let capturedOptions: RegisterSWOptions | undefined;
const reloadSpy = vi.fn(async (_reload?: boolean) => {});
const registerSWMock = vi.fn((opts?: RegisterSWOptions) => {
  capturedOptions = opts;
  return reloadSpy;
});

vi.mock('virtual:pwa-register', () => ({
  registerSW: (opts?: RegisterSWOptions) => registerSWMock(opts),
}));

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  capturedOptions = undefined;
  registerSWMock.mockClear();
  reloadSpy.mockClear();
});

afterEach(() => {
  // document 스텁(아래 "SSR" 테스트)을 먼저 되돌려야, 이 뒤의 정리 코드가
  // document.body를 다시 건드릴 수 있다.
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('mountPwaUpdates', () => {
  it('registerSW를 즉시(immediate) 등록한다', async () => {
    const { mountPwaUpdates } = await import('../../src/platform/pwa');
    mountPwaUpdates();
    expect(registerSWMock).toHaveBeenCalledTimes(1);
    expect(capturedOptions?.immediate).toBe(true);
  });

  it('document가 없는 환경(SSR 등)에서는 던지지 않고 조용히 넘어간다', async () => {
    const { mountPwaUpdates } = await import('../../src/platform/pwa');
    vi.stubGlobal('document', undefined);
    expect(() => mountPwaUpdates()).not.toThrow();
    expect(registerSWMock).not.toHaveBeenCalled();
  });

  it('onNeedRefresh가 부르면 적용 버튼이 있는 배너가 뜨고, 누르면 리로드 콜백이 true로 불린다', async () => {
    const { mountPwaUpdates } = await import('../../src/platform/pwa');
    mountPwaUpdates();
    capturedOptions?.onNeedRefresh?.();

    const banner = document.getElementById('pwa-banner');
    expect(banner).not.toBeNull();
    expect(banner!.getAttribute('role')).toBe('alertdialog');
    expect(banner!.textContent).toContain('새 판본이 도착했습니다');

    const apply = banner!.querySelector<HTMLButtonElement>('button.btn');
    expect(apply).not.toBeNull();
    apply!.click();

    expect(reloadSpy).toHaveBeenCalledWith(true);
    expect(apply!.disabled).toBe(true);
  });

  it('onOfflineReady 배너는 확인 버튼 없이 뜨고, 시간이 지나면 스스로 사라진다', async () => {
    vi.useFakeTimers();
    try {
      const { mountPwaUpdates } = await import('../../src/platform/pwa');
      mountPwaUpdates();
      capturedOptions?.onOfflineReady?.();

      const banner = document.getElementById('pwa-banner');
      expect(banner).not.toBeNull();
      expect(banner!.getAttribute('role')).toBe('status');
      expect(banner!.textContent).toContain('오프라인 준비 완료');
      expect(banner!.querySelector('button.btn')).toBeNull(); // 적용 버튼이 없다.

      vi.advanceTimersByTime(4500);
      expect(document.getElementById('pwa-banner')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('닫기 버튼을 누르면 즉시 사라진다', async () => {
    const { mountPwaUpdates } = await import('../../src/platform/pwa');
    mountPwaUpdates();
    capturedOptions?.onOfflineReady?.();

    const close = document.querySelector<HTMLButtonElement>('#pwa-banner .notice-close');
    expect(close).not.toBeNull();
    close!.click();
    expect(document.getElementById('pwa-banner')).toBeNull();
  });

  it('새 배너가 뜨면 이전 배너를 대신한다(둘이 쌓이지 않는다)', async () => {
    const { mountPwaUpdates } = await import('../../src/platform/pwa');
    mountPwaUpdates();
    capturedOptions?.onOfflineReady?.();
    capturedOptions?.onNeedRefresh?.();

    expect(document.querySelectorAll('#pwa-banner')).toHaveLength(1);
    expect(document.getElementById('pwa-banner')!.textContent).toContain('새 판본이 도착했습니다');
  });

  it('app.ts의 알림과 같은 자리를 나눠 쓰고, 서로 지우지 않는다', async () => {
    // 손상된 저장을 심어 mountApp이 격리 알림을 띄우게 한다 — app.ts 쪽 알림이다.
    localStorage.setItem('gangho.save.v1', '망가진{{');

    const { mountApp } = await import('../../src/ui/app');
    const { mountPwaUpdates } = await import('../../src/platform/pwa');

    const root = document.createElement('div');
    document.body.append(root);
    mountApp(root);
    mountPwaUpdates();
    capturedOptions?.onNeedRefresh?.();

    // 둘 다 떠 있다 — 하나가 다른 하나의 자리를 차지하지 않는다.
    expect(root.querySelectorAll('.notice-own')).toHaveLength(1);
    expect(document.getElementById('pwa-banner')).not.toBeNull();

    // 앱 쪽에서 새로 렌더할 일(예: 알림 닫기)이 생겨도 pwa 배너는 그대로 남는다 —
    // render()가 host 전체가 아니라 자기 몫(.notice-own)만 지우기 때문이다.
    const dismiss = root.querySelector<HTMLButtonElement>('.notice-own .notice-close');
    expect(dismiss).not.toBeNull();
    dismiss!.click();
    expect(root.querySelectorAll('.notice-own')).toHaveLength(0);
    expect(document.getElementById('pwa-banner')).not.toBeNull();
  });
});
