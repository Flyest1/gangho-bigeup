// tests/e2e/smoke.spec.ts
//
// 시드 "스모크"는 장식이 아니다 — 개방 시작 덱(벽타×5, 방신×4, 취보×1)을
// 뽑아 섞었을 때 첫 전투의 손패 첫 장이 "취보"(대상 지정 피해 카드)로 나오는
// 시드를 tools 로 미리 확인하고 골랐다. 손패 첫 장이 방신(자신 대상, 호신강기
// 카드)이면 적 체력이 안 바뀌어 첫 시나리오가 시드와 무관하게 깨진다 — 그래서
// "아무 시드나 되겠지"가 아니라 실제로 엔진을 돌려 확인한 시드를 쓴다.
// 층 0(첫 노드)은 엔진이 항상 전투로 고정하므로(`generateMap`, `LAYER_WIDTHS[0] === 1`)
// 첫 노드가 "격전"이라는 가정은 시드와 무관하게 항상 참이다.
import { expect, test, type Page } from '@playwright/test';

/**
 * `waitForTimeout` 으로 "서비스워커가 프리캐시를 끝냈겠지"라고 짐작하지 않는다.
 * 처음엔 캐시 스토리지에 항목이 들어왔는지만 폴링했는데, 두 프로젝트 모두
 * `page.reload: net::ERR_INTERNET_DISCONNECTED` 로 죽었다 — 프리캐시는 SW의
 * install 단계에서 채워지지만, `registerType: 'prompt'`라 이 페이지가 실제로
 * 그 서비스워커의 통제를 받는 건 activate 이후 `clientsClaim()`이 끝난
 * 뒤이기 때문이다. 리로드가 오프라인에서 캐시로 응답받으려면 바로 그 통제가
 * 필요하므로, `navigator.serviceWorker.controller`가 잡혔는지까지 함께 본다.
 */
async function waitForOfflineReady(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      if (!('serviceWorker' in navigator) || !('caches' in window)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.active || !navigator.serviceWorker.controller) return false;
      const keys = await caches.keys();
      for (const key of keys) {
        const cache = await caches.open(key);
        const requests = await cache.keys();
        if (requests.length > 0) return true;
      }
      return false;
    },
    { timeout: 30_000 },
  );
  // 위 조건이 참이 된 순간에도 곧바로 오프라인으로 돌리면 가끔
  // `net::ERR_INTERNET_DISCONNECTED`로 리로드가 죽는다 — 렌더러가 보는
  // `controller` 플래그와 브라우저 프로세스 쪽 라우팅 테이블(이 오리진의
  // 요청을 SW로 넘길지 판단하는 실제 주체) 사이에 측정해 보니 100ms 안팎의
  // 지연이 있었다(로컬에서 0/100/200/300/500/800/1200ms 로 이분 탐색: 0ms만
  // 실패, 100ms부터 항상 성공). 실제 조건을 먼저 확인한 뒤에만 두는 여유
  // 시간이지, "그냥 기다리면 되겠지"로 조건 확인을 대신하는 게 아니다.
  await page.waitForTimeout(1000);
}

test('타이틀에서 새 강호행을 시작해 첫 전투에서 카드를 낸다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '강호비급' })).toBeVisible();

  await page.getByRole('textbox', { name: '시드' }).fill('스모크');
  await page.getByRole('button', { name: '새로운 강호행' }).click();

  await page.getByRole('button', { name: /격전/ }).first().click();
  await expect(page.locator('.combat')).toBeVisible();

  const hand = page.locator('.hand .card');
  await expect(hand.first()).toBeVisible();
  const before = await page.locator('.enemy').first().getAttribute('data-hp');
  await hand.first().click();
  await page.locator('.enemy').first().click();
  await expect.poll(async () =>
    page.locator('.enemy').first().getAttribute('data-hp')).not.toBe(before);
});

test('진행 중 런이 새로고침 뒤에도 이어진다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: '시드' }).fill('저장확인');
  await page.getByRole('button', { name: '새로운 강호행' }).click();
  await expect(page.locator('.map')).toBeVisible();

  await page.reload();
  await expect(page.locator('.map')).toBeVisible();
});

test('오프라인에서도 앱 셸이 뜬다', async ({ page, context }) => {
  await page.goto('/');
  await waitForOfflineReady(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '강호비급' })).toBeVisible();
  await context.setOffline(false);
});

test('턴 종료로 적이 행동하고 다음 턴이 온다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: '시드' }).fill('스모크');
  await page.getByRole('button', { name: '새로운 강호행' }).click();
  await page.getByRole('button', { name: /격전/ }).first().click();
  await page.getByRole('button', { name: '턴 종료' }).click();
  await expect(page.locator('.turn-indicator')).toContainText('2');
});

test('좁은 화면에서 알림이 쌓여도 손패가 뭉개지지 않는다', async ({ page }) => {
  // 360x640에서 알림 세 개(오프라인 준비·격리·저장 실패)가 함께 뜨면 손패 줄이
  // ~19px로 눌린다는 지적이 있었다. layout.css는 "전투 화면은 적 열이 그 축소를
  // 흡수한다"고 이미 선언해 두었지만, 그렇게 만드는 규칙은 어디에도 없었다.
  // 여기서 재는 것은 그 선언 그대로다 — 알림이 생겨도 손패 높이가 줄지 않는다.
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await page.getByRole('textbox', { name: '시드' }).fill('좁은화면');
  await page.getByRole('button', { name: '새로운 강호행' }).click();
  await page.getByRole('button', { name: /격전/ }).first().click();
  await expect(page.locator('.hand .card').first()).toBeVisible();

  const handHeight = async (): Promise<number> => {
    const box = await page.locator('.combat .hand').boundingBox();
    if (!box) throw new Error('손패 줄을 찾지 못했다');
    return box.height;
  };

  const before = await handHeight();
  expect(before).toBeGreaterThan(100); // 카드가 실제로 보이는 높이인지부터 확인

  // 알림 세 개를 실제 알림 자리에 얹는다. 출처(PWA 배너·격리·저장 실패)는
  // 레이아웃에 아무 영향이 없으므로 같은 모양의 요소를 직접 넣어도 같은 상황이다.
  await page.evaluate(() => {
    const host = document.querySelector('.notice-stack');
    if (!host) throw new Error('알림 자리가 없다');
    for (const text of ['오프라인 준비 완료', '저장 기록 일부가 손상되어 격리했습니다', '저장에 실패했습니다']) {
      const box = document.createElement('div');
      box.className = 'notice';
      box.textContent = text;
      host.append(box);
    }
  });
  await expect(page.locator('.notice')).toHaveCount(3);

  expect(await handHeight()).toBe(before);
});

test('탭 두 개를 열면 먼저 열린 탭이 저장을 멈추고 그 사실을 알린다', async ({ page, context }) => {
  // 검증에서 관찰한 그대로를 진짜 브라우저 두 탭으로 재현한다. happy-dom 테스트는
  // storage 이벤트를 손으로 만들어 쏘지만, 여기서는 브라우저가 실제로 보낸다.
  await page.goto('/');
  await page.getByRole('textbox', { name: '시드' }).fill('탭A');
  await page.getByRole('button', { name: '새로운 강호행' }).click();
  await expect(page.locator('.map')).toBeVisible();

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('.map')).toBeVisible(); // 같은 판을 이어받는다

  // 먼저 열린 탭이 소유권을 잃었다고 말한다. `.notice`만 보면 PWA 배너
  // (오프라인 준비 완료)가 같은 클래스로 먼저 잡히므로 앱이 얹는 몫만 겨눈다.
  await expect(page.locator('.notice-own')).toContainText('다른 탭');

  // 되찾으면 알림이 사라지고, 이번엔 나중에 연 탭이 소유권을 잃는다.
  await page.getByRole('button', { name: '이 탭에서 이어하기' }).click();
  await expect(page.locator('.notice-own')).toHaveCount(0);
  await expect(second.locator('.notice-own')).toContainText('다른 탭');

  await second.close();
});
