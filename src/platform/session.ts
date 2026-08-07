// src/platform/session.ts
//
// 탭 하나만 저장을 쥔다. localStorage 는 오리진 전체가 공유하는 한 통이라, 같은
// 게임을 두 탭에서 열면 둘 다 같은 열쇠로 같은 칸에 쓴다 — 나중에 쓴 쪽이 이기고
// 진 쪽은 그 사실조차 모른다. 브라우저는 이 상황을 알려 주는 수단을 하나 준다:
// `storage` 이벤트는 '쓴 탭'에는 오지 않고 다른 탭에만 온다. 그래서 탭마다 제
// 표식을 소유권 칸에 써 두면, 남이 그 칸을 덮어쓰는 순간 이쪽으로 알림이 온다.
//
// 잠그지는 않는다. 마지막에 연 탭이 이기는 것은 그대로 두되, 진 탭이 조용히
// 덮어쓰는 대신 저장을 멈추고 사용자에게 말한다. 되찾을 길도 남긴다.

export const SESSION_KEY = 'gangho.session.v1';

function defaultStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function defaultTarget(): EventTarget | null {
  return typeof window === 'undefined' ? null : window;
}

function newId(): string {
  // 탭을 구분하기만 하면 되므로 재현성이 필요 없다. 엔진 밖이라 Math.random 을
  // 그대로 쓴다 — 게임의 무작위는 전부 engine/rng.ts 의 시드를 거친다.
  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export interface SessionGuardOptions {
  store?: Storage | null;
  target?: EventTarget | null;
  /** 이 탭의 표식. 테스트에서만 지정한다. */
  id?: string;
  /** 소유권을 잃는 순간 한 번 불린다. 되찾기 전까지 다시 불리지 않는다. */
  onConflict?: () => void;
}

export interface SessionGuard {
  /** 소유권을 (다시) 주장한다. 다른 탭들은 이 순간 소유권을 잃는다. */
  claim(): void;
  /** 이 탭이 저장해도 되는가. */
  owns(): boolean;
  /** 이벤트 구독을 끊는다. */
  stop(): void;
}

export function createSessionGuard(opts: SessionGuardOptions = {}): SessionGuard {
  const store = opts.store === undefined ? defaultStore() : opts.store;
  const target = opts.target === undefined ? defaultTarget() : opts.target;
  const id = opts.id ?? newId();

  // 저장소가 없는 환경(비공개 모드 등)에서는 애초에 다툴 저장이 없다. 그런
  // 탭까지 "소유권 없음"으로 만들면 있지도 않은 충돌을 알리게 된다.
  let owned = true;

  const onStorage = (event: Event): void => {
    const e = event as StorageEvent;
    if (e.key !== SESSION_KEY) return;
    // 지운 것(newValue === null)은 소유권 주장이 아니다. 제 표식이 되돌아온
    // 경우도 마찬가지 — 실제 브라우저는 쓴 탭에 이벤트를 보내지 않지만,
    // 확장이나 다른 창이 같은 값을 다시 쓸 수는 있다.
    if (e.newValue === null || e.newValue === id) return;
    if (!owned) return;
    owned = false;
    opts.onConflict?.();
  };

  target?.addEventListener('storage', onStorage);

  return {
    claim(): void {
      owned = true;
      try {
        store?.setItem(SESSION_KEY, id);
      } catch {
        // 소유권 표식을 못 써도 이 탭은 계속 논다. 저장 자체의 실패는
        // storage.ts 의 persistSave 가 따로 알린다.
      }
    },
    owns: () => owned,
    stop(): void {
      target?.removeEventListener('storage', onStorage);
    },
  };
}
