type Props<K extends keyof HTMLElementTagNameMap> =
  Partial<Omit<HTMLElementTagNameMap[K], 'dataset' | 'className' | 'style'>> & {
    class?: string;
    dataset?: Record<string, string>;
    aria?: Record<string, string>;
  };

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Props<K> = {}, children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: className, dataset, aria, ...rest } = props;
  if (className) node.className = className;
  for (const [k, v] of Object.entries(dataset ?? {})) node.dataset[k] = v;
  for (const [k, v] of Object.entries(aria ?? {})) node.setAttribute(`aria-${k}`, v);
  Object.assign(node, rest);
  for (const child of children) node.append(child);
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 모달 오버레이 안에 포커스를 가둔다. 여는 순간 첫 초점 요소로 포커스를 옮기고,
 * Tab이 오버레이 밖으로 새지 않게 순환시킨다. 반환된 해제 함수를 오버레이를
 * 걷어내기 *직전에* 부르면, 그 오버레이를 열기 전 포커스가 있던 요소로 되돌아간다.
 * (dispatch로 화면 전체가 새로 그려져 사라지는 경우는 대상이 이미 없으니 그냥 넘어간다.)
 */
export function trapFocus(container: HTMLElement): () => void {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const focusables = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
  // container가 아직 문서에 붙지 않은 채로 이 함수가 불릴 수 있다 — 화면을 처음
  // 그리는 도중에 이미 목록 상태로 시작하는 경우(예: 장터가 pendingRemoval을
  // 든 채 렌더되는 경우)가 그렇다. 붙기 전에 focus()를 부르면 브라우저가 조용히
  // 무시하므로, 큐에 미뤄 두면 이 렌더 함수가 반환되고 호출부(app.ts의 render())가
  // 트리를 문서에 붙인 다음에 실행되어 항상 제대로 먹는다. 이미 붙어 있던 경우
  // (실제 오버레이를 여는 클릭 핸들러 안)에도 한 틱 늦게 초점이 옮겨질 뿐이라
  // 체감되는 차이가 없다.
  queueMicrotask(() => focusables()[0]?.focus());

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;
    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', onKeydown);

  return () => {
    container.removeEventListener('keydown', onKeydown);
    if (opener && opener.isConnected) opener.focus();
  };
}

/**
 * 알림이 함께 쌓이는 자리. app.ts(격리·저장 실패 알림)와 platform/pwa.ts(새 판본·
 * 오프라인 준비 배너)가 같은 화면 조각을 나눠 쓴다 — 어느 쪽도 다른 쪽을 가리면
 * 안 되므로, 둘 다 이 한 그릇에 쌓아 CSS가 세로로만 늘어놓게 한다(겹치지 않음).
 * `document.getElementById`로 이미 있으면 그 자리를 그대로 돌려주고(멱등),
 * 없으면 `parent` 밑에 새로 만든다. app.ts는 자신의 `root`를 parent로 넘겨
 * (mountApp이 여러 번 따로 인스턴스화되는 테스트에서도) 알림이 그 root의
 * 자손으로 남게 하고, pwa.ts는 인자 없이 불러 이미 만들어진 자리를 찾아 쓴다.
 */
export function noticeHost(parent: HTMLElement = document.body): HTMLElement {
  const found = document.getElementById('notice-host');
  if (found) return found;
  const host = document.createElement('div');
  host.id = 'notice-host';
  host.className = 'notice-stack';
  parent.append(host);
  return host;
}
