// src/platform/pwa.ts
//
// `virtual:pwa-register`의 `registerSW`를 감싸 두 배너를 띄운다 — 새 판본이
// 오면 "적용" 버튼과 함께, 오프라인 준비가 끝나면 잠깐 스치듯. 이 모듈은
// 브라우저에서 실제 서비스 워커가 등록될 때만 뜻이 있다: vitest와 SSR에는
// `document`가 없거나 이 가상 모듈이 실제로 번들되지 않으므로, 그런 환경에서
// 불려도 조용히 아무 일도 하지 않아야 한다 — 던지면 앱 전체가 죽는다.
//
// 배너는 `ui/dom.ts`의 `noticeHost()`가 내주는 자리에 얹는다. app.ts의 알림
// (격리·저장 실패)도 같은 자리를 쓰므로, 둘 중 누가 먼저 뜨든 같은 세로
// 스택 안에서 자연히 겹치지 않고 쌓인다 — 그리고 전투 화면의 행동바(맨
// 아래)와도 겹치지 않는다(그 자리 자체가 위쪽에 고정되어 있다, layout.css).
import { registerSW } from 'virtual:pwa-register';
import { noticeHost } from '../ui/dom';

export function mountPwaUpdates(): void {
  if (typeof document === 'undefined') return;

  try {
    let update: (reload?: boolean) => Promise<void> = async () => {};
    update = registerSW({
      immediate: true,
      onNeedRefresh() {
        showBanner('새 판본이 도착했습니다', '저장 기록을 유지한 채 교체합니다.', () => void update(true));
      },
      onOfflineReady() {
        showBanner('오프라인 준비 완료', '연결이 끊겨도 계속 플레이할 수 있습니다.', null);
      },
    });
  } catch {
    // registerSW 자체를 부를 수 없는 환경(테스트가 이 모듈을 스텁하지 않고
    // 부른 경우 등) — 배너 없이 넘어간다. 실제 플레이는 이 모듈과 무관하다.
  }
}

function showBanner(title: string, body: string, onApply: (() => void) | null): void {
  const host = noticeHost();
  document.getElementById('pwa-banner')?.remove();

  const box = document.createElement('section');
  box.id = 'pwa-banner';
  box.className = 'notice';
  box.setAttribute('role', onApply ? 'alertdialog' : 'status');

  const text = document.createElement('div');
  text.className = 'notice-text';
  text.append(
    Object.assign(document.createElement('strong'), { textContent: title }),
    Object.assign(document.createElement('span'), { textContent: body }),
  );
  box.append(text);

  if (onApply) {
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'btn small';
    apply.textContent = '적용';
    apply.addEventListener('click', () => { apply.disabled = true; onApply(); });
    box.append(apply);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'notice-close';
  close.textContent = '×';
  close.setAttribute('aria-label', '알림 닫기');
  close.addEventListener('click', () => box.remove());
  box.append(close);

  host.append(box);
  // 오프라인 준비 알림은 확인 버튼이 없다 — 계속 떠 있으면 다음 알림을
  // 가리는 죽은 배너가 되므로, 읽을 시간을 준 뒤 스스로 걷힌다.
  if (!onApply) setTimeout(() => box.remove(), 4500);
}
