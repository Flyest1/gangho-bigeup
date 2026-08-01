import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

/**
 * `virtual:pwa-register`는 `vite-plugin-pwa`가 실제 빌드에서만 만들어 내는
 * 가상 모듈이다. 테스트에는 그 플러그인을 올리지 않는다(매니페스트 검증·서비스
 * 워커 생성 같은 무거운 부작용을 테스트에 끌어들이고 싶지 않다) — 하지만 아무
 * 플러그인도 이 식별자를 해석하지 못하면, `tests/engine/pwa-ui.test.ts`가
 * `vi.mock('virtual:pwa-register', ...)`으로 갈아치우기도 전에 Vite의
 * import-analysis가 "그런 모듈 없다"며 먼저 죽는다. 그래서 해석만 되는 빈
 * 자리를 만들어 둔다 — 실제 내용(빈 registerSW)은 그 테스트의 vi.mock이
 * 항상 덮어써서 실행되지 않는다.
 */
function stubVirtualPwaRegister(): Plugin {
  const id = 'virtual:pwa-register';
  return {
    name: 'stub-virtual-pwa-register',
    resolveId(source) {
      return source === id ? id : undefined;
    },
    load(source) {
      if (source !== id) return undefined;
      return 'export function registerSW() { return async () => {}; }';
    },
  };
}

export default defineConfig({
  plugins: [stubVirtualPwaRegister()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/engine/**/*.test.ts'],
  },
});
