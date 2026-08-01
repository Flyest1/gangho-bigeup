import { describe, it, expect } from 'vitest';
import { loadSave, persistSave, exportSave, importSave, SAVE_KEY } from '../../src/platform/storage';
import { emptySave } from '../../src/engine/save';
import { startRun } from '../../src/engine/run';
import { CONTENT } from '../../src/engine/gamedata';

function memoryStore(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => { map.delete(k); },
    setItem: (k, v) => { map.set(k, v); },
  };
}

describe('저장 브릿지', () => {
  it('저장하고 불러오면 같은 내용이다', () => {
    const store = memoryStore();
    const save = { ...emptySave(), run: startRun('브릿지', CONTENT) };
    expect(persistSave(save, store)).toBe(true);
    expect(loadSave(store).save.run?.seedText).toBe('브릿지');
  });

  it('저장이 없으면 빈 저장을 준다', () => {
    expect(loadSave(memoryStore()).save).toEqual(emptySave());
  });

  it('쓰기가 막혀도 던지지 않고 false를 준다', () => {
    const store = { ...memoryStore(), setItem: () => { throw new Error('QuotaExceeded'); } } as Storage;
    expect(persistSave(emptySave(), store)).toBe(false);
  });

  it('손상된 값은 격리하고 빈 저장으로 복구한다', () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, '망가진{{');
    const out = loadSave(store);
    expect(out.save).toEqual(emptySave());
    expect(out.quarantined).toContain('전체');
  });

  it('내보내기와 가져오기가 왕복한다', () => {
    const save = { ...emptySave(), run: startRun('왕복', CONTENT) };
    expect(importSave(exportSave(save))?.run?.seedText).toBe('왕복');
  });

  it('잘못된 가져오기는 null이다', () => {
    expect(importSave('아무말')).toBeNull();
  });
});

// defaultStore()는 export되지 않으므로 loadSave/persistSave를 store 인자 없이 호출해
// 간접적으로 검증한다. 이 파일은 vitest.config.ts의 environment: 'node'로 돌아 DOM이
// 없고, 전역 localStorage도 정의돼 있지 않다 — 그래서 아래 첫 테스트는 준비 없이도
// '전역이 아예 없는' 분기를 그대로 탄다.
describe('기본 저장소(localStorage) 없음/차단 대체 동작', () => {
  it('전역 localStorage가 아예 없으면 저장 없이 안전하게 진행한다', () => {
    expect(typeof localStorage).toBe('undefined');
    expect(loadSave()).toEqual({ save: emptySave(), quarantined: [] });
    expect(persistSave(emptySave())).toBe(false);
  });

  it('localStorage 참조 자체가 던지면(사생활 모드 등) 없는 것으로 친다', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get(): never { throw new Error('SecurityError: 접근이 차단되었습니다'); },
    });
    try {
      expect(loadSave()).toEqual({ save: emptySave(), quarantined: [] });
      expect(persistSave(emptySave())).toBe(false);
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
    expect(typeof localStorage).toBe('undefined');
  });
});
