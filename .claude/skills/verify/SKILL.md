---
name: verify
description: Build, launch and drive 강호비급 to capture runtime evidence. Use when verifying a change to this game — the surface is a browser, not the test suite.
---

# 강호비급 검증 레시피

이 프로젝트의 표면은 **브라우저**다. `npm run test`는 CI가 이미 돌린다 — 검증은 앱을 실제로 몰아서 관찰하는 것이다.

## 어디를 몰 것인가

- **배포본(권장)**: `https://flyest1.github.io/gangho-bigeup/` — 사용자가 실제로 만나는 곳. 커밋이 푸시됐고 CI가 초록이면 여기를 몰면 된다.
- **로컬**: `npm run build && npm run preview` → `http://localhost:4173/gangho-bigeup/`. 아직 안 푸시한 변경을 볼 때만.

`npm run dev`는 서비스워커가 안 붙으므로 **오프라인·PWA 검증에는 쓰지 말 것**.

## 핸들

`@playwright/test`가 devDependency이고 크로미움도 설치돼 있다. **드라이버 스크립트는 반드시 리포 안에 두어야** `@playwright/test`가 해석된다 (`.superpowers/`는 gitignore됨).

```js
// .superpowers/drive.mjs — 리포 루트에서 `node .superpowers/drive.mjs`
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // 모바일 세로가 1차 타깃
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('https://flyest1.github.io/gangho-bigeup/', { waitUntil: 'networkidle' });
```

**함정**: Node에서 `page.screenshot({ path: '/tmp/x.png' })`는 Git Bash의 `/tmp`가 아니라 `C:\tmp`에 쓴다. 절대 경로(`C:/tmp/verify`)를 쓰고 거기서 읽을 것.

## 최소 경로: 타이틀 → 전투

```js
await page.getByRole('textbox', { name: '시드' }).fill('아무시드');   // 시드를 넣어야 재현된다
await page.getByRole('button', { name: '새로운 강호행' }).click();
await page.waitForSelector('.map');
// 활성화된 노드 버튼만 누를 수 있다 (도달 불가 노드는 disabled)
const nodes = page.getByRole('button').filter({ hasText: /격전|정예|객잔|장터|관문/ });
// ... isEnabled()인 첫 번째를 클릭
await page.waitForSelector('.combat');
```

카드 플레이는 **적이 둘 이상이면 2단계**다: 카드 클릭 → 적 클릭. 적이 하나면 즉시 발동.

## DOM 훅 (Task 20 E2E가 의존하는 것들)

`.combat` · `.map` · `.reward` · `.rest` · `.shop` · `.result` · `.hand .card` · `.enemy[data-hp]` · `.turn-indicator` · `.combat .topbar` · 접근 가능한 이름 `턴 종료`

화면 판별은 이 셀렉터들을 순서대로 세어 보면 된다.

## 몰아볼 가치가 있는 흐름

- **전투 산술**: `.enemy[data-hp]` 전후 차이가 `(기본 + 기세) × 상성배율`과 맞는지. 파훼는 ×1.5에 호신강기 무시.
- **적 의도 수치**: 화면 값은 엔진 계산값이지 데이터 원본이 아니다. 들개 물어뜯기는 데이터상 6인데 저항이면 4로 표시된다.
- **연계**: 같은 계열 3장을 이으면 `0/3 → 3/3`.
- **손상 저장**: `localStorage['gangho.save.v1']`에 망가진 값을 넣고 리로드 → 흰 화면이 아니라 격리 알림이 떠야 한다.
- **오프라인**: `navigator.serviceWorker.ready` 대기 → `ctx.setOffline(true)` → 리로드. 진행 중 런이 살아 있어야 한다.
- **저장 주입**: 특정 기물/상태를 만들려면 `npx vite-node`로 리포의 실제 엔진을 써서 `RunState`를 만들고 `localStorage`에 넣는다. 가짜 상태를 손으로 짜지 말 것.

## 알려진 것

- 전투 밖(맵·객잔) 화면은 보유 기물을 표시하지 않는다. 기물 효과를 눈으로 확인하려면 전투에 들어가 상단바를 봐야 한다.
- 장터 노드는 드물게 나온다 (가중치 8). E2E에서 상점을 밟으려 하지 말고 `RunState`를 주입할 것.
- favicon 404는 무해하다.

## 끝나면

리포에 남긴 임시 드라이버를 지우고 `git status`가 깨끗한지 확인할 것.
