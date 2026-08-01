import { emptySave, parseSave, serialize, type SaveData } from '../engine/save';

export const SAVE_KEY = 'gangho.save.v1';

function defaultStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSave(store: Storage | null = defaultStore()): { save: SaveData; quarantined: string[] } {
  if (!store) return { save: emptySave(), quarantined: [] };
  try {
    return parseSave(store.getItem(SAVE_KEY));
  } catch {
    return { save: emptySave(), quarantined: ['전체'] };
  }
}

export function persistSave(save: SaveData, store: Storage | null = defaultStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, serialize(save));
    return true;
  } catch {
    return false;
  }
}

export function exportSave(save: SaveData): string {
  return serialize(save);
}

export function importSave(text: string): SaveData | null {
  const { save, quarantined } = parseSave(text);
  return quarantined.includes('전체') ? null : save;
}
