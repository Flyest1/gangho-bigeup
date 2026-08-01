// src/ui/input.ts

export interface CombatKeyHandlers {
  /** 손패 index 번째(0부터)를 고른다. */
  play(index: number): void;
  endTurn(): void;
  cancel(): void;
}

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * 전투 단축키. `1`~`9` 손패, `Space`/`Enter` 턴 종료, `Esc` 취소. 반환값은 해제 함수.
 *
 * 리스너는 document 에 건다 — 셸이 dispatch 마다 화면을 통째로 다시 그려 포커스가
 * body 로 돌아가므로, 화면 요소에만 걸면 카드를 한 번 낸 뒤부터 키가 죽는다.
 * 대신 매 이벤트마다 `root.isConnected` 를 확인해, 떨어져 나간 화면의 리스너는
 * 스스로 떨어진다. 셸에 화면 해제 훅이 생기면 반환된 함수를 쓰면 된다.
 */
export function bindCombatKeys(root: HTMLElement, handlers: CombatKeyHandlers): () => void {
  const onKey = (event: KeyboardEvent): void => {
    if (!root.isConnected) {
      detach();
      return;
    }
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target && (target.isContentEditable || TYPING.has(target.tagName))) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      handlers.cancel();
      return;
    }

    if (event.key === ' ' || event.key === 'Enter') {
      // 버튼에 포커스가 있으면 브라우저가 이미 그 버튼을 누른다. 여기서 또 턴을
      // 넘기면 한 번의 키로 두 가지 일이 벌어진다.
      if (target && target.closest('button, a[href]')) return;
      event.preventDefault();
      handlers.endTurn();
      return;
    }

    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      handlers.play(Number(event.key) - 1);
    }
  };

  const detach = (): void => {
    document.removeEventListener('keydown', onKey);
  };

  document.addEventListener('keydown', onKey);
  return detach;
}
