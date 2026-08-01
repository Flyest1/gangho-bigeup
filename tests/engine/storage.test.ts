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
