# 강호비급 P1 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개방 문파 하나로 축약 3막을 완주할 수 있는 덱빌딩 로그라이크를 GitHub Pages에 PWA로 배포한다.

**Architecture:** `src/engine/`은 DOM을 모르는 순수 함수 집합으로, 전투와 런 진행을 `(상태, 액션) → 새 상태`로 다룬다. `src/ui/`는 상태를 읽어 그리고 액션만 보낸다. 모든 무작위는 직렬화 가능한 시드 RNG 하나를 경유하므로 런 전체가 재현 가능하다. 카드·기물·적은 코드가 아니라 `src/data/*.json`의 효과 원자 배열로 선언한다.

**Tech Stack:** TypeScript 5.9 · Vite 8 · vite-plugin-pwa 1.3 · Vitest 3 · Playwright 1.61 · GitHub Actions → GitHub Pages. 런타임 의존성 0.

## Global Constraints

- 설계서: `docs/superpowers/specs/2026-08-01-gangho-bigeup-design.md`. 충돌 시 설계서가 우선한다.
- 레포: `Flyest1/gangho-bigeup`. 배포 URL `https://flyest1.github.io/gangho-bigeup/`. Vite `base`는 `/gangho-bigeup/`.
- Node 20. 패키지 매니저 npm. 런타임 `dependencies`는 비워 둔다 (전부 `devDependencies`).
- `src/engine/` 아래 어떤 파일도 `document` · `window` · `localStorage` · `navigator`를 참조하지 않는다. `tools/check_engine_purity.mjs`가 CI에서 강제한다.
- 모든 무작위는 `engine/rng.ts`의 `Rng`만 사용한다. `Math.random()` 직접 호출 금지 (동일 검사 스크립트가 잡는다).
- TypeScript `strict: true`. `any` 금지.
- UI 문자열은 전부 한국어. 계열은 **색·한자·도형 세 가지로 동시 표기**한다 (색만으로 구분 금지).
- 원작 문장을 그대로 옮기지 않는다. 모든 카드 설명·대사는 새로 쓴다.
- README와 타이틀 화면에 **비공식·비영리 팬메이드** 문구를 넣는다.
- 커밋 메시지는 한국어. 각 Task 끝에서 반드시 커밋한다.
- 작업 디렉터리: `C:\Users\rawpl\Documents\workspace\game_06` (이미 git 초기화됨, 설계서 커밋 1개 존재).

### 설계서에서 확정한 해석

설계서 §2.5의 피해 계산 순서에 연계 보너스 위치가 없다. **연계 피해 보너스(외공 +6)는 기본값에 더한 뒤 나머지 파이프라인을 태운다.** 즉 `유효기본 = 기본값 + 연계보너스 → 기세 → 쇠약 → 취약 → 상성 → 잔상 → 호신강기 → 체력`.

### P1에 포함되지 않는 것

기연·비급 노드, 고묘파·소림, 승단, 메타 해금, 저주 카드, 보스 2단계 패턴, 게임패드. 전부 P2 이후다. P1의 노드 타입은 `격전 · 정예 · 객잔 · 장터 · 관문` 다섯 가지다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/engine/types.ts` | 공용 타입 전부. 로직 없음 |
| `src/engine/rng.ts` | 시드 RNG. 직렬화 가능한 `state` 하나로 재현 |
| `src/engine/stance.ts` | 상성 판정 · 연계 카운터 · 연계 보너스 |
| `src/engine/status.ts` | 상태이상 추가 · 조회 · 턴 감소 |
| `src/engine/damage.ts` | 피해 계산 파이프라인 (설계서 §2.5 순서) |
| `src/engine/effects.ts` | 효과 원자 해석기 |
| `src/engine/cards.ts` | 카드 정의 조회 · 인스턴스 생성 · 플레이 |
| `src/engine/enemies.ts` | 적 의도 결정 AI |
| `src/engine/relics.ts` | 기물 훅 트리거 · 패시브 보정 |
| `src/engine/combat.ts` | 전투 상태 기계 |
| `src/engine/map.ts` | 노드맵 생성 |
| `src/engine/run.ts` | 런 진행 (막 · 노드 · 보상 · 상점 · 휴식) |
| `src/engine/save.ts` | 직렬화 · 검증 · 손상 격리 |
| `src/engine/content.ts` | JSON 데이터 로드 + 런타임 타입 좁히기 |
| `src/data/*.json` | 카드 · 기물 · 적 · 문파 · 막 데이터 |
| `src/ui/dom.ts` | `el()` 등 최소 DOM 헬퍼 |
| `src/ui/app.ts` | 화면 라우터 · 상태 보관 · 액션 디스패치 |
| `src/ui/screens/*.ts` | 타이틀 · 맵 · 전투 · 보상 · 객잔 · 장터 · 결과 |
| `src/ui/components/*.ts` | 카드 · 적 · 의도 · 상태 배지 · 자세 띠 |
| `src/ui/input.ts` | 키보드 입력 |
| `src/art/svg.ts` | 카드 문양 · 배경 코드 생성 |
| `src/art/portraits.ts` | WebP 초상 로더 + SVG 폴백 |
| `src/audio/sfx.ts` | WebAudio 절차 합성 |
| `src/platform/storage.ts` | localStorage 브릿지 (engine 밖) |
| `tools/validate_data.mjs` | 데이터 무결성 검증 |
| `tools/check_engine_purity.mjs` | engine 순수성 강제 |
| `tools/balance_sim.mjs` | 자동 플레이 퍼즈 · 승률 리포트 |

---

## Task 1: 프로젝트 부트스트랩과 배포 파이프라인

배포를 맨 마지막이 아니라 맨 처음에 뚫는다. Pages 설정 문제를 P1 끝에서 발견하면 비싸다.

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/styles/base.css`, `.github/workflows/deploy.yml`, `README.md`
- Create: `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `public/apple-touch-icon.png`

**Interfaces:**
- Consumes: 없음
- Produces: `npm run dev` · `npm run build` · `npm run test` · `npm run typecheck` 스크립트. Vite `base = '/gangho-bigeup/'`.

- [ ] **Step 1: GitHub 레포 생성**

```bash
cd /c/Users/rawpl/Documents/workspace/game_06
gh repo create Flyest1/gangho-bigeup --public \
  --description "강호비급 — 김용 원작 강호 기반 덱빌딩 로그라이크 (비공식·비영리 팬메이드 PWA)" \
  --source . --remote origin
```

- [ ] **Step 2: package.json 작성**

```json
{
  "name": "gangho-bigeup",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "강호비급 — 덱빌딩 로그라이크 (비공식·비영리 팬메이드)",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "validate": "node tools/validate_data.mjs",
    "check:purity": "node tools/check_engine_purity.mjs",
    "balance": "node tools/balance_sim.mjs"
  },
  "devDependencies": {
    "@playwright/test": "^1.61.1",
    "typescript": "^5.9.0",
    "vite": "^8.1.5",
    "vite-plugin-pwa": "^1.3.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 3: tsconfig.json 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: vite.config.ts 작성**

```ts
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/gangho-bigeup/',
  build: { outDir: 'dist', assetsInlineLimit: 8192 },
  server: { host: true },
  define: {
    __APP_VERSION__: JSON.stringify((process.env.GITHUB_SHA || 'local').slice(0, 7)),
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: '강호비급 — 무명행',
        short_name: '강호비급',
        description: '초식을 모아 강호를 등반하는 비공식·비영리 팬메이드 덱빌딩 로그라이크',
        lang: 'ko',
        theme_color: '#141110',
        background_color: '#141110',
        display: 'standalone',
        orientation: 'any',
        scope: '/gangho-bigeup/',
        start_url: '/gangho-bigeup/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,webp,woff2}'],
        navigateFallback: '/gangho-bigeup/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
});
```

- [ ] **Step 5: vitest.config.ts 작성**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/engine/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: index.html · main.ts · base.css 작성**

`index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#141110" />
    <title>강호비급 — 무명행</title>
  </head>
  <body>
    <div id="app" aria-live="polite"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:

```ts
import './styles/base.css';

const root = document.getElementById('app');
if (root) {
  root.innerHTML = `<main class="boot"><h1>강호비급</h1><p>江湖祕笈</p>
    <p class="fan">김용 원작 세계관을 참조한 비공식·비영리 팬메이드 작품입니다.</p></main>`;
}
```

`src/styles/base.css`:

```css
:root {
  --ink: #141110;
  --paper: #ded3bd;
  --gold: #c9a227;
  --wai: #c0453a;
  --gyeong: #3f8f6a;
  --nae: #4a6ea8;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; }
body {
  background: var(--ink);
  color: var(--paper);
  font-family: 'Noto Serif KR', 'Batang', serif;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
}
#app { height: 100dvh; display: flex; flex-direction: column; }
.boot { margin: auto; text-align: center; }
.boot h1 { font-size: 2.5rem; letter-spacing: .3em; margin: 0 0 .2em; }
.fan { font-size: .75rem; opacity: .6; margin-top: 2em; }
```

- [ ] **Step 7: 아이콘 4종 생성**

수묵 느낌의 전각(篆刻) 도장 스타일로 `강`자 하나를 넣는다. 다음 스크립트를 임시 파일 `tools/make_icons.mjs`로 만들어 실행한 뒤 삭제한다 (`sharp` 없이 순수 SVG→PNG가 불가하므로 브라우저 없이 만들려면 최소한의 PNG 인코더가 필요하다 — 대신 여기서는 SVG를 그려 두고 Playwright의 크로미움으로 렌더한다).

```js
// tools/make_icons.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#141110"/>
  <rect x="${size * 0.14}" y="${size * 0.14}" width="${size * 0.72}" height="${size * 0.72}"
        rx="${size * 0.06}" fill="none" stroke="#c0453a" stroke-width="${size * 0.045}"/>
  <text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#ded3bd"
        font-family="serif" font-size="${size * 0.46}">江</text>
</svg>`;

mkdirSync('public', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['icon-maskable-512', 512], ['apple-touch-icon', 180]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(svg(size));
  writeFileSync(`public/${name}.png`, await page.screenshot({ omitBackground: false }));
}
await browser.close();
```

실행:

```bash
npm install
npx playwright install --with-deps chromium
node tools/make_icons.mjs
rm tools/make_icons.mjs
```

- [ ] **Step 8: 배포 워크플로 작성**

`.github/workflows/deploy.yml`:

```yaml
name: Validate · Build · Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Task 21에서 `validate` · `test` · `check:purity` · `test:e2e` 단계를 이 워크플로에 추가한다. 지금은 파이프라인이 도는 것만 확인한다.

- [ ] **Step 9: 빌드가 통과하는지 확인**

```bash
npm run typecheck && npm run build
```

Expected: `dist/` 생성, 에러 없음.

- [ ] **Step 10: README 작성**

```markdown
# 강호비급 (江湖祕笈)

무명의 협객이 초식을 모아 강호를 등반하는 덱빌딩 로그라이크.

**▶ 플레이: https://flyest1.github.io/gangho-bigeup/**

김용(金庸) 원작의 세계관과 인물명을 참조한 **비공식·비영리 팬메이드** 작품입니다.
원작 문장과 원작 저작물은 사용하지 않으며, 모든 대사와 텍스트는 새로 썼습니다.
수익화하지 않습니다.

## 특징

- **자세(勢)와 상성** — 외공▶경공▶내공▶외공. 낸 카드의 계열이 곧 내 자세가 되고,
  상대의 자세를 누르는 계열로 치면 위력이 오르며 호신강기를 무시한다(파훼).
  적의 공격에도 같은 규칙이 적용되므로 자세 관리가 공수 양면의 판단이 된다.
- **연계(連繫)** — 같은 계열을 3장 연속 내면 계열 보너스가 매 장 발동한다.
  상성을 쫓아 계열을 갈아타면 연계가 끊긴다.
- PWA — 설치 가능하며 오프라인에서 플레이된다.

## 개발

\`\`\`bash
npm install
npm run dev        # 개발 서버
npm run test       # 엔진 단위 테스트
npm run validate   # 데이터 무결성 검증
npm run balance    # 자동 플레이 시뮬레이션
npm run build      # 프로덕션 빌드
\`\`\`

## 구조

\`src/engine/\`은 DOM을 모르는 순수 로직이고 \`src/ui/\`는 렌더만 담당한다.
모든 무작위는 직렬화 가능한 시드 RNG 하나를 경유하므로 런 전체가 재현 가능하다.
카드·기물·적은 \`src/data/*.json\`의 효과 원자 배열로 선언한다.
```

- [ ] **Step 11: 커밋하고 푸시해 배포 확인**

```bash
git add -A
git commit -m "프로젝트 부트스트랩: Vite·TypeScript·PWA·Pages 배포 파이프라인"
git push -u origin main
gh api -X POST repos/Flyest1/gangho-bigeup/pages -f build_type=workflow || true
gh run watch
```

Expected: 워크플로 성공, `https://flyest1.github.io/gangho-bigeup/`에서 부트 화면이 보인다.

---

## Task 2: 시드 RNG

**Files:**
- Create: `src/engine/rng.ts`
- Test: `tests/engine/rng.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `class Rng { state: number; next(): number; int(n: number): number; range(min: number, max: number): number; pick<T>(a: readonly T[]): T; shuffle<T>(a: readonly T[]): T[]; weighted<T>(e: ReadonlyArray<readonly [T, number]>): T; fork(): Rng }`
  - `function seedFrom(text: string): number`
  - `function randomSeedText(): string`

`state`는 숫자 하나이므로 전투·런 상태에 그대로 직렬화된다. 상태를 복원하면 이후 난수열이 완전히 동일하다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/engine/rng.test.ts
import { describe, it, expect } from 'vitest';
import { Rng, seedFrom, randomSeedText } from '../../src/engine/rng';

describe('Rng', () => {
  it('같은 시드는 같은 수열을 낸다', () => {
    const a = new Rng(seedFrom('강호'));
    const b = new Rng(seedFrom('강호'));
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('다른 시드는 다른 수열을 낸다', () => {
    const a = new Rng(seedFrom('강호'));
    const b = new Rng(seedFrom('무림'));
    expect(a.next()).not.toBe(b.next());
  });

  it('state를 복원하면 이후 수열이 이어진다', () => {
    const a = new Rng(seedFrom('복원'));
    a.next(); a.next(); a.next();
    const saved = a.state;
    const expected = [a.next(), a.next()];
    const restored = new Rng(saved);
    expect([restored.next(), restored.next()]).toEqual(expected);
  });

  it('next는 [0,1) 범위다', () => {
    const r = new Rng(seedFrom('범위'));
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n)은 0 이상 n 미만 정수다', () => {
    const r = new Rng(seedFrom('정수'));
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it('range(min,max)는 양끝을 포함한다', () => {
    const r = new Rng(seedFrom('구간'));
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(r.range(3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('shuffle은 원본을 바꾸지 않고 순열을 낸다', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const r = new Rng(seedFrom('셔플'));
    const out = r.shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(src);
    expect(out).not.toEqual(src);
  });

  it('weighted는 가중치 0인 항목을 절대 뽑지 않는다', () => {
    const r = new Rng(seedFrom('가중'));
    for (let i = 0; i < 500; i++) {
      expect(r.weighted([['a', 1], ['b', 0]] as const)).toBe('a');
    }
  });

  it('weighted는 가중치에 비례해 뽑는다', () => {
    const r = new Rng(seedFrom('비례'));
    let a = 0;
    for (let i = 0; i < 4000; i++) if (r.weighted([['a', 3], ['b', 1]] as const) === 'a') a++;
    expect(a / 4000).toBeGreaterThan(0.70);
    expect(a / 4000).toBeLessThan(0.80);
  });

  it('fork는 부모와 독립된 스트림을 만든다', () => {
    const parent = new Rng(seedFrom('분기'));
    const child = parent.fork();
    const before = parent.state;
    child.next(); child.next();
    expect(parent.state).toBe(before);
    expect(child.state).not.toBe(before);
  });

  it('randomSeedText는 매번 다른 문자열을 낸다', () => {
    const set = new Set(Array.from({ length: 50 }, () => randomSeedText()));
    expect(set.size).toBe(50);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/engine/rng.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/rng"`

- [ ] **Step 3: 구현**

```ts
// src/engine/rng.ts

/** mulberry32. state 하나로 완전히 재현되는 32비트 PRNG. */
export class Rng {
  constructor(public state: number) {
    this.state = state >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }

  range(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }

  pick<T>(items: readonly T[]): T {
    const item = items[this.int(items.length)];
    if (item === undefined) throw new Error('Rng.pick: 빈 배열');
    return item;
  }

  /** Fisher-Yates. 원본을 변경하지 않고 새 배열을 반환한다. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const a = out[i]!;
      const b = out[j]!;
      out[i] = b;
      out[j] = a;
    }
    return out;
  }

  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
    if (total <= 0) throw new Error('Rng.weighted: 가중치 합이 0');
    let roll = this.next() * total;
    for (const [value, weight] of entries) {
      roll -= Math.max(0, weight);
      if (roll < 0) return value;
    }
    return entries[entries.length - 1]![0];
  }

  /** 부모 스트림을 소비하지 않고 독립된 자식 스트림을 만든다. */
  fork(): Rng {
    return new Rng((Math.imul(this.state ^ 0x9e3779b9, 0x85ebca6b) >>> 0) + 1);
  }
}

export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const SEED_SYLLABLES = ['강', '호', '무', '림', '검', '도', '풍', '운', '설', '월', '영', '협'];

export function randomSeedText(): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += SEED_SYLLABLES[Math.floor(Math.random() * SEED_SYLLABLES.length)];
  }
  return `${out}-${Date.now().toString(36).slice(-4)}`;
}
```

`randomSeedText`는 `Math.random`을 쓰는 유일한 예외다. 런 시작 시드를 뽑는 지점이며 이후 모든 난수는 이 시드에서 파생된다. `tools/check_engine_purity.mjs`는 이 함수만 화이트리스트에 넣는다 (Task 14).

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `npx vitest run tests/engine/rng.test.ts`
Expected: PASS — 11 tests

- [ ] **Step 5: 커밋**

```bash
git add src/engine/rng.ts tests/engine/rng.test.ts
git commit -m "엔진: 시드 RNG. state 하나로 런 전체를 재현한다"
```

---

## Task 3: 공용 타입과 자세·상성·연계

이 게임의 핵심 기믹이다. 여기가 틀리면 전부 틀린다.

**Files:**
- Create: `src/engine/types.ts`, `src/engine/stance.ts`
- Test: `tests/engine/stance.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type Line = 'wai' | 'gyeong' | 'nae' | 'sul'` — 외공·경공·내공·술수
  - `type Stance = 'wai' | 'gyeong' | 'nae'`
  - `type Matchup = 'break' | 'neutral' | 'resisted'`
  - `type StatusId = 'poison' | 'naesang' | 'vulnerable' | 'weak' | 'momentum' | 'afterimage'`
  - `type StatusMap = Partial<Record<StatusId, number>>`
  - `type Rarity = 'basic' | 'common' | 'rare' | 'ultra'`
  - `interface Combo { line: Stance | null; count: number }`
  - `function beats(a: Line, b: Line): boolean`
  - `function matchup(attacker: Line, defenderStance: Stance | null): Matchup`
  - `function stanceMultiplier(m: Matchup): number` — break 1.5 / neutral 1 / resisted 0.75
  - `function nextStance(current: Stance, played: Line): Stance`
  - `function updateCombo(combo: Combo, line: Line): Combo`
  - `function comboFires(combo: Combo): boolean`
  - `const COMBO_THRESHOLD = 3`
  - `const LINE_LABEL: Record<Line, { name: string; hanja: string; shape: string }>`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/engine/stance.test.ts
import { describe, it, expect } from 'vitest';
import {
  beats, matchup, stanceMultiplier, nextStance,
  updateCombo, comboFires, COMBO_THRESHOLD, LINE_LABEL,
} from '../../src/engine/stance';
import type { Combo, Line, Stance } from '../../src/engine/types';

describe('상성', () => {
  it('외공▶경공▶내공▶외공 순환', () => {
    expect(beats('wai', 'gyeong')).toBe(true);
    expect(beats('gyeong', 'nae')).toBe(true);
    expect(beats('nae', 'wai')).toBe(true);
  });

  it('역방향은 누르지 못한다', () => {
    expect(beats('gyeong', 'wai')).toBe(false);
    expect(beats('nae', 'gyeong')).toBe(false);
    expect(beats('wai', 'nae')).toBe(false);
  });

  it('같은 계열은 누르지 못한다', () => {
    for (const l of ['wai', 'gyeong', 'nae'] as const) expect(beats(l, l)).toBe(false);
  });

  it('술수는 누르지도 눌리지도 않는다', () => {
    for (const l of ['wai', 'gyeong', 'nae', 'sul'] as const) {
      expect(beats('sul', l)).toBe(false);
      expect(beats(l, 'sul')).toBe(false);
    }
  });

  it('3x3 판정표 전체', () => {
    const table: Array<[Line, Stance, 'break' | 'neutral' | 'resisted']> = [
      ['wai', 'wai', 'neutral'],   ['wai', 'gyeong', 'break'],    ['wai', 'nae', 'resisted'],
      ['gyeong', 'wai', 'resisted'], ['gyeong', 'gyeong', 'neutral'], ['gyeong', 'nae', 'break'],
      ['nae', 'wai', 'break'],     ['nae', 'gyeong', 'resisted'], ['nae', 'nae', 'neutral'],
    ];
    for (const [atk, def, want] of table) expect(matchup(atk, def)).toBe(want);
  });

  it('술수 공격이나 자세 없음은 항상 neutral', () => {
    expect(matchup('sul', 'wai')).toBe('neutral');
    expect(matchup('wai', null)).toBe('neutral');
  });

  it('배율은 파훼 1.5 · 보통 1 · 저항 0.75', () => {
    expect(stanceMultiplier('break')).toBe(1.5);
    expect(stanceMultiplier('neutral')).toBe(1);
    expect(stanceMultiplier('resisted')).toBe(0.75);
  });
});

describe('자세 전환', () => {
  it('계열 카드는 자세를 그 계열로 바꾼다', () => {
    expect(nextStance('wai', 'nae')).toBe('nae');
    expect(nextStance('nae', 'gyeong')).toBe('gyeong');
  });

  it('술수 카드는 자세를 바꾸지 않는다', () => {
    expect(nextStance('wai', 'sul')).toBe('wai');
    expect(nextStance('gyeong', 'sul')).toBe('gyeong');
  });
});

describe('연계', () => {
  const empty: Combo = { line: null, count: 0 };

  it('첫 계열 카드는 카운터 1', () => {
    expect(updateCombo(empty, 'wai')).toEqual({ line: 'wai', count: 1 });
  });

  it('같은 계열을 이어내면 누적된다', () => {
    let c = updateCombo(empty, 'wai');
    c = updateCombo(c, 'wai');
    c = updateCombo(c, 'wai');
    expect(c).toEqual({ line: 'wai', count: 3 });
  });

  it('다른 계열로 갈아타면 1로 리셋된다', () => {
    let c = updateCombo(empty, 'wai');
    c = updateCombo(c, 'wai');
    c = updateCombo(c, 'nae');
    expect(c).toEqual({ line: 'nae', count: 1 });
  });

  it('술수 카드는 카운터를 건드리지 않는다', () => {
    let c = updateCombo(empty, 'gyeong');
    c = updateCombo(c, 'gyeong');
    const before = { ...c };
    expect(updateCombo(c, 'sul')).toEqual(before);
  });

  it('임계값은 3이며 3번째 카드부터 발동한다', () => {
    expect(COMBO_THRESHOLD).toBe(3);
    expect(comboFires({ line: 'wai', count: 2 })).toBe(false);
    expect(comboFires({ line: 'wai', count: 3 })).toBe(true);
    expect(comboFires({ line: 'wai', count: 7 })).toBe(true);
  });

  it('갈아탄 직후에는 발동하지 않는다', () => {
    let c: Combo = { line: 'wai', count: 9 };
    c = updateCombo(c, 'nae');
    expect(comboFires(c)).toBe(false);
  });

  it('자세 없음은 발동하지 않는다', () => {
    expect(comboFires({ line: null, count: 5 })).toBe(false);
  });
});

describe('표기', () => {
  it('네 계열 모두 이름·한자·도형을 가진다', () => {
    for (const l of ['wai', 'gyeong', 'nae', 'sul'] as const) {
      expect(LINE_LABEL[l].name.length).toBeGreaterThan(0);
      expect(LINE_LABEL[l].hanja.length).toBe(1);
      expect(LINE_LABEL[l].shape.length).toBeGreaterThan(0);
    }
  });

  it('도형이 서로 달라 색 없이도 구분된다', () => {
    const shapes = (['wai', 'gyeong', 'nae', 'sul'] as const).map((l) => LINE_LABEL[l].shape);
    expect(new Set(shapes).size).toBe(4);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/engine/stance.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/stance"`

- [ ] **Step 3: types.ts 작성**

```ts
// src/engine/types.ts

/** 무공 계열. 술수(sul)는 계열이 없어 상성과 연계 판정에서 제외된다. */
export type Line = 'wai' | 'gyeong' | 'nae' | 'sul';

/** 자세로 취할 수 있는 계열. 술수는 자세가 되지 않는다. */
export type Stance = 'wai' | 'gyeong' | 'nae';

export type Matchup = 'break' | 'neutral' | 'resisted';

export type Rarity = 'basic' | 'common' | 'rare' | 'ultra';

export type StatusId =
  | 'poison'      // 중독
  | 'naesang'     // 내상
  | 'vulnerable'  // 취약
  | 'weak'        // 쇠약
  | 'momentum'    // 기세
  | 'afterimage'; // 잔상

export type StatusMap = Partial<Record<StatusId, number>>;

export interface Combo {
  line: Stance | null;
  count: number;
}
```

- [ ] **Step 4: stance.ts 작성**

```ts
// src/engine/stance.ts
import type { Combo, Line, Matchup, Stance } from './types';

export const COMBO_THRESHOLD = 3;

/** 외공▶경공▶내공▶외공. 술수는 순환에 참여하지 않는다. */
const CYCLE: Record<Stance, Stance> = { wai: 'gyeong', gyeong: 'nae', nae: 'wai' };

function isStance(line: Line): line is Stance {
  return line !== 'sul';
}

export function beats(a: Line, b: Line): boolean {
  if (!isStance(a) || !isStance(b)) return false;
  return CYCLE[a] === b;
}

export function matchup(attacker: Line, defenderStance: Stance | null): Matchup {
  if (defenderStance === null || !isStance(attacker)) return 'neutral';
  if (beats(attacker, defenderStance)) return 'break';
  if (beats(defenderStance, attacker)) return 'resisted';
  return 'neutral';
}

export function stanceMultiplier(m: Matchup): number {
  if (m === 'break') return 1.5;
  if (m === 'resisted') return 0.75;
  return 1;
}

export function nextStance(current: Stance, played: Line): Stance {
  return isStance(played) ? played : current;
}

export function updateCombo(combo: Combo, line: Line): Combo {
  if (!isStance(line)) return combo;
  if (combo.line === line) return { line, count: combo.count + 1 };
  return { line, count: 1 };
}

export function comboFires(combo: Combo): boolean {
  return combo.line !== null && combo.count >= COMBO_THRESHOLD;
}

/** 색만으로 구분하지 않도록 이름·한자·도형을 함께 제공한다. */
export const LINE_LABEL: Record<Line, { name: string; hanja: string; shape: string }> = {
  wai: { name: '외공', hanja: '外', shape: '◆' },
  gyeong: { name: '경공', hanja: '輕', shape: '▲' },
  nae: { name: '내공', hanja: '內', shape: '●' },
  sul: { name: '술수', hanja: '術', shape: '■' },
};
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

Run: `npx vitest run tests/engine/stance.test.ts`
Expected: PASS — 17 tests

- [ ] **Step 6: 커밋**

```bash
git add src/engine/types.ts src/engine/stance.ts tests/engine/stance.test.ts
git commit -m "엔진: 자세·상성·연계. 외공▶경공▶내공 순환과 파훼 판정"
```

---

## Task 4: 상태이상

**Files:**
- Create: `src/engine/status.ts`
- Test: `tests/engine/status.test.ts`

**Interfaces:**
- Consumes: `StatusId`, `StatusMap` (Task 3)
- Produces:
  - `function getStatus(map: StatusMap, id: StatusId): number`
  - `function addStatus(map: StatusMap, id: StatusId, amount: number): StatusMap`
  - `function consumeStatus(map: StatusMap, id: StatusId, amount: number): StatusMap`
  - `function tickStatus(map: StatusMap): StatusMap`
  - `const STATUS_META: Record<StatusId, StatusMeta>` where `interface StatusMeta { name: string; hanja: string; decay: 'perTurn' | 'onUse' | 'never'; harmful: boolean; text: string }`

감소 규칙: `perTurn`은 턴마다 1씩 줄고 (중독·취약·쇠약), `onUse`는 발동할 때 소모되며 (내상·잔상), `never`는 전투 내내 유지된다 (기세). 중독의 턴 시작 피해와 내상의 내공 감소는 `combat.ts`가 호출하고, 이 모듈은 수치 관리만 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/engine/status.test.ts
import { describe, it, expect } from 'vitest';
import { getStatus, addStatus, consumeStatus, tickStatus, STATUS_META } from '../../src/engine/status';
import type { StatusId, StatusMap } from '../../src/engine/types';

const ALL: StatusId[] = ['poison', 'naesang', 'vulnerable', 'weak', 'momentum', 'afterimage'];

describe('상태이상 수치', () => {
  it('없는 상태는 0', () => {
    expect(getStatus({}, 'poison')).toBe(0);
  });

  it('추가는 누적된다', () => {
    let m: StatusMap = {};
    m = addStatus(m, 'poison', 3);
    m = addStatus(m, 'poison', 2);
    expect(getStatus(m, 'poison')).toBe(5);
  });

  it('추가는 원본을 변경하지 않는다', () => {
    const m: StatusMap = { poison: 1 };
    addStatus(m, 'poison', 5);
    expect(m.poison).toBe(1);
  });

  it('0 이하를 더하면 아무 일도 없다', () => {
    expect(addStatus({ poison: 2 }, 'poison', 0)).toEqual({ poison: 2 });
  });

  it('소모는 차감하고 0이 되면 키를 지운다', () => {
    expect(consumeStatus({ afterimage: 2 }, 'afterimage', 1)).toEqual({ afterimage: 1 });
    expect(consumeStatus({ afterimage: 1 }, 'afterimage', 1)).toEqual({});
  });

  it('소모는 음수로 내려가지 않는다', () => {
    expect(consumeStatus({ poison: 2 }, 'poison', 99)).toEqual({});
  });
});

describe('턴 감소', () => {
  it('중독·취약·쇠약은 턴마다 1 줄어든다', () => {
    const out = tickStatus({ poison: 3, vulnerable: 2, weak: 1 });
    expect(out).toEqual({ poison: 2, vulnerable: 1 });
  });

  it('기세는 줄지 않는다', () => {
    expect(tickStatus({ momentum: 4 })).toEqual({ momentum: 4 });
  });

  it('내상·잔상은 턴 감소로 줄지 않는다', () => {
    expect(tickStatus({ naesang: 2, afterimage: 1 })).toEqual({ naesang: 2, afterimage: 1 });
  });

  it('빈 상태는 그대로 빈 상태', () => {
    expect(tickStatus({})).toEqual({});
  });
});

describe('메타', () => {
  it('여섯 상태 모두 이름·한자·설명을 가진다', () => {
    for (const id of ALL) {
      expect(STATUS_META[id].name.length).toBeGreaterThan(0);
      expect(STATUS_META[id].hanja.length).toBe(1);
      expect(STATUS_META[id].text.length).toBeGreaterThan(0);
    }
  });

  it('기세만 유익하고 나머지는 해롭다', () => {
    expect(STATUS_META.momentum.harmful).toBe(false);
    expect(STATUS_META.afterimage.harmful).toBe(false);
    expect(STATUS_META.poison.harmful).toBe(true);
    expect(STATUS_META.vulnerable.harmful).toBe(true);
  });

  it('감소 방식이 설계서와 일치한다', () => {
    expect(STATUS_META.poison.decay).toBe('perTurn');
    expect(STATUS_META.vulnerable.decay).toBe('perTurn');
    expect(STATUS_META.weak.decay).toBe('perTurn');
    expect(STATUS_META.naesang.decay).toBe('onUse');
    expect(STATUS_META.afterimage.decay).toBe('onUse');
    expect(STATUS_META.momentum.decay).toBe('never');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/engine/status.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/status"`

- [ ] **Step 3: 구현**

```ts
// src/engine/status.ts
import type { StatusId, StatusMap } from './types';

export interface StatusMeta {
  name: string;
  hanja: string;
  decay: 'perTurn' | 'onUse' | 'never';
  harmful: boolean;
  text: string;
}

export const STATUS_META: Record<StatusId, StatusMeta> = {
  poison: {
    name: '중독', hanja: '毒', decay: 'perTurn', harmful: true,
    text: '턴 시작 시 스택만큼 체력이 깎인다. 호신강기로 막지 못한다. 매 턴 1 줄어든다.',
  },
  naesang: {
    name: '내상', hanja: '傷', decay: 'onUse', harmful: true,
    text: '다음 턴 최대 내공이 스택만큼 줄어든다. 발동하면 전량 사라진다.',
  },
  vulnerable: {
    name: '취약', hanja: '破', decay: 'perTurn', harmful: true,
    text: '받는 피해가 50% 늘어난다. 매 턴 1 줄어든다.',
  },
  weak: {
    name: '쇠약', hanja: '衰', decay: 'perTurn', harmful: true,
    text: '주는 피해가 25% 줄어든다. 매 턴 1 줄어든다.',
  },
  momentum: {
    name: '기세', hanja: '氣', decay: 'never', harmful: false,
    text: '공격 피해가 스택만큼 늘어난다. 전투가 끝날 때까지 유지된다.',
  },
  afterimage: {
    name: '잔상', hanja: '殘', decay: 'onUse', harmful: false,
    text: '받는 공격 1회를 완전히 흘린다. 발동하면 1 줄어든다.',
  },
};

export function getStatus(map: StatusMap, id: StatusId): number {
  return map[id] ?? 0;
}

export function addStatus(map: StatusMap, id: StatusId, amount: number): StatusMap {
  if (amount <= 0) return { ...map };
  return { ...map, [id]: getStatus(map, id) + amount };
}

export function consumeStatus(map: StatusMap, id: StatusId, amount: number): StatusMap {
  const left = getStatus(map, id) - amount;
  const out = { ...map };
  if (left > 0) out[id] = left;
  else delete out[id];
  return out;
}

/** 턴 경계에서 perTurn 상태를 1씩 줄인다. */
export function tickStatus(map: StatusMap): StatusMap {
  let out: StatusMap = { ...map };
  for (const key of Object.keys(map) as StatusId[]) {
    if (STATUS_META[key].decay === 'perTurn') out = consumeStatus(out, key, 1);
  }
  return out;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `npx vitest run tests/engine/status.test.ts`
Expected: PASS — 13 tests

- [ ] **Step 5: 커밋**

```bash
git add src/engine/status.ts tests/engine/status.test.ts
git commit -m "엔진: 상태이상 6종과 감소 규칙"
```

---

## Task 5: 피해 계산 파이프라인

설계서 §2.5의 순서를 그대로 코드로 옮긴다. 순서가 바뀌면 수치가 달라지므로 테스트로 순서 자체를 고정한다.

**Files:**
- Create: `src/engine/damage.ts`
- Test: `tests/engine/damage.test.ts`

**Interfaces:**
- Consumes: `matchup`, `stanceMultiplier` (Task 3), `getStatus`, `consumeStatus` (Task 4)
- Produces:
  - `interface DamageContext { base: number; comboBonus?: number; attackerLine: Line; attackerStatus: StatusMap; defenderStance: Stance | null; defenderStatus: StatusMap; defenderBlock: number; ignoreBlock?: boolean }`
  - `interface DamageResult { amount: number; hpLoss: number; blockLoss: number; matchup: Matchup; broke: boolean; dodged: boolean; defenderStatus: StatusMap }`
  - `function computeDamage(ctx: DamageContext): DamageResult`

순서: `기본값 + 연계보너스 → 기세 가산 → 쇠약 ×0.75 → 취약 ×1.5 → 상성 배율 → 잔상 → 호신강기 → 체력`. 곱셈 단계마다 내림한다. `broke`(파훼)면 호신강기를 건너뛰고 체력에 직접 들어간다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/engine/damage.test.ts
import { describe, it, expect } from 'vitest';
import { computeDamage } from '../../src/engine/damage';
import type { DamageContext } from '../../src/engine/damage';

function ctx(over: Partial<DamageContext> = {}): DamageContext {
  return {
    base: 10,
    attackerLine: 'wai',
    attackerStatus: {},
    defenderStance: 'wai',
    defenderStatus: {},
    defenderBlock: 0,
    ...over,
  };
}

describe('기본 피해', () => {
  it('보정이 없으면 기본값 그대로 체력에 들어간다', () => {
    const r = computeDamage(ctx());
    expect(r.amount).toBe(10);
    expect(r.hpLoss).toBe(10);
    expect(r.blockLoss).toBe(0);
    expect(r.matchup).toBe('neutral');
  });

  it('연계 보너스는 기본값에 더해진다', () => {
    expect(computeDamage(ctx({ comboBonus: 6 })).amount).toBe(16);
  });

  it('기세는 가산이다', () => {
    expect(computeDamage(ctx({ attackerStatus: { momentum: 4 } })).amount).toBe(14);
  });
});

describe('배율 순서', () => {
  it('쇠약은 25% 깎고 내림한다', () => {
    expect(computeDamage(ctx({ base: 10, attackerStatus: { weak: 1 } })).amount).toBe(7);
  });

  it('취약은 50% 올리고 내림한다', () => {
    expect(computeDamage(ctx({ base: 10, defenderStatus: { vulnerable: 1 } })).amount).toBe(15);
  });

  it('파훼는 50% 올리고 내림한다', () => {
    expect(computeDamage(ctx({ base: 10, defenderStance: 'gyeong' })).amount).toBe(15);
  });

  it('저항은 25% 깎고 내림한다', () => {
    expect(computeDamage(ctx({ base: 10, defenderStance: 'nae' })).amount).toBe(7);
  });

  it('쇠약과 취약이 겹치면 쇠약을 먼저 적용한다', () => {
    // 10 -> 쇠약 7 -> 취약 10
    const r = computeDamage(ctx({
      base: 10,
      attackerStatus: { weak: 1 },
      defenderStatus: { vulnerable: 1 },
    }));
    expect(r.amount).toBe(10);
  });

  it('네 보정이 모두 걸리면 설계서 순서대로 계산된다', () => {
    // 10 + 연계6 = 16 -> 기세+2 = 18 -> 쇠약 13 -> 취약 19 -> 파훼 28
    const r = computeDamage(ctx({
      base: 10,
      comboBonus: 6,
      attackerStatus: { weak: 1, momentum: 2 },
      defenderStance: 'gyeong',
      defenderStatus: { vulnerable: 1 },
    }));
    expect(r.amount).toBe(28);
    expect(r.broke).toBe(true);
  });
});

describe('호신강기', () => {
  it('호신강기가 먼저 깎이고 나머지가 체력으로 간다', () => {
    const r = computeDamage(ctx({ base: 10, defenderBlock: 4 }));
    expect(r.blockLoss).toBe(4);
    expect(r.hpLoss).toBe(6);
  });

  it('호신강기가 충분하면 체력은 깎이지 않는다', () => {
    const r = computeDamage(ctx({ base: 10, defenderBlock: 30 }));
    expect(r.blockLoss).toBe(10);
    expect(r.hpLoss).toBe(0);
  });

  it('파훼는 호신강기를 무시하고 체력에 직접 들어간다', () => {
    const r = computeDamage(ctx({ base: 10, defenderStance: 'gyeong', defenderBlock: 99 }));
    expect(r.broke).toBe(true);
    expect(r.blockLoss).toBe(0);
    expect(r.hpLoss).toBe(15);
  });

  it('ignoreBlock은 파훼가 아니어도 호신강기를 무시한다', () => {
    const r = computeDamage(ctx({ base: 5, defenderBlock: 99, ignoreBlock: true }));
    expect(r.hpLoss).toBe(5);
    expect(r.blockLoss).toBe(0);
  });
});

describe('잔상', () => {
  it('잔상이 있으면 완전히 흘리고 1 소모한다', () => {
    const r = computeDamage(ctx({ base: 40, defenderStatus: { afterimage: 2 } }));
    expect(r.dodged).toBe(true);
    expect(r.hpLoss).toBe(0);
    expect(r.blockLoss).toBe(0);
    expect(r.defenderStatus).toEqual({ afterimage: 1 });
  });

  it('잔상은 파훼도 흘린다', () => {
    const r = computeDamage(ctx({
      base: 40, defenderStance: 'gyeong', defenderStatus: { afterimage: 1 },
    }));
    expect(r.dodged).toBe(true);
    expect(r.hpLoss).toBe(0);
    expect(r.defenderStatus).toEqual({});
  });

  it('잔상이 없으면 방어자 상태는 그대로다', () => {
    const r = computeDamage(ctx({ defenderStatus: { poison: 3 } }));
    expect(r.dodged).toBe(false);
    expect(r.defenderStatus).toEqual({ poison: 3 });
  });
});

describe('경계값', () => {
  it('피해는 음수가 되지 않는다', () => {
    const r = computeDamage(ctx({ base: 0, attackerStatus: { weak: 1 } }));
    expect(r.amount).toBe(0);
    expect(r.hpLoss).toBe(0);
  });

  it('술수 공격은 상성 보정을 받지 않는다', () => {
    const r = computeDamage(ctx({ base: 10, attackerLine: 'sul', defenderStance: 'gyeong' }));
    expect(r.matchup).toBe('neutral');
    expect(r.amount).toBe(10);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/engine/damage.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/damage"`

- [ ] **Step 3: 구현**

```ts
// src/engine/damage.ts
import { matchup as computeMatchup, stanceMultiplier } from './stance';
import { consumeStatus, getStatus } from './status';
import type { Line, Matchup, Stance, StatusMap } from './types';

export interface DamageContext {
  base: number;
  /** 외공 연계 보너스처럼 기본값에 더해지는 값. */
  comboBonus?: number;
  attackerLine: Line;
  attackerStatus: StatusMap;
  defenderStance: Stance | null;
  defenderStatus: StatusMap;
  defenderBlock: number;
  /** 중독처럼 호신강기를 통과하는 피해. */
  ignoreBlock?: boolean;
}

export interface DamageResult {
  /** 모든 보정을 마친 피해량. 표시용. */
  amount: number;
  hpLoss: number;
  blockLoss: number;
  matchup: Matchup;
  broke: boolean;
  dodged: boolean;
  /** 잔상 소모가 반영된 방어자 상태. */
  defenderStatus: StatusMap;
}

/** 설계서 §2.5 순서: 기본+연계 → 기세 → 쇠약 → 취약 → 상성 → 잔상 → 호신강기 → 체력. */
export function computeDamage(ctx: DamageContext): DamageResult {
  const match = computeMatchup(ctx.attackerLine, ctx.defenderStance);
  const broke = match === 'break';

  let amount = ctx.base + (ctx.comboBonus ?? 0);
  amount += getStatus(ctx.attackerStatus, 'momentum');
  if (getStatus(ctx.attackerStatus, 'weak') > 0) amount = Math.floor(amount * 0.75);
  if (getStatus(ctx.defenderStatus, 'vulnerable') > 0) amount = Math.floor(amount * 1.5);
  amount = Math.floor(amount * stanceMultiplier(match));
  amount = Math.max(0, amount);

  if (getStatus(ctx.defenderStatus, 'afterimage') > 0) {
    return {
      amount,
      hpLoss: 0,
      blockLoss: 0,
      matchup: match,
      broke,
      dodged: true,
      defenderStatus: consumeStatus(ctx.defenderStatus, 'afterimage', 1),
    };
  }

  const bypassBlock = broke || ctx.ignoreBlock === true;
  const blockLoss = bypassBlock ? 0 : Math.min(ctx.defenderBlock, amount);

  return {
    amount,
    hpLoss: amount - blockLoss,
    blockLoss,
    matchup: match,
    broke,
    dodged: false,
    defenderStatus: { ...ctx.defenderStatus },
  };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `npx vitest run tests/engine/damage.test.ts`
Expected: PASS — 17 tests

- [ ] **Step 5: 커밋**

```bash
git add src/engine/damage.ts tests/engine/damage.test.ts
git commit -m "엔진: 피해 계산 파이프라인. 설계서 순서를 테스트로 고정"
```

---

## Task 6: 전투 타입과 효과 원자 해석기

카드·기물·적 행동이 전부 이 효과 원자 집합으로 표현된다. 집합은 여기서 닫히며, 콘텐츠 추가는 JSON만 고친다.

**Files:**
- Modify: `src/engine/types.ts` (전투 타입 추가)
- Create: `src/engine/effects.ts`
- Test: `tests/engine/effects.test.ts`

**Interfaces:**
- Consumes: `computeDamage` (Task 5), `addStatus`/`consumeStatus` (Task 4), `Rng` (Task 2), `nextStance`/`beats` (Task 3)
- Produces (types.ts 추가분):
  - `interface CardInstance { uid: string; defId: string; upgraded: boolean }`
  - `interface CardDef { id, name, hanja, school, line, cost, rarity, target, text, effects, exhaust?, upgrade? }`
  - `interface PlayerState { hp, maxHp, qi, maxQi, block, stance, status, relics }`
  - `interface EnemyState { uid, defId, name, hp, maxHp, block, stance, status, intent, history }`
  - `interface Intent { actionId, kind, line, value, hits, label }`
  - `interface CombatState { rngState, turn, phase, player, enemies, draw, hand, discard, exhaust, combo, handSize, keepBlock, log }`
  - `type EffectAtom` (11종)
- Produces (effects.ts):
  - `function applyEffects(state: CombatState, atoms: EffectAtom[], ctx: EffectSource): CombatState`
  - `interface EffectSource { line: Line; targetUid: string | null; comboBonus: number; fromEnemyUid?: string }`
  - `function drawCards(state: CombatState, count: number): CombatState`
  - `function comboBonusFor(line: Stance): { damageBonus: number; extra: EffectAtom[] }`
  - `function damageEnemy(state, uid, base, line, comboBonus): CombatState`
  - `function damagePlayer(state, base, line, opts?): CombatState`

- [ ] **Step 1: types.ts에 전투 타입 추가**

```ts
// src/engine/types.ts 에 이어서 추가

export type CardSchool = 'common' | 'gaebang';
export type EffectTarget = 'enemy' | 'allEnemies' | 'self';
export type IntentKind = 'attack' | 'defend' | 'debuff' | 'buff' | 'special';
export type CombatPhase = 'player' | 'enemy' | 'won' | 'lost';

export type EffectAtom =
  | { op: 'damage'; value: number; hits?: number; target?: EffectTarget }
  | { op: 'block'; value: number }
  | { op: 'draw'; value: number }
  | { op: 'gainQi'; value: number }
  | { op: 'heal'; value: number }
  | { op: 'applyStatus'; status: StatusId; value: number; target?: EffectTarget }
  | { op: 'ifCombo'; min: number; then: EffectAtom[] }
  | { op: 'ifBreak'; then: EffectAtom[] }
  | { op: 'keepBlock' }
  | { op: 'loseBlock' }
  | { op: 'counterStance' };

export interface CardDef {
  id: string;
  name: string;
  hanja: string;
  school: CardSchool;
  line: Line;
  cost: number;
  rarity: Rarity;
  target: EffectTarget;
  text: string;
  effects: EffectAtom[];
  exhaust?: boolean;
  upgrade?: { text?: string; cost?: number; effects?: EffectAtom[] };
}

export interface CardInstance {
  uid: string;
  defId: string;
  upgraded: boolean;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  block: number;
  stance: Stance;
  status: StatusMap;
  relics: string[];
}

export interface Intent {
  actionId: string;
  kind: IntentKind;
  line: Line;
  value: number;
  hits: number;
  label: string;
}

export interface EnemyState {
  uid: string;
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  stance: Stance;
  status: StatusMap;
  intent: Intent | null;
  history: string[];
}

export interface CombatState {
  rngState: number;
  turn: number;
  phase: CombatPhase;
  player: PlayerState;
  enemies: EnemyState[];
  draw: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  exhaust: CardInstance[];
  combo: Combo;
  handSize: number;
  /** 순도 계열 효과. 다음 플레이어 턴 시작에 호신강기를 지우지 않는다. */
  keepBlock: boolean;
  log: string[];
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

```ts
// tests/engine/effects.test.ts
import { describe, it, expect } from 'vitest';
import { applyEffects, drawCards, comboBonusFor } from '../../src/engine/effects';
import type { CardInstance, CombatState, EffectAtom } from '../../src/engine/types';

function card(uid: string, defId = 'byeokta'): CardInstance {
  return { uid, defId, upgraded: false };
}

function baseState(over: Partial<CombatState> = {}): CombatState {
  return {
    rngState: 12345,
    turn: 1,
    phase: 'player',
    player: { hp: 80, maxHp: 80, qi: 3, maxQi: 3, block: 0, stance: 'wai', status: {}, relics: [] },
    enemies: [
      { uid: 'e1', defId: 'dog', name: '들개', hp: 20, maxHp: 20, block: 0,
        stance: 'gyeong', status: {}, intent: null, history: [] },
    ],
    draw: [card('c1'), card('c2'), card('c3')],
    hand: [],
    discard: [],
    exhaust: [],
    combo: { line: null, count: 0 },
    handSize: 5,
    keepBlock: false,
    log: [],
    ...over,
  };
}

const src = { line: 'wai' as const, targetUid: 'e1', comboBonus: 0 };

describe('damage', () => {
  it('대상 적의 체력을 깎는다', () => {
    const out = applyEffects(baseState(), [{ op: 'damage', value: 6 }], src);
    expect(out.enemies[0]!.hp).toBe(11); // 6 * 1.5 파훼 = 9
  });

  it('hits는 여러 번 때린다', () => {
    const out = applyEffects(baseState(), [{ op: 'damage', value: 4, hits: 3 }], src);
    expect(out.enemies[0]!.hp).toBe(2); // (4*1.5)=6, 3회 = 18
  });

  it('allEnemies는 전체를 때린다', () => {
    const s = baseState({
      enemies: [
        { uid: 'e1', defId: 'dog', name: '들개', hp: 20, maxHp: 20, block: 0, stance: 'wai', status: {}, intent: null, history: [] },
        { uid: 'e2', defId: 'dog', name: '들개', hp: 20, maxHp: 20, block: 0, stance: 'wai', status: {}, intent: null, history: [] },
      ],
    });
    const out = applyEffects(s, [{ op: 'damage', value: 5, target: 'allEnemies' }], src);
    expect(out.enemies.map((e) => e.hp)).toEqual([15, 15]);
  });

  it('연계 보너스가 피해에 반영된다', () => {
    const out = applyEffects(baseState(), [{ op: 'damage', value: 6 }], { ...src, comboBonus: 6 });
    expect(out.enemies[0]!.hp).toBe(2); // (6+6)*1.5 = 18
  });

  it('체력이 0 아래로 내려가지 않는다', () => {
    const out = applyEffects(baseState(), [{ op: 'damage', value: 99 }], src);
    expect(out.enemies[0]!.hp).toBe(0);
  });
});

describe('block · heal · qi', () => {
  it('block은 호신강기를 더한다', () => {
    expect(applyEffects(baseState(), [{ op: 'block', value: 5 }], src).player.block).toBe(5);
  });

  it('heal은 최대 체력을 넘지 않는다', () => {
    const s = baseState({ player: { ...baseState().player, hp: 75 } });
    expect(applyEffects(s, [{ op: 'heal', value: 10 }], src).player.hp).toBe(80);
  });

  it('gainQi는 내공을 더한다', () => {
    const s = baseState({ player: { ...baseState().player, qi: 1 } });
    expect(applyEffects(s, [{ op: 'gainQi', value: 2 }], src).player.qi).toBe(3);
  });

  it('loseBlock은 호신강기를 0으로 만든다', () => {
    const s = baseState({ player: { ...baseState().player, block: 12 } });
    expect(applyEffects(s, [{ op: 'loseBlock' }], src).player.block).toBe(0);
  });

  it('keepBlock은 플래그를 세운다', () => {
    expect(applyEffects(baseState(), [{ op: 'keepBlock' }], src).keepBlock).toBe(true);
  });
});

describe('applyStatus', () => {
  it('기본 대상은 적이다', () => {
    const out = applyEffects(baseState(), [{ op: 'applyStatus', status: 'poison', value: 3 }], src);
    expect(out.enemies[0]!.status.poison).toBe(3);
  });

  it('self 대상은 플레이어에게 건다', () => {
    const out = applyEffects(baseState(), [{ op: 'applyStatus', status: 'momentum', value: 2, target: 'self' }], src);
    expect(out.player.status.momentum).toBe(2);
  });
});

describe('draw', () => {
  it('뽑을 패에서 손으로 옮긴다', () => {
    const out = drawCards(baseState(), 2);
    expect(out.hand).toHaveLength(2);
    expect(out.draw).toHaveLength(1);
  });

  it('뽑을 패가 부족하면 버린 패를 섞어 채운다', () => {
    const s = baseState({ draw: [card('c1')], discard: [card('d1'), card('d2')] });
    const out = drawCards(s, 3);
    expect(out.hand).toHaveLength(3);
    expect(out.draw).toHaveLength(0);
    expect(out.discard).toHaveLength(0);
  });

  it('양쪽 다 비면 거기서 멈춘다', () => {
    const s = baseState({ draw: [card('c1')], discard: [] });
    const out = drawCards(s, 5);
    expect(out.hand).toHaveLength(1);
  });

  it('섞을 때 RNG state가 전진한다', () => {
    const s = baseState({ draw: [], discard: [card('d1'), card('d2')] });
    expect(drawCards(s, 1).rngState).not.toBe(s.rngState);
  });
});

describe('조건 효과', () => {
  it('ifCombo는 카운터가 임계 이상일 때만 실행된다', () => {
    const atoms: EffectAtom[] = [{ op: 'ifCombo', min: 3, then: [{ op: 'block', value: 9 }] }];
    const low = baseState({ combo: { line: 'wai', count: 2 } });
    const high = baseState({ combo: { line: 'wai', count: 3 } });
    expect(applyEffects(low, atoms, src).player.block).toBe(0);
    expect(applyEffects(high, atoms, src).player.block).toBe(9);
  });

  it('ifBreak는 대상 자세를 누를 때만 실행된다', () => {
    const atoms: EffectAtom[] = [{ op: 'ifBreak', then: [{ op: 'block', value: 7 }] }];
    const breaking = baseState(); // wai vs gyeong = 파훼
    const notBreaking = baseState({
      enemies: [{ ...baseState().enemies[0]!, stance: 'nae' }],
    });
    expect(applyEffects(breaking, atoms, src).player.block).toBe(7);
    expect(applyEffects(notBreaking, atoms, src).player.block).toBe(0);
  });
});

describe('counterStance', () => {
  it('적 자세를 누르는 계열로 내 자세를 바꾼다', () => {
    const s = baseState({ enemies: [{ ...baseState().enemies[0]!, stance: 'nae' }] });
    // 내공을 누르는 것은 경공
    expect(applyEffects(s, [{ op: 'counterStance' }], src).player.stance).toBe('gyeong');
  });
});

describe('연계 보너스 정의', () => {
  it('외공은 피해 +6', () => {
    expect(comboBonusFor('wai')).toEqual({ damageBonus: 6, extra: [] });
  });
  it('경공은 카드 1장', () => {
    expect(comboBonusFor('gyeong')).toEqual({ damageBonus: 0, extra: [{ op: 'draw', value: 1 }] });
  });
  it('내공은 호신강기 +5', () => {
    expect(comboBonusFor('nae')).toEqual({ damageBonus: 0, extra: [{ op: 'block', value: 5 }] });
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/engine/effects.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/effects"`

- [ ] **Step 4: 구현**

```ts
// src/engine/effects.ts
import { computeDamage } from './damage';
import { Rng } from './rng';
import { beats, matchup } from './stance';
import { addStatus } from './status';
import type {
  CombatState, EffectAtom, EffectTarget, EnemyState, Line, Stance,
} from './types';

export interface EffectSource {
  line: Line;
  targetUid: string | null;
  /** 이 발동에 실린 연계 피해 보너스. */
  comboBonus: number;
  /** 적이 원인일 때 그 적의 uid. */
  fromEnemyUid?: string;
}

const STANCES: Stance[] = ['wai', 'gyeong', 'nae'];

export function comboBonusFor(line: Stance): { damageBonus: number; extra: EffectAtom[] } {
  if (line === 'wai') return { damageBonus: 6, extra: [] };
  if (line === 'gyeong') return { damageBonus: 0, extra: [{ op: 'draw', value: 1 }] };
  return { damageBonus: 0, extra: [{ op: 'block', value: 5 }] };
}

export function drawCards(state: CombatState, count: number): CombatState {
  let draw = [...state.draw];
  let discard = [...state.discard];
  const hand = [...state.hand];
  let rngState = state.rngState;

  for (let i = 0; i < count; i++) {
    if (draw.length === 0) {
      if (discard.length === 0) break;
      const rng = new Rng(rngState);
      draw = rng.shuffle(discard);
      discard = [];
      rngState = rng.state;
    }
    const next = draw.shift();
    if (next) hand.push(next);
  }

  return { ...state, draw, discard, hand, rngState };
}

export function damageEnemy(
  state: CombatState, uid: string, base: number, line: Line, comboBonus: number,
): CombatState {
  const index = state.enemies.findIndex((e) => e.uid === uid);
  if (index < 0) return state;
  const target = state.enemies[index]!;
  if (target.hp <= 0) return state;

  const result = computeDamage({
    base,
    comboBonus,
    attackerLine: line,
    attackerStatus: state.player.status,
    defenderStance: target.stance,
    defenderStatus: target.status,
    defenderBlock: target.block,
  });

  const enemies = [...state.enemies];
  enemies[index] = {
    ...target,
    hp: Math.max(0, target.hp - result.hpLoss),
    block: target.block - result.blockLoss,
    status: result.defenderStatus,
  };
  return { ...state, enemies };
}

export function damagePlayer(
  state: CombatState, base: number, line: Line, opts: { ignoreBlock?: boolean } = {},
): CombatState {
  const result = computeDamage({
    base,
    attackerLine: line,
    attackerStatus: {},
    defenderStance: state.player.stance,
    defenderStatus: state.player.status,
    defenderBlock: state.player.block,
    ignoreBlock: opts.ignoreBlock,
  });

  return {
    ...state,
    player: {
      ...state.player,
      hp: Math.max(0, state.player.hp - result.hpLoss),
      block: state.player.block - result.blockLoss,
      status: result.defenderStatus,
    },
  };
}

function resolveTargets(state: CombatState, target: EffectTarget, src: EffectSource): EnemyState[] {
  const alive = state.enemies.filter((e) => e.hp > 0);
  if (target === 'allEnemies') return alive;
  const chosen = alive.find((e) => e.uid === src.targetUid);
  return chosen ? [chosen] : alive.slice(0, 1);
}

export function applyEffects(
  state: CombatState, atoms: EffectAtom[], src: EffectSource,
): CombatState {
  let s = state;

  for (const atom of atoms) {
    switch (atom.op) {
      case 'damage': {
        const hits = atom.hits ?? 1;
        const targets = resolveTargets(s, atom.target ?? 'enemy', src);
        for (let i = 0; i < hits; i++) {
          for (const t of targets) s = damageEnemy(s, t.uid, atom.value, src.line, src.comboBonus);
        }
        break;
      }
      case 'block':
        s = { ...s, player: { ...s.player, block: s.player.block + atom.value } };
        break;
      case 'loseBlock':
        s = { ...s, player: { ...s.player, block: 0 } };
        break;
      case 'keepBlock':
        s = { ...s, keepBlock: true };
        break;
      case 'draw':
        s = drawCards(s, atom.value);
        break;
      case 'gainQi':
        s = { ...s, player: { ...s.player, qi: s.player.qi + atom.value } };
        break;
      case 'heal':
        s = { ...s, player: { ...s.player, hp: Math.min(s.player.maxHp, s.player.hp + atom.value) } };
        break;
      case 'applyStatus': {
        if ((atom.target ?? 'enemy') === 'self') {
          s = { ...s, player: { ...s.player, status: addStatus(s.player.status, atom.status, atom.value) } };
          break;
        }
        const targets = resolveTargets(s, atom.target ?? 'enemy', src);
        const uids = new Set(targets.map((t) => t.uid));
        s = {
          ...s,
          enemies: s.enemies.map((e) =>
            uids.has(e.uid) ? { ...e, status: addStatus(e.status, atom.status, atom.value) } : e,
          ),
        };
        break;
      }
      case 'ifCombo':
        if (s.combo.count >= atom.min && s.combo.line !== null) s = applyEffects(s, atom.then, src);
        break;
      case 'ifBreak': {
        const target = resolveTargets(s, 'enemy', src)[0];
        if (target && matchup(src.line, target.stance) === 'break') s = applyEffects(s, atom.then, src);
        break;
      }
      case 'counterStance': {
        const target = resolveTargets(s, 'enemy', src)[0];
        if (target) {
          const counter = STANCES.find((st) => beats(st, target.stance));
          if (counter) s = { ...s, player: { ...s.player, stance: counter } };
        }
        break;
      }
    }
  }

  return s;
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

Run: `npx vitest run tests/engine/effects.test.ts && npm run typecheck`
Expected: PASS — 21 tests, 타입 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add src/engine/types.ts src/engine/effects.ts tests/engine/effects.test.ts
git commit -m "엔진: 전투 타입과 효과 원자 해석기 11종"
```

---

## Task 7: 적 의도 AI

**Files:**
- Create: `src/engine/enemies.ts`
- Test: `tests/engine/enemies.test.ts`

**Interfaces:**
- Consumes: `Rng` (Task 2), `EnemyState`/`Intent` (Task 6)
- Produces:
  - `interface EnemyAction { id: string; kind: IntentKind; line: Line; label: string; weight: number; value: number; hits?: number; effects: EffectAtom[]; maxInARow?: number }`
  - `interface EnemyDef { id: string; name: string; hanja: string; portrait?: string; hp: [number, number]; startStance: Stance; tier: 'normal' | 'elite' | 'boss'; act: number; actions: EnemyAction[] }`
  - `function spawnEnemy(def: EnemyDef, uid: string, rng: Rng): EnemyState`
  - `function chooseIntent(def: EnemyDef, enemy: EnemyState, rng: Rng): Intent`

적 행동은 가중 추첨하되 `maxInARow`(기본 2)를 넘어 같은 행동이 연속되지 않는다. 의도에는 계열이 실려 있어 플레이어가 다음 자세를 미리 읽는다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/engine/enemies.test.ts
import { describe, it, expect } from 'vitest';
import { spawnEnemy, chooseIntent } from '../../src/engine/enemies';
import { Rng, seedFrom } from '../../src/engine/rng';
import type { EnemyDef } from '../../src/engine/enemies';

const def: EnemyDef = {
  id: 'dog', name: '들개', hanja: '犬', hp: [18, 22], startStance: 'gyeong',
  tier: 'normal', act: 1,
  actions: [
    { id: 'bite', kind: 'attack', line: 'gyeong', label: '물어뜯기', weight: 3, value: 6,
      effects: [{ op: 'damage', value: 6 }], maxInARow: 2 },
    { id: 'howl', kind: 'buff', line: 'sul', label: '울부짖기', weight: 1, value: 1,
      effects: [{ op: 'applyStatus', status: 'momentum', value: 1, target: 'self' }] },
  ],
};

describe('spawnEnemy', () => {
  it('체력이 정의된 범위 안이다', () => {
    for (let i = 0; i < 100; i++) {
      const e = spawnEnemy(def, `e${i}`, new Rng(seedFrom(`s${i}`)));
      expect(e.hp).toBeGreaterThanOrEqual(18);
      expect(e.hp).toBeLessThanOrEqual(22);
      expect(e.hp).toBe(e.maxHp);
    }
  });

  it('초기 자세와 이름이 정의를 따른다', () => {
    const e = spawnEnemy(def, 'e1', new Rng(1));
    expect(e.stance).toBe('gyeong');
    expect(e.name).toBe('들개');
    expect(e.defId).toBe('dog');
    expect(e.uid).toBe('e1');
    expect(e.block).toBe(0);
    expect(e.status).toEqual({});
    expect(e.history).toEqual([]);
  });

  it('같은 시드는 같은 체력을 준다', () => {
    const a = spawnEnemy(def, 'x', new Rng(seedFrom('고정')));
    const b = spawnEnemy(def, 'x', new Rng(seedFrom('고정')));
    expect(a.hp).toBe(b.hp);
  });
});

describe('chooseIntent', () => {
  it('의도에 계열과 수치가 실린다', () => {
    const e = spawnEnemy(def, 'e1', new Rng(1));
    const intent = chooseIntent(def, e, new Rng(seedFrom('의도')));
    expect(['bite', 'howl']).toContain(intent.actionId);
    expect(['gyeong', 'sul']).toContain(intent.line);
    expect(intent.label.length).toBeGreaterThan(0);
    expect(intent.hits).toBeGreaterThanOrEqual(1);
  });

  it('같은 행동이 maxInARow를 넘어 연속되지 않는다', () => {
    const e = { ...spawnEnemy(def, 'e1', new Rng(1)), history: ['bite', 'bite'] };
    for (let i = 0; i < 50; i++) {
      expect(chooseIntent(def, e, new Rng(seedFrom(`r${i}`))).actionId).toBe('howl');
    }
  });

  it('maxInARow가 없으면 기본 2가 적용된다', () => {
    const e = { ...spawnEnemy(def, 'e1', new Rng(1)), history: ['howl', 'howl'] };
    for (let i = 0; i < 50; i++) {
      expect(chooseIntent(def, e, new Rng(seedFrom(`q${i}`))).actionId).toBe('bite');
    }
  });

  it('모든 행동이 막히면 제한을 무시하고 하나를 고른다', () => {
    const single: EnemyDef = { ...def, actions: [def.actions[0]!] };
    const e = { ...spawnEnemy(single, 'e1', new Rng(1)), history: ['bite', 'bite'] };
    expect(chooseIntent(single, e, new Rng(1)).actionId).toBe('bite');
  });

  it('같은 시드는 같은 의도를 낸다', () => {
    const e = spawnEnemy(def, 'e1', new Rng(1));
    const a = chooseIntent(def, e, new Rng(seedFrom('동일')));
    const b = chooseIntent(def, e, new Rng(seedFrom('동일')));
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/engine/enemies.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/enemies"`

- [ ] **Step 3: 구현**

```ts
// src/engine/enemies.ts
import { Rng } from './rng';
import type {
  EffectAtom, EnemyState, Intent, IntentKind, Line, Stance,
} from './types';

export interface EnemyAction {
  id: string;
  kind: IntentKind;
  line: Line;
  label: string;
  weight: number;
  /** 의도 표시에 쓰는 대표 수치 (피해량, 방어량 등). */
  value: number;
  hits?: number;
  effects: EffectAtom[];
  /** 연속 사용 허용 횟수. 기본 2. */
  maxInARow?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  hanja: string;
  portrait?: string;
  hp: [number, number];
  startStance: Stance;
  tier: 'normal' | 'elite' | 'boss';
  act: number;
  actions: EnemyAction[];
}

const DEFAULT_MAX_IN_A_ROW = 2;

export function spawnEnemy(def: EnemyDef, uid: string, rng: Rng): EnemyState {
  const hp = rng.range(def.hp[0], def.hp[1]);
  return {
    uid,
    defId: def.id,
    name: def.name,
    hp,
    maxHp: hp,
    block: 0,
    stance: def.startStance,
    status: {},
    intent: null,
    history: [],
  };
}

function trailingRepeat(history: readonly string[], id: string): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0 && history[i] === id; i--) n++;
  return n;
}

export function chooseIntent(def: EnemyDef, enemy: EnemyState, rng: Rng): Intent {
  const allowed = def.actions.filter(
    (a) => trailingRepeat(enemy.history, a.id) < (a.maxInARow ?? DEFAULT_MAX_IN_A_ROW),
  );
  const pool = allowed.length > 0 ? allowed : def.actions;
  const action = rng.weighted(pool.map((a) => [a, a.weight] as const));

  return {
    actionId: action.id,
    kind: action.kind,
    line: action.line,
    value: action.value,
    hits: action.hits ?? 1,
    label: action.label,
  };
}

export function findAction(def: EnemyDef, actionId: string): EnemyAction | undefined {
  return def.actions.find((a) => a.id === actionId);
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `npx vitest run tests/engine/enemies.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: 커밋**

```bash
git add src/engine/enemies.ts tests/engine/enemies.test.ts
git commit -m "엔진: 적 의도 AI. 가중 추첨과 연속 사용 제한"
```

---

## Task 8: 전투 상태 기계

**Files:**
- Create: `src/engine/content.ts`, `src/engine/combat.ts`
- Test: `tests/engine/combat.test.ts`

**Interfaces:**
- Consumes: Task 2~7 전부
- Produces (content.ts):
  - `interface ContentIndex { card(id: string): CardDef; enemy(id: string): EnemyDef; cards(): CardDef[]; enemiesOf(act: number, tier: EnemyDef['tier']): EnemyDef[] }`
  - `function makeContentIndex(input: { cards: CardDef[]; enemies: EnemyDef[] }): ContentIndex`
- Produces (combat.ts):
  - `interface CombatSetup { seed: number; player: { hp: number; maxHp: number; maxQi: number; stance: Stance; relics: string[] }; enemyIds: string[]; deck: CardInstance[]; handSize?: number }`
  - `type CombatAction = { type: 'playCard'; uid: string; targetUid?: string } | { type: 'endTurn' }`
  - `function startCombat(setup: CombatSetup, content: ContentIndex): CombatState`
  - `function applyAction(state: CombatState, action: CombatAction, content: ContentIndex): CombatState`
  - `function canPlay(state: CombatState, uid: string, content: ContentIndex): boolean`
  - `function effectiveCard(def: CardDef, upgraded: boolean): CardDef`

적 행동의 효과 원자는 **플레이어를 향한다.** 카드용 `applyEffects`와는 해석기가 다르다 (`applyEnemyEffects`). `damage`는 플레이어에게, `block`·`heal`은 자기 자신에게, `applyStatus`의 `self`는 그 적에게 간다.

- [ ] **Step 1: content.ts 작성**

```ts
// src/engine/content.ts
import type { EnemyDef } from './enemies';
import type { CardDef } from './types';

export interface ContentIndex {
  card(id: string): CardDef;
  enemy(id: string): EnemyDef;
  cards(): CardDef[];
  enemiesOf(act: number, tier: EnemyDef['tier']): EnemyDef[];
}

export function makeContentIndex(input: { cards: CardDef[]; enemies: EnemyDef[] }): ContentIndex {
  const cardMap = new Map(input.cards.map((c) => [c.id, c]));
  const enemyMap = new Map(input.enemies.map((e) => [e.id, e]));

  return {
    card(id) {
      const def = cardMap.get(id);
      if (!def) throw new Error(`알 수 없는 카드: ${id}`);
      return def;
    },
    enemy(id) {
      const def = enemyMap.get(id);
      if (!def) throw new Error(`알 수 없는 적: ${id}`);
      return def;
    },
    cards: () => [...cardMap.values()],
    enemiesOf: (act, tier) => input.enemies.filter((e) => e.act === act && e.tier === tier),
  };
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

```ts
// tests/engine/combat.test.ts
import { describe, it, expect } from 'vitest';
import { makeContentIndex } from '../../src/engine/content';
import { startCombat, applyAction, canPlay, effectiveCard } from '../../src/engine/combat';
import type { CombatSetup } from '../../src/engine/combat';
import type { CardDef, CardInstance, CombatState } from '../../src/engine/types';
import type { EnemyDef } from '../../src/engine/enemies';

const CARDS: CardDef[] = [
  { id: 'byeokta', name: '벽타', hanja: '劈打', school: 'common', line: 'wai', cost: 1,
    rarity: 'basic', target: 'enemy', text: '6 피해', effects: [{ op: 'damage', value: 6 }] },
  { id: 'bangsin', name: '방신', hanja: '防身', school: 'common', line: 'nae', cost: 1,
    rarity: 'basic', target: 'self', text: '호신강기 5', effects: [{ op: 'block', value: 5 }],
    upgrade: { cost: 1, effects: [{ op: 'block', value: 8 }] } },
  { id: 'hoheup', name: '호흡', hanja: '呼吸', school: 'common', line: 'sul', cost: 0,
    rarity: 'common', target: 'self', text: '내공 +1, 카드 1장. 소멸',
    effects: [{ op: 'gainQi', value: 1 }, { op: 'draw', value: 1 }], exhaust: true },
];

const ENEMIES: EnemyDef[] = [
  { id: 'dummy', name: '허수아비', hanja: '芻', hp: [30, 30], startStance: 'gyeong',
    tier: 'normal', act: 1,
    actions: [
      { id: 'poke', kind: 'attack', line: 'gyeong', label: '찌르기', weight: 1, value: 5,
        effects: [{ op: 'damage', value: 5 }], maxInARow: 99 },
    ] },
  { id: 'turtle', name: '철갑귀', hanja: '龜', hp: [40, 40], startStance: 'nae',
    tier: 'normal', act: 1,
    actions: [
      { id: 'guard', kind: 'defend', line: 'nae', label: '움츠리기', weight: 1, value: 8,
        effects: [{ op: 'block', value: 8 }], maxInARow: 99 },
    ] },
];

const content = makeContentIndex({ cards: CARDS, enemies: ENEMIES });

function deck(...ids: string[]): CardInstance[] {
  return ids.map((defId, i) => ({ uid: `u${i}`, defId, upgraded: false }));
}

function setup(over: Partial<CombatSetup> = {}): CombatSetup {
  return {
    seed: 4242,
    player: { hp: 80, maxHp: 80, maxQi: 3, stance: 'wai', relics: [] },
    enemyIds: ['dummy'],
    deck: deck('byeokta', 'byeokta', 'byeokta', 'bangsin', 'bangsin', 'hoheup'),
    ...over,
  };
}

function handUidOf(s: CombatState, defId: string): string {
  const found = s.hand.find((c) => c.defId === defId);
  if (!found) throw new Error(`손에 ${defId} 없음`);
  return found.uid;
}

describe('startCombat', () => {
  it('첫 턴에 손패를 채우고 내공을 준다', () => {
    const s = startCombat(setup(), content);
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('player');
    expect(s.hand).toHaveLength(5);
    expect(s.draw).toHaveLength(1);
    expect(s.player.qi).toBe(3);
    expect(s.player.stance).toBe('wai');
  });

  it('적이 첫 의도를 이미 가지고 있다', () => {
    const s = startCombat(setup(), content);
    expect(s.enemies[0]!.intent).not.toBeNull();
    expect(s.enemies[0]!.intent!.line).toBe('gyeong');
  });

  it('같은 시드는 같은 초기 상태를 만든다', () => {
    expect(startCombat(setup(), content)).toEqual(startCombat(setup(), content));
  });
});

describe('playCard', () => {
  it('내공을 소비하고 손에서 버린 패로 간다', () => {
    const s0 = startCombat(setup(), content);
    const uid = handUidOf(s0, 'byeokta');
    const s1 = applyAction(s0, { type: 'playCard', uid, targetUid: 'e0' }, content);
    expect(s1.player.qi).toBe(2);
    expect(s1.hand.find((c) => c.uid === uid)).toBeUndefined();
    expect(s1.discard.some((c) => c.uid === uid)).toBe(true);
  });

  it('자세가 카드 계열로 바뀐다', () => {
    const s0 = startCombat(setup(), content);
    const s1 = applyAction(s0, { type: 'playCard', uid: handUidOf(s0, 'bangsin') }, content);
    expect(s1.player.stance).toBe('nae');
  });

  it('술수 카드는 자세를 바꾸지 않고 소멸한다', () => {
    const s0 = startCombat(setup({ deck: deck('hoheup', 'byeokta', 'byeokta', 'byeokta', 'byeokta') }), content);
    const uid = handUidOf(s0, 'hoheup');
    const s1 = applyAction(s0, { type: 'playCard', uid }, content);
    expect(s1.player.stance).toBe('wai');
    expect(s1.exhaust.some((c) => c.uid === uid)).toBe(true);
    expect(s1.discard.some((c) => c.uid === uid)).toBe(false);
  });

  it('외공 3연타에서 연계 보너스가 붙는다', () => {
    let s = startCombat(setup({ deck: deck('byeokta', 'byeokta', 'byeokta', 'byeokta', 'byeokta') }), content);
    const hp0 = s.enemies[0]!.hp;
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    const after1 = hp0 - s.enemies[0]!.hp;
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    const total = hp0 - s.enemies[0]!.hp;
    // 1·2번째는 (6)*1.5=9, 3번째는 (6+6)*1.5=18
    expect(after1).toBe(9);
    expect(total).toBe(9 + 9 + 18);
    expect(s.combo).toEqual({ line: 'wai', count: 3 });
  });

  it('내공은 부족하면 낼 수 없다', () => {
    let s = startCombat(setup({ deck: deck('byeokta', 'byeokta', 'byeokta', 'byeokta', 'byeokta') }), content);
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    expect(s.player.qi).toBe(0);
    expect(canPlay(s, s.hand[0]!.uid, content)).toBe(false);
    const blocked = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    expect(blocked).toBe(s);
  });

  it('손에 없는 카드는 무시된다', () => {
    const s = startCombat(setup(), content);
    expect(applyAction(s, { type: 'playCard', uid: 'nope' }, content)).toBe(s);
  });
});

describe('턴 전환', () => {
  it('턴 종료 시 손패를 버리고 적이 행동한 뒤 새 손패를 받는다', () => {
    const s0 = startCombat(setup(), content);
    const s1 = applyAction(s0, { type: 'endTurn' }, content);
    expect(s1.turn).toBe(2);
    expect(s1.phase).toBe('player');
    expect(s1.hand).toHaveLength(5);
    expect(s1.player.qi).toBe(3);
    expect(s1.player.hp).toBeLessThan(80); // 허수아비가 때린다
  });

  it('적의 자세가 실행한 행동의 계열로 바뀐다', () => {
    const s = applyAction(startCombat(setup({ enemyIds: ['turtle'] }), content), { type: 'endTurn' }, content);
    expect(s.enemies[0]!.stance).toBe('nae');
    expect(s.enemies[0]!.block).toBe(8);
  });

  it('플레이어 턴 시작에 호신강기가 사라진다', () => {
    let s = startCombat(setup(), content);
    s = applyAction(s, { type: 'playCard', uid: handUidOf(s, 'bangsin') }, content);
    expect(s.player.block).toBe(5);
    s = applyAction(s, { type: 'endTurn' }, content);
    expect(s.player.block).toBe(0);
  });

  it('적 공격에도 상성이 적용된다', () => {
    // 플레이어 자세 내공, 적 경공 공격 5 → 경공▶내공 이므로 파훼 7
    let s = startCombat(setup(), content);
    s = applyAction(s, { type: 'playCard', uid: handUidOf(s, 'bangsin') }, content);
    const hp = s.player.hp;
    s = applyAction(s, { type: 'endTurn' }, content);
    expect(hp - s.player.hp).toBe(7);
  });

  it('중독은 턴 시작에 호신강기를 무시하고 체력을 깎는다', () => {
    let s = startCombat(setup(), content);
    s = { ...s, player: { ...s.player, status: { poison: 3 }, block: 50 } };
    const hp = s.player.hp;
    s = applyAction(s, { type: 'endTurn' }, content);
    expect(s.player.status.poison).toBe(2);
    expect(hp - s.player.hp).toBeGreaterThanOrEqual(3);
  });

  it('내상은 다음 턴 내공을 줄이고 사라진다', () => {
    let s = startCombat(setup(), content);
    s = { ...s, player: { ...s.player, status: { naesang: 2 } } };
    s = applyAction(s, { type: 'endTurn' }, content);
    expect(s.player.qi).toBe(1);
    expect(s.player.status.naesang).toBeUndefined();
  });
});

describe('승패', () => {
  it('적이 전부 쓰러지면 won', () => {
    let s = startCombat(setup(), content);
    s = { ...s, enemies: [{ ...s.enemies[0]!, hp: 1 }] };
    s = applyAction(s, { type: 'playCard', uid: handUidOf(s, 'byeokta'), targetUid: 'e0' }, content);
    expect(s.phase).toBe('won');
  });

  it('체력이 0이 되면 lost', () => {
    let s = startCombat(setup(), content);
    s = { ...s, player: { ...s.player, hp: 3 } };
    s = applyAction(s, { type: 'endTurn' }, content);
    expect(s.phase).toBe('lost');
  });

  it('전투가 끝나면 더 이상 액션을 받지 않는다', () => {
    let s = startCombat(setup(), content);
    s = { ...s, phase: 'won' };
    expect(applyAction(s, { type: 'endTurn' }, content)).toBe(s);
  });
});

describe('강화', () => {
  it('effectiveCard는 강화 효과로 대체한다', () => {
    const base = content.card('bangsin');
    expect(effectiveCard(base, false).effects).toEqual([{ op: 'block', value: 5 }]);
    expect(effectiveCard(base, true).effects).toEqual([{ op: 'block', value: 8 }]);
  });

  it('강화 정의가 없으면 원본 그대로다', () => {
    const base = content.card('byeokta');
    expect(effectiveCard(base, true)).toEqual(base);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/engine/combat.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/combat"`

- [ ] **Step 4: 구현**

```ts
// src/engine/combat.ts
import type { ContentIndex } from './content';
import { applyEffects, comboBonusFor, damagePlayer, drawCards } from './effects';
import { chooseIntent, findAction, spawnEnemy, type EnemyDef } from './enemies';
import { Rng } from './rng';
import { comboFires, nextStance, updateCombo } from './stance';
import { addStatus, consumeStatus, getStatus, tickStatus } from './status';
import type {
  CardDef, CardInstance, CombatState, EffectAtom, EnemyState, Stance,
} from './types';

export interface CombatSetup {
  seed: number;
  player: { hp: number; maxHp: number; maxQi: number; stance: Stance; relics: string[] };
  enemyIds: string[];
  deck: CardInstance[];
  handSize?: number;
}

export type CombatAction =
  | { type: 'playCard'; uid: string; targetUid?: string }
  | { type: 'endTurn' };

export function effectiveCard(def: CardDef, upgraded: boolean): CardDef {
  if (!upgraded || !def.upgrade) return def;
  return {
    ...def,
    cost: def.upgrade.cost ?? def.cost,
    text: def.upgrade.text ?? def.text,
    effects: def.upgrade.effects ?? def.effects,
  };
}

export function startCombat(setup: CombatSetup, content: ContentIndex): CombatState {
  const rng = new Rng(setup.seed);
  const enemies = setup.enemyIds.map((id, i) => spawnEnemy(content.enemy(id), `e${i}`, rng));
  const withIntent = enemies.map((e) => ({
    ...e,
    intent: chooseIntent(content.enemy(e.defId), e, rng),
  }));

  const draw = rng.shuffle(setup.deck);

  const state: CombatState = {
    rngState: rng.state,
    turn: 0,
    phase: 'player',
    player: {
      hp: setup.player.hp,
      maxHp: setup.player.maxHp,
      qi: 0,
      maxQi: setup.player.maxQi,
      block: 0,
      stance: setup.player.stance,
      status: {},
      relics: [...setup.player.relics],
    },
    enemies: withIntent,
    draw,
    hand: [],
    discard: [],
    exhaust: [],
    combo: { line: null, count: 0 },
    handSize: setup.handSize ?? 5,
    keepBlock: false,
    log: [],
  };

  return beginPlayerTurn(state);
}

function beginPlayerTurn(state: CombatState): CombatState {
  let s: CombatState = { ...state, turn: state.turn + 1, phase: 'player' };

  if (!s.keepBlock) s = { ...s, player: { ...s.player, block: 0 } };
  s = { ...s, keepBlock: false };

  const poison = getStatus(s.player.status, 'poison');
  if (poison > 0) {
    s = { ...s, player: { ...s.player, hp: Math.max(0, s.player.hp - poison) } };
  }

  const naesang = getStatus(s.player.status, 'naesang');
  const qi = Math.max(0, s.player.maxQi - naesang);
  let status = tickStatus(s.player.status);
  if (naesang > 0) status = consumeStatus(status, 'naesang', naesang);

  s = { ...s, player: { ...s.player, qi, status } };
  s = drawCards(s, s.handSize);
  return settle(s);
}

/** 적 행동의 효과 원자는 플레이어를 향한다. 카드용 해석기와 다르다. */
function applyEnemyEffects(
  state: CombatState, atoms: EffectAtom[], enemyUid: string, line: CardDef['line'],
): CombatState {
  let s = state;

  const patchEnemy = (fn: (e: EnemyState) => EnemyState): void => {
    s = { ...s, enemies: s.enemies.map((e) => (e.uid === enemyUid ? fn(e) : e)) };
  };

  for (const atom of atoms) {
    switch (atom.op) {
      case 'damage': {
        const hits = atom.hits ?? 1;
        for (let i = 0; i < hits; i++) s = damagePlayer(s, atom.value, line);
        break;
      }
      case 'block':
        patchEnemy((e) => ({ ...e, block: e.block + atom.value }));
        break;
      case 'heal':
        patchEnemy((e) => ({ ...e, hp: Math.min(e.maxHp, e.hp + atom.value) }));
        break;
      case 'applyStatus':
        if ((atom.target ?? 'enemy') === 'self') {
          patchEnemy((e) => ({ ...e, status: addStatus(e.status, atom.status, atom.value) }));
        } else {
          s = { ...s, player: { ...s.player, status: addStatus(s.player.status, atom.status, atom.value) } };
        }
        break;
      default:
        break;
    }
  }

  return s;
}

function runEnemyTurn(state: CombatState, content: ContentIndex): CombatState {
  let s: CombatState = { ...state, phase: 'enemy' };
  const rng = new Rng(s.rngState);

  for (const snapshot of s.enemies) {
    const current = s.enemies.find((e) => e.uid === snapshot.uid);
    if (!current || current.hp <= 0) continue;

    const poison = getStatus(current.status, 'poison');
    let self: EnemyState = {
      ...current,
      hp: Math.max(0, current.hp - poison),
      block: 0,
      status: tickStatus(current.status),
    };
    s = { ...s, enemies: s.enemies.map((e) => (e.uid === self.uid ? self : e)) };
    if (self.hp <= 0) continue;

    const def: EnemyDef = content.enemy(self.defId);
    const intent = self.intent ?? chooseIntent(def, self, rng);
    const action = findAction(def, intent.actionId);
    if (action) {
      s = applyEnemyEffects(s, action.effects, self.uid, action.line);
      const after = s.enemies.find((e) => e.uid === self.uid);
      if (after) {
        self = {
          ...after,
          stance: nextStance(after.stance, action.line),
          history: [...after.history, action.id].slice(-4),
        };
        s = { ...s, enemies: s.enemies.map((e) => (e.uid === self.uid ? self : e)) };
      }
    }

    if (s.player.hp <= 0) break;

    const alive = s.enemies.find((e) => e.uid === self.uid);
    if (alive && alive.hp > 0) {
      const nextIntent = chooseIntent(def, alive, rng);
      s = { ...s, enemies: s.enemies.map((e) => (e.uid === alive.uid ? { ...e, intent: nextIntent } : e)) };
    }
  }

  return { ...s, rngState: rng.state };
}

/** 죽은 적을 치우고 승패를 판정한다. */
function settle(state: CombatState): CombatState {
  const enemies = state.enemies.filter((e) => e.hp > 0);
  const s = { ...state, enemies };
  if (s.player.hp <= 0) return { ...s, phase: 'lost' };
  if (enemies.length === 0) return { ...s, phase: 'won' };
  return s;
}

export function canPlay(state: CombatState, uid: string, content: ContentIndex): boolean {
  if (state.phase !== 'player') return false;
  const card = state.hand.find((c) => c.uid === uid);
  if (!card) return false;
  const def = effectiveCard(content.card(card.defId), card.upgraded);
  return state.player.qi >= def.cost;
}

export function applyAction(
  state: CombatState, action: CombatAction, content: ContentIndex,
): CombatState {
  if (state.phase === 'won' || state.phase === 'lost') return state;

  if (action.type === 'endTurn') {
    let s: CombatState = { ...state, discard: [...state.discard, ...state.hand], hand: [] };
    s = runEnemyTurn(s, content);
    s = settle(s);
    if (s.phase === 'won' || s.phase === 'lost') return s;
    return beginPlayerTurn(s);
  }

  if (!canPlay(state, action.uid, content)) return state;

  const card = state.hand.find((c) => c.uid === action.uid)!;
  const def = effectiveCard(content.card(card.defId), card.upgraded);

  const combo = updateCombo(state.combo, def.line);
  const fires = comboFires(combo);
  const bonus = fires && combo.line ? comboBonusFor(combo.line) : { damageBonus: 0, extra: [] };

  let s: CombatState = {
    ...state,
    hand: state.hand.filter((c) => c.uid !== action.uid),
    player: {
      ...state.player,
      qi: state.player.qi - def.cost,
      stance: nextStance(state.player.stance, def.line),
    },
    combo,
  };
  s = def.exhaust ? { ...s, exhaust: [...s.exhaust, card] } : { ...s, discard: [...s.discard, card] };

  const target = action.targetUid ?? s.enemies.find((e) => e.hp > 0)?.uid ?? null;
  s = applyEffects(s, [...def.effects, ...bonus.extra], {
    line: def.line,
    targetUid: target,
    comboBonus: bonus.damageBonus,
  });

  return settle(s);
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

Run: `npx vitest run && npm run typecheck`
Expected: PASS — 전체 테스트 통과

- [ ] **Step 6: 커밋**

```bash
git add src/engine/content.ts src/engine/combat.ts tests/engine/combat.test.ts
git commit -m "엔진: 전투 상태 기계. 턴 순환·자세 전환·연계·승패"
```

---

## Task 9: 기물

기물은 **패시브 보정(mods)** 과 **훅 트리거(triggers)** 두 가지로만 표현한다. 개별 기물을 위한 특수 코드는 쓰지 않는다.

**Files:**
- Create: `src/engine/relics.ts`
- Modify: `src/engine/stance.ts` (`comboFires`에 임계값 인자 추가), `src/engine/content.ts` (`relic()` 추가), `src/engine/combat.ts` (훅 호출)
- Test: `tests/engine/relics.test.ts`

**Interfaces:**
- Produces:
  - `type RelicHook = 'onCombatStart' | 'onTurnStart' | 'onKill' | 'onCombatEnd'`
  - `interface RelicMods { maxHp: number; maxQi: number; handSize: number; startBlock: number; comboThreshold: number }`
  - `interface RelicDef { id: string; name: string; hanja: string; rarity: Rarity; text: string; mods?: Partial<RelicMods>; triggers?: Array<{ hook: RelicHook; onlyTurn?: number; effects: EffectAtom[] }> }`
  - `function relicMods(relicIds: string[], content: ContentIndex): RelicMods`
  - `function triggerRelics(state: CombatState, hook: RelicHook, content: ContentIndex): CombatState`
- 변경: `comboFires(combo: Combo, threshold?: number): boolean` — 기본값 `COMBO_THRESHOLD`
- 변경: `ContentIndex`에 `relic(id: string): RelicDef` 및 `relics(): RelicDef[]` 추가, `makeContentIndex` 입력에 `relics: RelicDef[]` 추가
- 변경: `CombatSetup.player`에 `relics` 반영 — `startCombat`이 `relicMods`로 `maxHp`·`maxQi`·`handSize`·`startBlock`을 보정하고 `onCombatStart` 훅을 발동. `beginPlayerTurn`은 `onTurnStart` 훅을 발동. `applyAction`의 연계 판정은 `comboFires(combo, mods.comboThreshold)`를 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/engine/relics.test.ts
import { describe, it, expect } from 'vitest';
import { makeContentIndex } from '../../src/engine/content';
import { relicMods, triggerRelics } from '../../src/engine/relics';
import { startCombat, applyAction } from '../../src/engine/combat';
import { comboFires } from '../../src/engine/stance';
import type { RelicDef } from '../../src/engine/relics';
import type { CardDef } from '../../src/engine/types';
import type { EnemyDef } from '../../src/engine/enemies';

const RELICS: RelicDef[] = [
  { id: 'geungol', name: '근골', hanja: '筋', rarity: 'common', text: '최대 체력 +8', mods: { maxHp: 8 } },
  { id: 'gihae', name: '기해혈', hanja: '氣', rarity: 'rare', text: '최대 내공 +1', mods: { maxQi: 1 } },
  { id: 'jungnip', name: '낡은 죽립', hanja: '笠', rarity: 'common', text: '전투 시작 시 호신강기 5', mods: { startBlock: 5 } },
  { id: 'bongkyeol', name: '죽봉 매듭', hanja: '結', rarity: 'rare', text: '연계가 2장부터 발동', mods: { comboThreshold: -1 } },
  { id: 'bigeup', name: '반쪽 비급', hanja: '笈', rarity: 'common', text: '전투 시작 시 기세 2',
    triggers: [{ hook: 'onCombatStart', effects: [{ op: 'applyStatus', status: 'momentum', value: 2, target: 'self' }] }] },
  { id: 'horibyeong', name: '취선의 호리병', hanja: '瓢', rarity: 'common', text: '첫 턴에 내공 +2',
    triggers: [{ hook: 'onTurnStart', onlyTurn: 1, effects: [{ op: 'gainQi', value: 2 }] }] },
];

const CARDS: CardDef[] = [
  { id: 'byeokta', name: '벽타', hanja: '劈打', school: 'common', line: 'wai', cost: 1,
    rarity: 'basic', target: 'enemy', text: '6 피해', effects: [{ op: 'damage', value: 6 }] },
];

const ENEMIES: EnemyDef[] = [
  { id: 'dummy', name: '허수아비', hanja: '芻', hp: [60, 60], startStance: 'wai', tier: 'normal', act: 1,
    actions: [{ id: 'wait', kind: 'special', line: 'sul', label: '노려보기', weight: 1, value: 0, effects: [], maxInARow: 99 }] },
];

const content = makeContentIndex({ cards: CARDS, enemies: ENEMIES, relics: RELICS });

function setup(relics: string[]) {
  return {
    seed: 7, enemyIds: ['dummy'],
    player: { hp: 80, maxHp: 80, maxQi: 3, stance: 'wai' as const, relics },
    deck: Array.from({ length: 8 }, (_, i) => ({ uid: `u${i}`, defId: 'byeokta', upgraded: false })),
  };
}

describe('relicMods', () => {
  it('보정이 없으면 기본값이다', () => {
    expect(relicMods([], content)).toEqual({ maxHp: 0, maxQi: 0, handSize: 0, startBlock: 0, comboThreshold: 0 });
  });

  it('여러 기물의 보정이 합산된다', () => {
    const m = relicMods(['geungol', 'gihae', 'jungnip'], content);
    expect(m.maxHp).toBe(8);
    expect(m.maxQi).toBe(1);
    expect(m.startBlock).toBe(5);
  });

  it('알 수 없는 기물은 무시한다', () => {
    expect(() => relicMods(['없는것'], content)).not.toThrow();
  });
});

describe('전투 통합', () => {
  it('mods가 최대 체력·내공에 반영된다', () => {
    const s = startCombat(setup(['geungol', 'gihae']), content);
    expect(s.player.maxHp).toBe(88);
    expect(s.player.maxQi).toBe(4);
    expect(s.player.qi).toBe(4);
  });

  it('startBlock은 첫 턴 호신강기를 준다', () => {
    expect(startCombat(setup(['jungnip']), content).player.block).toBe(5);
  });

  it('onCombatStart 훅이 발동한다', () => {
    expect(startCombat(setup(['bigeup']), content).player.status.momentum).toBe(2);
  });

  it('onlyTurn 훅은 그 턴에만 발동한다', () => {
    let s = startCombat(setup(['horibyeong']), content);
    expect(s.player.qi).toBe(5);
    s = applyAction(s, { type: 'endTurn' }, content);
    expect(s.turn).toBe(2);
    expect(s.player.qi).toBe(3);
  });

  it('comboThreshold 보정이 연계 발동 시점을 앞당긴다', () => {
    let s = startCombat(setup(['bongkyeol']), content);
    const hp0 = s.enemies[0]!.hp;
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    s = applyAction(s, { type: 'playCard', uid: s.hand[0]!.uid, targetUid: 'e0' }, content);
    // 자세 외공 대 외공이라 보정 없음. 1번째 6, 2번째는 연계로 12
    expect(hp0 - s.enemies[0]!.hp).toBe(6 + 12);
  });
});

describe('comboFires 임계값 인자', () => {
  it('기본은 3', () => {
    expect(comboFires({ line: 'wai', count: 2 })).toBe(false);
    expect(comboFires({ line: 'wai', count: 3 })).toBe(true);
  });
  it('임계값을 낮출 수 있다', () => {
    expect(comboFires({ line: 'wai', count: 2 }, 2)).toBe(true);
  });
  it('임계값은 1 아래로 내려가지 않는다', () => {
    expect(comboFires({ line: null, count: 9 }, 0)).toBe(false);
  });
});

describe('triggerRelics', () => {
  it('해당 훅의 기물만 발동한다', () => {
    const s = startCombat(setup(['bigeup']), content);
    const before = s.player.status.momentum ?? 0;
    expect(triggerRelics(s, 'onCombatEnd', content).player.status.momentum ?? 0).toBe(before);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/engine/relics.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/relics"`

- [ ] **Step 3: relics.ts 작성**

```ts
// src/engine/relics.ts
import type { ContentIndex } from './content';
import { applyEffects } from './effects';
import type { CombatState, EffectAtom, Rarity } from './types';

export type RelicHook = 'onCombatStart' | 'onTurnStart' | 'onKill' | 'onCombatEnd';

export interface RelicMods {
  maxHp: number;
  maxQi: number;
  handSize: number;
  startBlock: number;
  comboThreshold: number;
}

export interface RelicDef {
  id: string;
  name: string;
  hanja: string;
  rarity: Rarity;
  text: string;
  mods?: Partial<RelicMods>;
  triggers?: Array<{ hook: RelicHook; onlyTurn?: number; effects: EffectAtom[] }>;
}

const ZERO: RelicMods = { maxHp: 0, maxQi: 0, handSize: 0, startBlock: 0, comboThreshold: 0 };

export function relicMods(relicIds: string[], content: ContentIndex): RelicMods {
  const out: RelicMods = { ...ZERO };
  for (const id of relicIds) {
    let def: RelicDef;
    try {
      def = content.relic(id);
    } catch {
      continue;
    }
    for (const key of Object.keys(ZERO) as Array<keyof RelicMods>) {
      out[key] += def.mods?.[key] ?? 0;
    }
  }
  return out;
}

export function triggerRelics(
  state: CombatState, hook: RelicHook, content: ContentIndex,
): CombatState {
  let s = state;
  for (const id of state.player.relics) {
    let def: RelicDef;
    try {
      def = content.relic(id);
    } catch {
      continue;
    }
    for (const trigger of def.triggers ?? []) {
      if (trigger.hook !== hook) continue;
      if (trigger.onlyTurn !== undefined && trigger.onlyTurn !== s.turn) continue;
      s = applyEffects(s, trigger.effects, {
        line: 'sul',
        targetUid: s.enemies.find((e) => e.hp > 0)?.uid ?? null,
        comboBonus: 0,
      });
    }
  }
  return s;
}
```

- [ ] **Step 4: stance.ts · content.ts · combat.ts 수정**

`src/engine/stance.ts`의 `comboFires`를 교체한다:

```ts
export function comboFires(combo: Combo, threshold: number = COMBO_THRESHOLD): boolean {
  return combo.line !== null && combo.count >= Math.max(1, threshold);
}
```

`src/engine/content.ts`의 `ContentIndex`와 `makeContentIndex`에 기물을 추가한다:

```ts
// import 추가
import type { RelicDef } from './relics';

// ContentIndex 인터페이스에 추가
  relic(id: string): RelicDef;
  relics(): RelicDef[];

// makeContentIndex 시그니처 변경
export function makeContentIndex(
  input: { cards: CardDef[]; enemies: EnemyDef[]; relics: RelicDef[] },
): ContentIndex {
  const cardMap = new Map(input.cards.map((c) => [c.id, c]));
  const enemyMap = new Map(input.enemies.map((e) => [e.id, e]));
  const relicMap = new Map(input.relics.map((r) => [r.id, r]));
  // ... 기존 반환 객체에 아래 두 개를 추가
    relic(id) {
      const def = relicMap.get(id);
      if (!def) throw new Error(`알 수 없는 기물: ${id}`);
      return def;
    },
    relics: () => [...relicMap.values()],
```

`src/engine/combat.ts`를 수정한다. `startCombat`에서 보정과 시작 훅을 적용하고, `beginPlayerTurn`과 `applyAction`이 `content`를 받도록 한다.

```ts
// import 추가
import { relicMods, triggerRelics } from './relics';

// startCombat 안에서 player 구성을 아래로 교체
  const mods = relicMods(setup.player.relics, content);
  const maxHp = setup.player.maxHp + mods.maxHp;
  const maxQi = setup.player.maxQi + mods.maxQi;
  // ... state.player 를 다음과 같이
    player: {
      hp: Math.min(setup.player.hp, maxHp),
      maxHp,
      qi: 0,
      maxQi,
      block: mods.startBlock,
      stance: setup.player.stance,
      status: {},
      relics: [...setup.player.relics],
    },
  // ... handSize
    handSize: (setup.handSize ?? 5) + mods.handSize,

// startCombat 마지막 반환을 교체
  const seeded = triggerRelics(state, 'onCombatStart', content);
  return beginPlayerTurn(seeded, content);

// beginPlayerTurn 시그니처와 본문 변경
function beginPlayerTurn(state: CombatState, content: ContentIndex): CombatState {
  let s: CombatState = { ...state, turn: state.turn + 1, phase: 'player' };
  const mods = relicMods(s.player.relics, content);

  if (!s.keepBlock) s = { ...s, player: { ...s.player, block: mods.startBlock } };
  // ... 이하 기존 로직 동일, drawCards 직전에 훅 발동
  s = { ...s, player: { ...s.player, qi, status } };
  s = triggerRelics(s, 'onTurnStart', content);
  s = drawCards(s, s.handSize);
  return settle(s);
}

// applyAction 안의 연계 판정을 교체
  const mods = relicMods(state.player.relics, content);
  const combo = updateCombo(state.combo, def.line);
  const fires = comboFires(combo, 3 + mods.comboThreshold);

// applyAction 의 endTurn 분기 마지막 줄을 교체
  return beginPlayerTurn(s, content);
```

`startBlock`이 매 턴 적용되는 점에 주의한다. 「낡은 죽립」은 설계상 매 턴 호신강기 5를 주는 기물이며, 텍스트를 `매 턴 시작 시 호신강기 5`로 맞춘다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run && npm run typecheck`
Expected: PASS — 전체 통과

- [ ] **Step 6: 커밋**

```bash
git add src/engine/relics.ts src/engine/stance.ts src/engine/content.ts src/engine/combat.ts tests/engine/relics.test.ts
git commit -m "엔진: 기물 시스템. 패시브 보정과 훅 트리거"
```

---

## Task 10: 콘텐츠 데이터와 검증기

카드 60장·기물 20종·적 15종을 JSON으로 선언하고 검증기를 만든다. 아래 표는 스키마와 1:1로 대응한다 — `효과` 열이 `effects` 배열이고 `강화` 열이 `upgrade.effects`다.

**Files:**
- Create: `src/data/cards_common.json`, `src/data/cards_gaebang.json`, `src/data/relics.json`, `src/data/enemies.json`, `src/data/schools.json`, `src/engine/gamedata.ts`
- Create: `tools/validate_data.mjs`
- Test: `tests/engine/gamedata.test.ts`

**Interfaces:**
- Produces:
  - `src/engine/gamedata.ts` → `export const CONTENT: ContentIndex` (JSON을 읽어 `makeContentIndex`로 만든 싱글턴)
  - `export const SCHOOLS: Record<'gaebang', SchoolDef>` where `interface SchoolDef { id: 'gaebang'; name: string; hanja: string; line: Stance; maxHp: number; maxQi: number; startingDeck: string[]; startingRelic: string }`

### 공용 초식 20장 (`school: "common"`)

| id | 이름 | 한자 | 계열 | 기 | 등급 | 효과 | 강화 |
|---|---|---|---|---|---|---|---|
| byeokta | 벽타 | 劈打 | wai | 1 | basic | damage 6 | damage 9 |
| bangsin | 방신 | 防身 | nae | 1 | basic | block 5 | block 8 |
| jilju | 질주 | 疾走 | gyeong | 1 | common | damage 4 · draw 1 | damage 6 · draw 1 |
| unsin | 운신 | 運身 | gyeong | 1 | common | afterimage 1 self | afterimage 1 self · draw 1 |
| josik | 조식 | 調息 | nae | 1 | common | block 8 | block 11 |
| gyeokgong | 격공 | 擊空 | wai | 2 | common | damage 14 | damage 19 |
| yeonhwan | 연환 | 連環 | wai | 1 | common | damage 4 hits 2 | damage 5 hits 2 |
| jeomhyeol | 점혈 | 點穴 | gyeong | 1 | common | damage 5 · weak 1 | damage 7 · weak 2 |
| tugol | 투골 | 透骨 | wai | 2 | common | damage 9 · vulnerable 1 | damage 12 · vulnerable 2 |
| hoheup | 호흡 | 呼吸 | sul | 0 | common | gainQi 1 · draw 1 · 소멸 | gainQi 1 · draw 2 · 소멸 |
| gyeonchaek | 견책 | 譴責 | sul | 1 | common | draw 2 | draw 3 |
| bakcha | 박차 | 拍車 | gyeong | 0 | common | damage 3 | damage 5 |
| sundo | 순도 | 順倒 | nae | 1 | common | block 5 · keepBlock | block 8 · keepBlock |
| gigap | 기갑 | 氣甲 | nae | 2 | rare | block 12 · momentum 1 self | block 16 · momentum 1 self |
| pagyeok | 파격 | 破格 | wai | 2 | rare | damage 10 · ifBreak→vulnerable 2 | damage 14 · ifBreak→vulnerable 3 |
| dosang | 도상 | 挑傷 | gyeong | 1 | rare | damage 3 hits 3 | damage 4 hits 3 |
| jipjung | 집중 | 集中 | sul | 1 | rare | draw 3 · 소멸 | draw 3 · gainQi 1 · 소멸 |
| yeokjeon | 역전 | 逆轉 | sul | 1 | rare | counterStance · draw 1 | counterStance · draw 1 · gainQi 1 |
| mangeunchu | 만근추 | 萬斤墜 | nae | 2 | rare | block 10 · momentum 1 self | block 14 · momentum 2 self |
| sasaeng | 사생결단 | 死生決斷 | wai | 3 | ultra | damage 26 · loseBlock | damage 34 · loseBlock |

### 개방 초식 40장 (`school: "gaebang"`)

항룡십팔장 계열 — 연계를 길게 쌓는 보상이 걸려 있다.

| id | 이름 | 한자 | 계열 | 기 | 등급 | 효과 | 강화 |
|---|---|---|---|---|---|---|---|
| hangryong_yuhoe | 항룡유회 | 亢龍有悔 | wai | 2 | rare | damage 20 · ifCombo3→vulnerable 2 | damage 27 · ifCombo3→vulnerable 3 |
| biryong_jaecheon | 비룡재천 | 飛龍在天 | wai | 2 | rare | damage 16 · ifCombo3→damage 10 | damage 21 · ifCombo3→damage 14 |
| jamryong_mulyong | 잠룡물용 | 潛龍勿用 | nae | 1 | common | block 7 · ifCombo3→block 5 | block 10 · ifCombo3→block 7 |
| gyeonryong_jaejeon | 견룡재전 | 見龍在田 | wai | 1 | common | damage 8 | damage 11 |
| isang_bingji | 이상빙지 | 履霜氷至 | wai | 1 | common | damage 6 · weak 1 | damage 8 · weak 2 |
| jingyeong_baengni | 진경백리 | 震驚百里 | wai | 3 | rare | damage 12 allEnemies | damage 17 allEnemies |
| siseung_yungnyong | 시승육룡 | 時乘六龍 | wai | 1 | common | damage 7 · draw 1 | damage 9 · draw 1 |
| doryeo_girae | 돌여기래 | 突如其來 | wai | 0 | rare | damage 5 · ifCombo3→damage 9 | damage 7 · ifCombo3→damage 12 |
| sinryong_pami | 신룡파미 | 神龍擺尾 | wai | 2 | rare | damage 11 hits 2 | damage 15 hits 2 |
| hangryong_jinsu | 항룡진수 | 亢龍震首 | wai | 3 | ultra | damage 30 · ifCombo5→damage 20 | damage 38 · ifCombo5→damage 26 |

타구봉법 계열 — 상성 전환과 다수 적 대응.

| id | 이름 | 한자 | 계열 | 기 | 등급 | 효과 | 강화 |
|---|---|---|---|---|---|---|---|
| bongta_ssanggyeon | 봉타쌍견 | 棒打雙犬 | wai | 1 | common | damage 6 allEnemies | damage 9 allEnemies |
| balgu_jocheon | 발구조천 | 撥狗朝天 | gyeong | 1 | common | damage 6 · vulnerable 1 | damage 8 · vulnerable 2 |
| apgu_bae | 압구배 | 壓狗背 | nae | 1 | common | block 6 · damage 4 | block 9 · damage 6 |
| banjeol_gudun | 반절구둔 | 反截狗臀 | gyeong | 1 | rare | damage 7 · ifBreak→draw 2 | damage 10 · ifBreak→draw 2 |
| cheonha_mugu | 천하무구 | 天下無狗 | wai | 2 | rare | damage 9 hits 2 · ifCombo3→vulnerable 1 | damage 12 hits 2 · ifCombo3→vulnerable 2 |
| ogu_taljang | 오구탈장 | 惡狗奪杖 | gyeong | 1 | common | damage 5 · draw 1 | damage 7 · draw 1 |
| bonghwan_gyeok | 봉환격 | 棒環擊 | wai | 1 | common | damage 7 | damage 10 |
| jangbeop_gigyo | 장법기교 | 杖法機巧 | sul | 0 | common | draw 1 · gainQi 1 · 소멸 | draw 2 · gainQi 1 · 소멸 |
| hoengsobong | 횡소봉 | 橫掃棒 | wai | 2 | common | damage 8 allEnemies | damage 11 allEnemies |
| bongjin | 봉진 | 棒陣 | nae | 2 | rare | block 10 · ifCombo3→momentum 1 self | block 14 · ifCombo3→momentum 2 self |

취권·걸식 계열 — 잔상과 기세로 버틴다.

| id | 이름 | 한자 | 계열 | 기 | 등급 | 효과 | 강화 |
|---|---|---|---|---|---|---|---|
| chwibo | 취보 | 醉步 | gyeong | 1 | basic | damage 5 · afterimage 1 self | damage 7 · afterimage 1 self |
| chwigwon | 취권 | 醉拳 | wai | 1 | common | damage 9 · weak 1 self | damage 12 · weak 1 self |
| geolsik | 걸식 | 乞食 | sul | 0 | common | draw 1 | draw 2 |
| padogeol | 파도걸 | 破刀乞 | gyeong | 1 | common | damage 6 · afterimage 1 self | damage 8 · afterimage 1 self |
| manggeukchwi | 망극취 | 忘極醉 | nae | 2 | rare | block 9 · momentum 2 self | block 13 · momentum 2 self |
| gaegeol_jin | 개걸진 | 丐乞陣 | nae | 1 | common | block 5 · draw 1 | block 8 · draw 1 |
| nujuhaeng | 누추행 | 陋醜行 | gyeong | 0 | common | damage 3 · weak 1 | damage 5 · weak 1 |
| chwihu_ilgyeok | 취후일격 | 醉後一擊 | wai | 2 | rare | damage 13 · ifCombo3→momentum 2 self | damage 18 · ifCombo3→momentum 2 self |
| baekgyeol_hoe | 백결회 | 百結會 | sul | 1 | rare | draw 2 · gainQi 1 · 소멸 | draw 3 · gainQi 1 · 소멸 |
| chwihyang | 취향 | 醉鄕 | nae | 1 | common | block 6 · afterimage 1 self | block 9 · afterimage 1 self |

기본기 계열 — 덱의 뼈대.

| id | 이름 | 한자 | 계열 | 기 | 등급 | 효과 | 강화 |
|---|---|---|---|---|---|---|---|
| gyeolsu | 결수 | 決手 | wai | 1 | common | damage 8 · ifBreak→gainQi 1 | damage 11 · ifBreak→gainQi 1 |
| dansu | 단수 | 斷手 | gyeong | 1 | common | damage 4 hits 2 | damage 6 hits 2 |
| gangsu | 강수 | 剛手 | wai | 3 | rare | damage 22 | damage 29 |
| seokgyeok | 석격 | 石擊 | wai | 1 | common | damage 7 · ifCombo3→draw 1 | damage 10 · ifCombo3→draw 1 |
| pungun_bo | 풍운보 | 風雲步 | gyeong | 1 | rare | afterimage 2 self · draw 1 | afterimage 2 self · draw 2 |
| cheolgol | 철골 | 鐵骨 | nae | 2 | common | block 11 | block 15 |
| yeongi_josik | 연기조식 | 練氣調息 | sul | 1 | common | gainQi 2 · 소멸 | gainQi 2 · draw 1 · 소멸 |
| gwanha | 관하 | 貫河 | wai | 2 | rare | damage 15 · ifBreak→damage 10 | damage 20 · ifBreak→damage 13 |
| mugu_ilbong | 무구일봉 | 無狗一棒 | wai | 2 | ultra | damage 18 · ifCombo4→damage 18 | damage 24 · ifCombo4→damage 24 |
| hanggeol_daejin | 항걸대진 | 抗乞大陣 | nae | 3 | ultra | block 20 · momentum 3 self | block 26 · momentum 3 self |

### 기물 20종

`매 턴`이라 적힌 항목은 `mods.startBlock` 또는 `onTurnStart` 훅이다.

| id | 이름 | 한자 | 등급 | 효과 |
|---|---|---|---|---|
| geungol | 근골 | 筋 | common | mods.maxHp +8 |
| gihaehyeol | 기해혈 | 氣 | rare | mods.maxQi +1 |
| gwansu | 헐렁한 소매 | 袖 | common | mods.handSize +1 |
| jungnip | 낡은 죽립 | 笠 | common | mods.startBlock +5 (매 턴 호신강기 5) |
| horibyeong | 취선의 호리병 | 瓢 | common | onTurnStart onlyTurn 1 → gainQi 2 |
| banjjok_bigeup | 반쪽 비급 | 笈 | common | onCombatStart → momentum 2 self |
| bangpyo | 개방 표식 | 標 | common | onCombatStart → draw 1 |
| eunchim | 은침 주머니 | 針 | common | onCombatStart → poison 3 allEnemies |
| cheoljang | 무거운 철장 | 杖 | rare | mods.maxHp −5 · onCombatStart → momentum 3 self |
| yukpo | 마른 육포 | 脯 | common | onCombatEnd → heal 6 |
| okjeok | 도화 옥적 | 笛 | rare | onTurnStart → block 3 |
| heukpungjo | 흑풍의 발톱 | 爪 | rare | onKill → gainQi 1 |
| chohye | 낡은 짚신 | 鞋 | common | onTurnStart onlyTurn 1 → afterimage 1 self |
| guyang_janpyeon | 구양신공 잔편 | 陽 | rare | onTurnStart → heal 2 |
| bonggyeol | 죽봉 매듭 | 結 | rare | mods.comboThreshold −1 |
| mandok | 만독불침 혈 | 毒 | rare | mods.maxHp +15 |
| dongpae | 청동 노패 | 牌 | common | onCombatStart → block 8 |
| hwasan_tae | 화산 이끼 | 苔 | common | onCombatEnd → heal 10 |
| sabu_yupum | 사부의 유품 | 遺 | ultra | onCombatStart → draw 2 · momentum 1 self |
| hangryong_yeohyang | 항룡의 잔향 | 響 | ultra | onTurnStart → block 4 · momentum 1 self |

### 적 15종

`행동`은 `id · 계열 · 가중치 · 효과` 순이다. 체력은 `[최소, 최대]`.

| id | 이름 | 막 | 등급 | 체력 | 초기 자세 | 행동 |
|---|---|---|---|---|---|---|
| deulgae | 들개 | 1 | normal | 16–20 | gyeong | mul(gyeong,3,damage 6) · uleum(sul,1,momentum 1 self) |
| sanjeok | 산적 | 1 | normal | 22–26 | wai | hwidu(wai,3,damage 8) · gama(nae,2,block 6) |
| geolbang_baesin | 배신한 걸개 | 1 | normal | 18–22 | wai | chigi(wai,2,damage 7) · jeomhyeol(gyeong,2,damage 4·weak 1) |
| dokchung | 독충 무리 | 1 | normal | 14–18 | gyeong | mulgi(gyeong,2,damage 3 hits 2) · dok(sul,2,poison 3) |
| heukpung_jol | 흑풍채 졸개 | 1 | elite | 40–46 | wai | gwangpa(wai,3,damage 11) · jinyeol(nae,2,block 10·momentum 1 self) · dolgyeok(gyeong,1,damage 6 hits 2) |
| jeonjin_doin | 전진교 도인 | 2 | normal | 26–30 | nae | geomgi(nae,3,damage 10) · unsin(nae,2,block 9) |
| dohwado_haksa | 도화도 학사 | 2 | normal | 24–28 | gyeong | pungbo(gyeong,3,damage 7 hits 2) · hyeonhok(sul,2,weak 2) |
| geumgun_wibyeong | 금군 위병 | 2 | normal | 30–34 | wai | changjil(wai,3,damage 13) · bangjin(nae,2,block 12) |
| sasu_gaek | 사수 자객 | 2 | normal | 22–26 | gyeong | amgi(gyeong,3,damage 5 hits 3) · dokdo(sul,2,poison 4) |
| jeonjin_jangno | 전진 장로 | 2 | elite | 58–64 | nae | ilyanggong(nae,3,damage 16) · gyeoljin(nae,2,block 14·momentum 2 self) · pasa(wai,2,damage 9·naesang 2) |
| hwasan_geomgaek | 화산 검객 | 3 | normal | 34–38 | wai | maehwa(wai,3,damage 15) · geommak(nae,2,block 12) |
| myeonggyo_haenja | 명교 행자 | 3 | normal | 32–36 | nae | yeolhwa(nae,3,damage 13·poison 2) · hoche(nae,2,block 11) |
| seosang_musa | 서역 무사 | 3 | normal | 36–40 | gyeong | yeonhwan(gyeong,3,damage 7 hits 3) · doyak(sul,2,momentum 2 self) |
| gollyun_geomsa | 곤륜 검사 | 3 | normal | 30–34 | gyeong | sokgeom(gyeong,3,damage 8 hits 2) · hansol(nae,2,block 13) |
| sorim_bulgye | 소림 계율승 | 3 | elite | 72–80 | nae | geumgang(nae,3,damage 19) · budong(nae,2,block 20) · sajahu(wai,2,damage 12·vulnerable 2) |
| maechopung | 매초풍 | 1 | boss | 96–96 | gyeong | gujeum(gyeong,3,damage 9 hits 2) · baekgol(wai,2,damage 17·vulnerable 2) · yeonmu(sul,1,momentum 3 self) |
| guchunin | 구천인 | 2 | boss | 132–132 | wai | cheolgak(wai,3,damage 20) · yeoncheol(nae,2,block 18·momentum 2 self) · ssanggyeok(wai,2,damage 11 hits 2) |
| guyangbong | 구양봉 | 3 | boss | 178–178 | nae | hamamgong(nae,3,damage 24) · sadok(sul,2,poison 5·weak 2) · yeokhaeng(wai,2,damage 14 hits 2·naesang 2) |

표의 항목은 총 18개다. 막마다 일반 4종 · 정예 1종 · 보스 1종이며 (`4+1+1` × 3막), 검증기와 테스트가 이 구성을 강제한다.

### 문파 정의

```json
{
  "gaebang": {
    "id": "gaebang", "name": "개방", "hanja": "丐幇", "line": "wai",
    "maxHp": 80, "maxQi": 3,
    "startingDeck": [
      "byeokta", "byeokta", "byeokta", "byeokta", "byeokta",
      "bangsin", "bangsin", "bangsin", "bangsin", "chwibo"
    ],
    "startingRelic": "banjjok_bigeup"
  }
}
```

- [ ] **Step 1: JSON 스키마 예시를 보고 표 전체를 데이터로 옮긴다**

`src/data/cards_common.json`은 `CardDef[]` 배열이다. 두 항목의 완성된 예시:

```json
[
  {
    "id": "byeokta", "name": "벽타", "hanja": "劈打", "school": "common",
    "line": "wai", "cost": 1, "rarity": "basic", "target": "enemy",
    "text": "6 피해.",
    "effects": [{ "op": "damage", "value": 6 }],
    "upgrade": { "text": "9 피해.", "effects": [{ "op": "damage", "value": 9 }] }
  },
  {
    "id": "pagyeok", "name": "파격", "hanja": "破格", "school": "common",
    "line": "wai", "cost": 2, "rarity": "rare", "target": "enemy",
    "text": "10 피해. 파훼하면 취약 2.",
    "effects": [
      { "op": "damage", "value": 10 },
      { "op": "ifBreak", "then": [{ "op": "applyStatus", "status": "vulnerable", "value": 2 }] }
    ],
    "upgrade": {
      "text": "14 피해. 파훼하면 취약 3.",
      "effects": [
        { "op": "damage", "value": 14 },
        { "op": "ifBreak", "then": [{ "op": "applyStatus", "status": "vulnerable", "value": 3 }] }
      ]
    }
  }
]
```

표기 규칙: `소멸`은 `"exhaust": true`. `X self`는 `"target": "self"`. `target` 필드는 공격 카드가 `"enemy"`, 자기 대상이 `"self"`, 전체 공격이 `"allEnemies"`. `text`는 한국어 한 문장으로 새로 쓴다 — 원작 문장을 옮기지 않는다.

`src/data/relics.json`은 `RelicDef[]`, `src/data/enemies.json`은 `EnemyDef[]`, `src/data/schools.json`은 위 문파 정의 객체다.

- [ ] **Step 2: gamedata.ts 작성**

```ts
// src/engine/gamedata.ts
import cardsCommon from '../data/cards_common.json';
import cardsGaebang from '../data/cards_gaebang.json';
import enemies from '../data/enemies.json';
import relics from '../data/relics.json';
import schools from '../data/schools.json';
import { makeContentIndex, type ContentIndex } from './content';
import type { EnemyDef } from './enemies';
import type { RelicDef } from './relics';
import type { CardDef, Stance } from './types';

export interface SchoolDef {
  id: 'gaebang';
  name: string;
  hanja: string;
  line: Stance;
  maxHp: number;
  maxQi: number;
  startingDeck: string[];
  startingRelic: string;
}

export const SCHOOLS = schools as unknown as Record<'gaebang', SchoolDef>;

export const CONTENT: ContentIndex = makeContentIndex({
  cards: [...(cardsCommon as unknown as CardDef[]), ...(cardsGaebang as unknown as CardDef[])],
  enemies: enemies as unknown as EnemyDef[],
  relics: relics as unknown as RelicDef[],
});
```

- [ ] **Step 3: 실패하는 테스트 작성**

```ts
// tests/engine/gamedata.test.ts
import { describe, it, expect } from 'vitest';
import { CONTENT, SCHOOLS } from '../../src/engine/gamedata';
import { startCombat, applyAction, effectiveCard } from '../../src/engine/combat';

describe('콘텐츠 분량', () => {
  it('카드가 60장이다', () => {
    expect(CONTENT.cards()).toHaveLength(60);
  });

  it('공용 20장 · 개방 40장', () => {
    const cards = CONTENT.cards();
    expect(cards.filter((c) => c.school === 'common')).toHaveLength(20);
    expect(cards.filter((c) => c.school === 'gaebang')).toHaveLength(40);
  });

  it('기물이 20종이다', () => {
    expect(CONTENT.relics()).toHaveLength(20);
  });

  it('적이 18종이다', () => {
    const all = [1, 2, 3].flatMap((act) =>
      (['normal', 'elite', 'boss'] as const).flatMap((tier) => CONTENT.enemiesOf(act, tier)));
    expect(all).toHaveLength(18);
  });

  it('막마다 일반 적 4종·정예 1종·보스 1종이 있다', () => {
    for (const act of [1, 2, 3]) {
      expect(CONTENT.enemiesOf(act, 'normal').length).toBeGreaterThanOrEqual(4);
      expect(CONTENT.enemiesOf(act, 'elite')).toHaveLength(1);
      expect(CONTENT.enemiesOf(act, 'boss')).toHaveLength(1);
    }
  });
});

describe('데이터 무결성', () => {
  it('카드 id가 중복되지 않는다', () => {
    const ids = CONTENT.cards().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('모든 카드가 효과를 하나 이상 가진다', () => {
    for (const c of CONTENT.cards()) expect(c.effects.length).toBeGreaterThan(0);
  });

  it('코스트가 0~3이다', () => {
    for (const c of CONTENT.cards()) {
      expect(c.cost).toBeGreaterThanOrEqual(0);
      expect(c.cost).toBeLessThanOrEqual(3);
    }
  });

  it('기본 등급 카드는 시작 덱에만 쓰인다', () => {
    const basics = CONTENT.cards().filter((c) => c.rarity === 'basic').map((c) => c.id);
    for (const id of basics) expect(SCHOOLS.gaebang.startingDeck).toContain(id);
  });

  it('강화 정의가 있으면 원본과 다르다', () => {
    for (const c of CONTENT.cards()) {
      if (!c.upgrade) continue;
      expect(effectiveCard(c, true)).not.toEqual(effectiveCard(c, false));
    }
  });
});

describe('문파', () => {
  it('개방 시작 덱이 10장이고 전부 실재하는 카드다', () => {
    expect(SCHOOLS.gaebang.startingDeck).toHaveLength(10);
    for (const id of SCHOOLS.gaebang.startingDeck) expect(() => CONTENT.card(id)).not.toThrow();
  });

  it('시작 기물이 실재한다', () => {
    expect(() => CONTENT.relic(SCHOOLS.gaebang.startingRelic)).not.toThrow();
  });

  it('개방은 외공 기반에 체력 80이다', () => {
    expect(SCHOOLS.gaebang.line).toBe('wai');
    expect(SCHOOLS.gaebang.maxHp).toBe(80);
  });
});

describe('실전 구동', () => {
  it('모든 카드를 실제 전투에서 낼 수 있다', () => {
    for (const card of CONTENT.cards()) {
      let s = startCombat({
        seed: 99,
        player: { hp: 200, maxHp: 200, maxQi: 9, stance: 'wai', relics: [] },
        enemyIds: ['deulgae', 'sanjeok'],
        deck: [{ uid: 'x', defId: card.id, upgraded: false }],
      }, CONTENT);
      expect(() => {
        s = applyAction(s, { type: 'playCard', uid: 'x', targetUid: 'e0' }, CONTENT);
      }).not.toThrow();
    }
  });

  it('모든 적이 실제로 행동한다', () => {
    for (const act of [1, 2, 3]) {
      for (const tier of ['normal', 'elite', 'boss'] as const) {
        for (const def of CONTENT.enemiesOf(act, tier)) {
          let s = startCombat({
            seed: 5,
            player: { hp: 500, maxHp: 500, maxQi: 3, stance: 'wai', relics: [] },
            enemyIds: [def.id],
            deck: Array.from({ length: 10 }, (_, i) => ({ uid: `d${i}`, defId: 'bangsin', upgraded: false })),
          }, CONTENT);
          expect(() => { for (let t = 0; t < 6; t++) s = applyAction(s, { type: 'endTurn' }, CONTENT); }).not.toThrow();
        }
      }
    }
  });

  it('모든 기물을 지고 전투를 시작할 수 있다', () => {
    for (const relic of CONTENT.relics()) {
      expect(() => startCombat({
        seed: 3,
        player: { hp: 80, maxHp: 80, maxQi: 3, stance: 'wai', relics: [relic.id] },
        enemyIds: ['deulgae'],
        deck: Array.from({ length: 10 }, (_, i) => ({ uid: `d${i}`, defId: 'byeokta', upgraded: false })),
      }, CONTENT)).not.toThrow();
    }
  });
});
```

- [ ] **Step 4: 테스트 실패 확인 후 JSON 5개 파일을 표대로 작성**

Run: `npx vitest run tests/engine/gamedata.test.ts`
Expected: 처음에는 FAIL. JSON을 다 채우면 PASS.

- [ ] **Step 5: 검증기 작성**

```js
// tools/validate_data.mjs
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));

const cards = [...read('cards_common.json'), ...read('cards_gaebang.json')];
const relics = read('relics.json');
const enemies = read('enemies.json');
const schools = read('schools.json');

const OPS = new Set(['damage', 'block', 'draw', 'gainQi', 'heal', 'applyStatus',
  'ifCombo', 'ifBreak', 'keepBlock', 'loseBlock', 'counterStance']);
const STATUSES = new Set(['poison', 'naesang', 'vulnerable', 'weak', 'momentum', 'afterimage']);
const LINES = new Set(['wai', 'gyeong', 'nae', 'sul']);
const RARITIES = new Set(['basic', 'common', 'rare', 'ultra']);
const MOD_KEYS = new Set(['maxHp', 'maxQi', 'handSize', 'startBlock', 'comboThreshold']);
const HOOKS = new Set(['onCombatStart', 'onTurnStart', 'onKill', 'onCombatEnd']);

const errors = [];
const fail = (msg) => errors.push(msg);

function checkEffects(where, atoms) {
  for (const a of atoms) {
    if (!OPS.has(a.op)) fail(`${where}: 알 수 없는 효과 ${a.op}`);
    if (a.op === 'applyStatus' && !STATUSES.has(a.status)) fail(`${where}: 알 수 없는 상태 ${a.status}`);
    if (a.then) checkEffects(where, a.then);
  }
}

const cardIds = new Set();
for (const c of cards) {
  if (cardIds.has(c.id)) fail(`카드 id 중복: ${c.id}`);
  cardIds.add(c.id);
  for (const key of ['name', 'hanja', 'school', 'line', 'rarity', 'target', 'text']) {
    if (!c[key]) fail(`${c.id}: ${key} 누락`);
  }
  if (!LINES.has(c.line)) fail(`${c.id}: 잘못된 계열 ${c.line}`);
  if (!RARITIES.has(c.rarity)) fail(`${c.id}: 잘못된 등급 ${c.rarity}`);
  if (!(c.cost >= 0 && c.cost <= 3)) fail(`${c.id}: 코스트 범위 밖 ${c.cost}`);
  if (!Array.isArray(c.effects) || c.effects.length === 0) fail(`${c.id}: 효과 없음`);
  checkEffects(c.id, c.effects ?? []);
  if (c.upgrade?.effects) checkEffects(`${c.id}+`, c.upgrade.effects);
}

const relicIds = new Set();
for (const r of relics) {
  if (relicIds.has(r.id)) fail(`기물 id 중복: ${r.id}`);
  relicIds.add(r.id);
  if (!RARITIES.has(r.rarity)) fail(`${r.id}: 잘못된 등급`);
  if (!r.text) fail(`${r.id}: 설명 누락`);
  for (const k of Object.keys(r.mods ?? {})) if (!MOD_KEYS.has(k)) fail(`${r.id}: 알 수 없는 보정 ${k}`);
  for (const t of r.triggers ?? []) {
    if (!HOOKS.has(t.hook)) fail(`${r.id}: 알 수 없는 훅 ${t.hook}`);
    checkEffects(r.id, t.effects ?? []);
  }
}

const enemyIds = new Set();
for (const e of enemies) {
  if (enemyIds.has(e.id)) fail(`적 id 중복: ${e.id}`);
  enemyIds.add(e.id);
  if (!Array.isArray(e.hp) || e.hp.length !== 2 || e.hp[0] > e.hp[1]) fail(`${e.id}: 체력 범위 이상`);
  if (!['normal', 'elite', 'boss'].includes(e.tier)) fail(`${e.id}: 잘못된 등급`);
  if (![1, 2, 3].includes(e.act)) fail(`${e.id}: 잘못된 막`);
  if (!e.actions?.length) fail(`${e.id}: 행동 없음`);
  for (const a of e.actions ?? []) {
    if (!LINES.has(a.line)) fail(`${e.id}/${a.id}: 잘못된 계열`);
    if (!(a.weight > 0)) fail(`${e.id}/${a.id}: 가중치는 양수여야 한다`);
    if (!a.label) fail(`${e.id}/${a.id}: 의도 문구 누락`);
    checkEffects(`${e.id}/${a.id}`, a.effects ?? []);
  }
}

for (const [id, s] of Object.entries(schools)) {
  if (s.startingDeck.length !== 10) fail(`${id}: 시작 덱은 10장이어야 한다`);
  for (const c of s.startingDeck) if (!cardIds.has(c)) fail(`${id}: 없는 시작 카드 ${c}`);
  if (!relicIds.has(s.startingRelic)) fail(`${id}: 없는 시작 기물 ${s.startingRelic}`);
}

for (const act of [1, 2, 3]) {
  const of = (tier) => enemies.filter((e) => e.act === act && e.tier === tier).length;
  if (of('normal') < 4) fail(`${act}막: 일반 적이 4종 미만`);
  if (of('elite') < 1) fail(`${act}막: 정예 없음`);
  if (of('boss') < 1) fail(`${act}막: 보스 없음`);
}

if (errors.length) {
  console.error(`데이터 검증 실패 ${errors.length}건:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`데이터 검증 통과 — 카드 ${cards.length} · 기물 ${relics.length} · 적 ${enemies.length}`);
```

- [ ] **Step 6: 전부 통과 확인**

Run: `npm run validate && npx vitest run && npm run typecheck`
Expected: 검증 통과 메시지 + 전체 테스트 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/data tools/validate_data.mjs src/engine/gamedata.ts tests/engine/gamedata.test.ts
git commit -m "콘텐츠: 초식 60장·기물 20종·적 17종과 데이터 검증기"
```

---

## Task 11: 노드맵 생성

P1의 한 막은 6층 8노드다. 층 너비는 `[1, 2, 2, 1, 1, 1]`이며 0층은 항상 격전, 4층은 항상 객잔, 5층은 항상 관문이다.

**Files:**
- Create: `src/engine/map.ts`
- Test: `tests/engine/map.test.ts`

**Interfaces:**
- Produces:
  - `type NodeType = 'battle' | 'elite' | 'rest' | 'shop' | 'boss'`
  - `interface MapNode { id: string; layer: number; col: number; type: NodeType; next: string[] }`
  - `interface GameMap { act: number; layers: string[][]; nodes: Record<string, MapNode> }`
  - `const LAYER_WIDTHS: readonly number[]`
  - `function generateMap(rng: Rng, act: number): GameMap`
  - `function nodeAt(map: GameMap, id: string): MapNode`

중간 층 가중치는 격전 65 · 정예 15 · 객잔 12 · 장터 8이다. 같은 타입이 한 경로에서 3연속으로 나오지 않게 재추첨한다. 모든 노드는 진입 간선을 최소 1개 가진다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/engine/map.test.ts
import { describe, it, expect } from 'vitest';
import { generateMap, nodeAt, LAYER_WIDTHS } from '../../src/engine/map';
import { Rng, seedFrom } from '../../src/engine/rng';
import type { GameMap } from '../../src/engine/map';

function build(seed: string, act = 1): GameMap {
  return generateMap(new Rng(seedFrom(seed)), act);
}

const SEEDS = Array.from({ length: 60 }, (_, i) => `맵${i}`);

describe('구조', () => {
  it('층 너비가 정의대로다', () => {
    expect([...LAYER_WIDTHS]).toEqual([1, 2, 2, 1, 1, 1]);
  });

  it('노드가 8개다', () => {
    for (const s of SEEDS) expect(Object.keys(build(s).nodes)).toHaveLength(8);
  });

  it('첫 층은 격전, 마지막 앞은 객잔, 마지막은 관문이다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      expect(nodeAt(m, m.layers[0]![0]!).type).toBe('battle');
      expect(nodeAt(m, m.layers[4]![0]!).type).toBe('rest');
      expect(nodeAt(m, m.layers[5]![0]!).type).toBe('boss');
    }
  });

  it('관문은 각 막에 하나뿐이다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      expect(Object.values(m.nodes).filter((n) => n.type === 'boss')).toHaveLength(1);
    }
  });

  it('막 번호가 보존된다', () => {
    expect(build('x', 3).act).toBe(3);
  });
});

describe('간선', () => {
  it('마지막 층을 뺀 모든 노드가 다음 노드를 가진다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      for (const n of Object.values(m.nodes)) {
        if (n.layer === LAYER_WIDTHS.length - 1) expect(n.next).toHaveLength(0);
        else expect(n.next.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('간선은 바로 다음 층으로만 간다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      for (const n of Object.values(m.nodes)) {
        for (const id of n.next) expect(nodeAt(m, id).layer).toBe(n.layer + 1);
      }
    }
  });

  it('첫 층에서 관문까지 도달 가능하다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      const seen = new Set<string>();
      const stack = [m.layers[0]![0]!];
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        stack.push(...nodeAt(m, id).next);
      }
      expect(seen.has(m.layers[5]![0]!)).toBe(true);
    }
  });

  it('모든 노드가 도달 가능하다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      const incoming = new Set(Object.values(m.nodes).flatMap((n) => n.next));
      for (const n of Object.values(m.nodes)) {
        if (n.layer > 0) expect(incoming.has(n.id)).toBe(true);
      }
    }
  });
});

describe('타입 분포', () => {
  it('같은 타입이 한 경로에서 3연속 나오지 않는다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      const walk = (id: string, trail: string[]): void => {
        const n = nodeAt(m, id);
        const next = [...trail, n.type];
        const k = next.length;
        if (k >= 3) expect(new Set(next.slice(k - 3)).size).toBeGreaterThan(1);
        for (const child of n.next) walk(child, next);
      };
      walk(m.layers[0]![0]!, []);
    }
  });

  it('중간 층은 다섯 타입 중 관문이 아닌 것만 쓴다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      for (const layer of [1, 2, 3]) {
        for (const id of m.layers[layer]!) {
          expect(['battle', 'elite', 'rest', 'shop']).toContain(nodeAt(m, id).type);
        }
      }
    }
  });

  it('60개 시드에서 정예와 장터가 모두 등장한다', () => {
    const types = new Set(SEEDS.flatMap((s) => Object.values(build(s).nodes).map((n) => n.type)));
    expect(types.has('elite')).toBe(true);
    expect(types.has('shop')).toBe(true);
  });
});

describe('결정성', () => {
  it('같은 시드는 같은 맵을 만든다', () => {
    expect(build('동일')).toEqual(build('동일'));
  });

  it('다른 시드는 대체로 다른 맵을 만든다', () => {
    const shapes = new Set(SEEDS.map((s) => JSON.stringify(build(s))));
    expect(shapes.size).toBeGreaterThan(30);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/engine/map.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/map"`

- [ ] **Step 3: 구현**

```ts
// src/engine/map.ts
import type { Rng } from './rng';

export type NodeType = 'battle' | 'elite' | 'rest' | 'shop' | 'boss';

export interface MapNode {
  id: string;
  layer: number;
  col: number;
  type: NodeType;
  next: string[];
}

export interface GameMap {
  act: number;
  layers: string[][];
  nodes: Record<string, MapNode>;
}

export const LAYER_WIDTHS = [1, 2, 2, 1, 1, 1] as const;

const MIDDLE_WEIGHTS: ReadonlyArray<readonly [NodeType, number]> = [
  ['battle', 65], ['elite', 15], ['rest', 12], ['shop', 8],
];

export function nodeAt(map: GameMap, id: string): MapNode {
  const node = map.nodes[id];
  if (!node) throw new Error(`알 수 없는 노드: ${id}`);
  return node;
}

/** 이 노드에 이 타입을 두면 어떤 부모 경로에서든 3연속이 되는가. */
function wouldTriple(
  type: NodeType, layer: number, parents: MapNode[], nodes: Record<string, MapNode>,
): boolean {
  if (layer < 2) return false;
  for (const parent of parents) {
    if (parent.type !== type) continue;
    const grandparents = Object.values(nodes).filter((n) => n.next.includes(parent.id));
    if (grandparents.some((g) => g.type === type)) return true;
  }
  return false;
}

export function generateMap(rng: Rng, act: number): GameMap {
  const nodes: Record<string, MapNode> = {};
  const layers: string[][] = [];

  for (let layer = 0; layer < LAYER_WIDTHS.length; layer++) {
    const width = LAYER_WIDTHS[layer]!;
    const ids: string[] = [];
    for (let col = 0; col < width; col++) {
      ids.push(`a${act}-${layer}-${col}`);
    }
    layers.push(ids);
  }

  // 간선을 먼저 놓는다. 각 노드는 다음 층에서 1~2개를 고르고, 다음 층은 전부 부모를 갖는다.
  for (let layer = 0; layer < layers.length - 1; layer++) {
    const current = layers[layer]!;
    const next = layers[layer + 1]!;
    const linked = new Set<string>();

    for (let i = 0; i < current.length; i++) {
      const span = next.length === 1 ? 1 : rng.range(1, Math.min(2, next.length));
      const start = next.length === 1 ? 0 : Math.min(i, next.length - span);
      const chosen = next.slice(start, start + span);
      for (const id of chosen) linked.add(id);
      nodes[current[i]!] = {
        id: current[i]!, layer, col: i, type: 'battle', next: [...chosen],
      };
    }

    for (const id of next) {
      if (linked.has(id)) continue;
      const parentId = rng.pick(current);
      const parent = nodes[parentId]!;
      parent.next = [...parent.next, id];
    }
  }

  const lastLayer = layers.length - 1;
  layers[lastLayer]!.forEach((id, col) => {
    nodes[id] = { id, layer: lastLayer, col, type: 'boss', next: [] };
  });

  // 타입을 정한다. 고정 층 먼저, 중간 층은 3연속을 피해 추첨.
  nodes[layers[0]![0]!]!.type = 'battle';
  nodes[layers[4]![0]!]!.type = 'rest';

  for (const layer of [1, 2, 3]) {
    for (const id of layers[layer]!) {
      const node = nodes[id]!;
      const parents = Object.values(nodes).filter((n) => n.next.includes(id));
      const safe = (t: NodeType): boolean => !wouldTriple(t, layer, parents, nodes);

      // 노드마다 정확히 한 번만 추첨한다. 3연속이 되면 안전한 타입 중 첫 번째로 대체한다.
      // 후보가 넷이고 앞선 경로는 최대 둘이므로 안전한 타입은 반드시 존재한다.
      let type = rng.weighted(MIDDLE_WEIGHTS);
      if (!safe(type)) {
        type = (['battle', 'elite', 'rest', 'shop'] as NodeType[]).find(safe) ?? 'battle';
      }
      node.type = type;
    }
  }

  return { act, layers, nodes };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/engine/map.test.ts`
Expected: PASS — 12 tests

- [ ] **Step 5: 커밋**

```bash
git add src/engine/map.ts tests/engine/map.test.ts
git commit -m "엔진: 노드맵 생성. 도달성과 3연속 금지를 테스트로 보장"
```

---

## Task 12: 런 진행

**Files:**
- Create: `src/engine/run.ts`
- Test: `tests/engine/run.test.ts`

**Interfaces:**
- Produces:
  - `type RunScreen = 'map' | 'combat' | 'reward' | 'rest' | 'shop' | 'result'`
  - `interface ShopItem { kind: 'card' | 'relic' | 'remove'; id: string; price: number }`
  - `interface RewardState { gold: number; cards: string[]; relic: string | null }`
  - `interface RunState { version: 1; seedText: string; school: 'gaebang'; act: number; map: GameMap; currentNodeId: string | null; screen: RunScreen; player: { hp: number; maxHp: number; gold: number; deck: CardInstance[]; relics: string[] }; combat: CombatState | null; reward: RewardState | null; shop: ShopItem[] | null; rngState: number; nextUid: number; result: 'ongoing' | 'victory' | 'defeat'; stats: { floors: number; kills: number; elites: number } }`
  - `type RunAction = { type: 'chooseNode'; nodeId: string } | { type: 'combat'; action: CombatAction } | { type: 'takeCard'; cardId: string | null } | { type: 'takeRelic' } | { type: 'rest'; choice: 'heal' } | { type: 'rest'; choice: 'upgrade'; uid: string } | { type: 'buy'; index: number } | { type: 'leave' }`
  - `function startRun(seedText: string, content: ContentIndex): RunState`
  - `function applyRunAction(run: RunState, action: RunAction, content: ContentIndex): RunState`
  - `function availableNodes(run: RunState): string[]`

규칙: 격전 보상은 엽전 `10~20`과 초식 3장 중 1택, 정예는 여기에 기물 1개, 관문은 엽전 `40~60`·초식 3장 중 1택·기물 1개다. 객잔은 최대 체력 30% 회복 또는 초식 1장 강화. 장터는 초식 3·기물 1·카드 제거 1을 판다 (초식 `45~70`, 기물 `140~180`, 제거 `70`). 관문을 이기면 다음 막으로 넘어가고, 3막 관문을 이기면 `result: 'victory'`가 된다. 체력이 0이 되면 `'defeat'`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/engine/run.test.ts
import { describe, it, expect } from 'vitest';
import { startRun, applyRunAction, availableNodes } from '../../src/engine/run';
import { CONTENT } from '../../src/engine/gamedata';
import { nodeAt } from '../../src/engine/map';
import type { RunState } from '../../src/engine/run';

function run0(seed = '개방행'): RunState {
  return startRun(seed, CONTENT);
}

/** 전투가 끝날 때까지 턴만 넘긴다. */
function grind(run: RunState, maxTurns = 60): RunState {
  let s = run;
  for (let i = 0; i < maxTurns && s.screen === 'combat'; i++) {
    s = applyRunAction(s, { type: 'combat', action: { type: 'endTurn' } }, CONTENT);
  }
  return s;
}

describe('런 시작', () => {
  it('1막 맵과 개방 시작 덱으로 시작한다', () => {
    const r = run0();
    expect(r.act).toBe(1);
    expect(r.screen).toBe('map');
    expect(r.player.deck).toHaveLength(10);
    expect(r.player.maxHp).toBe(80);
    expect(r.player.hp).toBe(80);
    expect(r.result).toBe('ongoing');
  });

  it('시작 기물을 가지고 시작한다', () => {
    expect(run0().player.relics).toEqual(['banjjok_bigeup']);
  });

  it('덱의 카드마다 uid가 다르다', () => {
    const uids = run0().player.deck.map((c) => c.uid);
    expect(new Set(uids).size).toBe(uids.length);
  });

  it('같은 시드는 같은 런을 만든다', () => {
    expect(run0('고정')).toEqual(run0('고정'));
  });

  it('처음 고를 수 있는 노드는 0층 하나뿐이다', () => {
    const r = run0();
    expect(availableNodes(r)).toEqual([r.map.layers[0]![0]!]);
  });
});

describe('노드 진입', () => {
  it('격전 노드에 들어가면 전투가 시작된다', () => {
    const r = applyRunAction(run0(), { type: 'chooseNode', nodeId: run0().map.layers[0]![0]! }, CONTENT);
    expect(r.screen).toBe('combat');
    expect(r.combat).not.toBeNull();
    expect(r.combat!.enemies.length).toBeGreaterThan(0);
  });

  it('갈 수 없는 노드는 무시된다', () => {
    const r = run0();
    const far = r.map.layers[3]![0]!;
    expect(applyRunAction(r, { type: 'chooseNode', nodeId: far }, CONTENT)).toBe(r);
  });

  it('전투에 이기면 보상 화면으로 간다', () => {
    let r = applyRunAction(run0(), { type: 'chooseNode', nodeId: run0().map.layers[0]![0]! }, CONTENT);
    r = { ...r, combat: { ...r.combat!, enemies: r.combat!.enemies.map((e) => ({ ...e, hp: 1 })) } };
    r = applyRunAction(r, { type: 'combat', action: { type: 'playCard', uid: r.combat!.hand[0]!.uid, targetUid: 'e0' } }, CONTENT);
    r = grind(r);
    expect(r.screen).toBe('reward');
    expect(r.reward!.gold).toBeGreaterThan(0);
    expect(r.reward!.cards).toHaveLength(3);
  });

  it('전투에 지면 패배로 끝난다', () => {
    let r = applyRunAction(run0(), { type: 'chooseNode', nodeId: run0().map.layers[0]![0]! }, CONTENT);
    r = { ...r, combat: { ...r.combat!, player: { ...r.combat!.player, hp: 1 } } };
    r = grind(r);
    expect(r.result).toBe('defeat');
    expect(r.screen).toBe('result');
  });
});

describe('보상', () => {
  function toReward(): RunState {
    let r = applyRunAction(run0(), { type: 'chooseNode', nodeId: run0().map.layers[0]![0]! }, CONTENT);
    r = { ...r, combat: { ...r.combat!, enemies: r.combat!.enemies.map((e) => ({ ...e, hp: 0 })) } };
    return applyRunAction(r, { type: 'combat', action: { type: 'endTurn' } }, CONTENT);
  }

  it('보상 초식 3장은 서로 다르고 기본 등급이 아니다', () => {
    const r = toReward();
    expect(new Set(r.reward!.cards).size).toBe(3);
    for (const id of r.reward!.cards) expect(CONTENT.card(id).rarity).not.toBe('basic');
  });

  it('초식을 고르면 덱에 들어가고 맵으로 돌아간다', () => {
    const r0 = toReward();
    const pick = r0.reward!.cards[0]!;
    const r = applyRunAction(r0, { type: 'takeCard', cardId: pick }, CONTENT);
    expect(r.player.deck).toHaveLength(11);
    expect(r.player.deck.some((c) => c.defId === pick)).toBe(true);
    expect(r.screen).toBe('map');
  });

  it('넘기면 덱이 그대로다', () => {
    const r = applyRunAction(toReward(), { type: 'takeCard', cardId: null }, CONTENT);
    expect(r.player.deck).toHaveLength(10);
    expect(r.screen).toBe('map');
  });

  it('엽전이 지급된다', () => {
    const r0 = toReward();
    const r = applyRunAction(r0, { type: 'takeCard', cardId: null }, CONTENT);
    expect(r.player.gold).toBe(r0.reward!.gold);
  });
});

describe('객잔', () => {
  function toRest(): RunState {
    const r = run0();
    const restId = r.map.layers[4]![0]!;
    return { ...r, currentNodeId: restId, screen: 'rest', player: { ...r.player, hp: 40 } };
  }

  it('휴식은 최대 체력의 30%를 회복한다', () => {
    const r = applyRunAction(toRest(), { type: 'rest', choice: 'heal' }, CONTENT);
    expect(r.player.hp).toBe(64);
    expect(r.screen).toBe('map');
  });

  it('회복은 최대 체력을 넘지 않는다', () => {
    const base = toRest();
    const r = applyRunAction({ ...base, player: { ...base.player, hp: 78 } }, { type: 'rest', choice: 'heal' }, CONTENT);
    expect(r.player.hp).toBe(80);
  });

  it('수련은 초식 1장을 강화한다', () => {
    const base = toRest();
    const uid = base.player.deck.find((c) => CONTENT.card(c.defId).upgrade)!.uid;
    const r = applyRunAction(base, { type: 'rest', choice: 'upgrade', uid }, CONTENT);
    expect(r.player.deck.find((c) => c.uid === uid)!.upgraded).toBe(true);
    expect(r.screen).toBe('map');
  });

  it('이미 강화된 카드는 다시 강화되지 않는다', () => {
    const base = toRest();
    const uid = base.player.deck[0]!.uid;
    const once = applyRunAction(base, { type: 'rest', choice: 'upgrade', uid }, CONTENT);
    expect(applyRunAction({ ...once, screen: 'rest' }, { type: 'rest', choice: 'upgrade', uid }, CONTENT).screen).toBe('rest');
  });
});

describe('장터', () => {
  it('장터 노드에 들어가면 초식 3·기물 1·제거 1이 진열된다', () => {
    for (let i = 0; i < 300; i++) {
      const r = startRun(`장터${i}`, CONTENT);
      const first = r.map.layers[0]![0]!;
      const shopId = nodeAt(r.map, first).next.find((id) => nodeAt(r.map, id).type === 'shop');
      if (!shopId) continue;

      const s = applyRunAction({ ...r, currentNodeId: first }, { type: 'chooseNode', nodeId: shopId }, CONTENT);
      expect(s.screen).toBe('shop');
      expect(s.shop!.filter((x) => x.kind === 'card')).toHaveLength(3);
      expect(s.shop!.filter((x) => x.kind === 'relic')).toHaveLength(1);
      expect(s.shop!.filter((x) => x.kind === 'remove')).toHaveLength(1);
      return;
    }
    throw new Error('300개 시드에서 1층 장터를 찾지 못했다');
  });

  it('구매하면 엽전이 줄고 물건이 사라진다', () => {
    const r = run0();
    const shop = [
      { kind: 'card' as const, id: 'gangsu', price: 50 },
      { kind: 'relic' as const, id: 'geungol', price: 150 },
    ];
    const s: RunState = { ...r, screen: 'shop', shop, player: { ...r.player, gold: 300 } };
    const after = applyRunAction(s, { type: 'buy', index: 0 }, CONTENT);
    expect(after.player.gold).toBe(250);
    expect(after.shop).toHaveLength(1);
    expect(after.player.deck).toHaveLength(11);
  });

  it('엽전이 모자라면 살 수 없다', () => {
    const r = run0();
    const s: RunState = {
      ...r, screen: 'shop', player: { ...r.player, gold: 10 },
      shop: [{ kind: 'card', id: 'gangsu', price: 50 }],
    };
    expect(applyRunAction(s, { type: 'buy', index: 0 }, CONTENT)).toBe(s);
  });

  it('나가면 맵으로 돌아간다', () => {
    const r = run0();
    const s: RunState = { ...r, screen: 'shop', shop: [] };
    expect(applyRunAction(s, { type: 'leave' }, CONTENT).screen).toBe('map');
  });
});

describe('막 진행', () => {
  it('관문을 이기면 다음 막으로 넘어간다', () => {
    const r = run0();
    const bossId = r.map.layers[5]![0]!;
    let s: RunState = { ...r, currentNodeId: bossId, screen: 'reward', reward: { gold: 50, cards: [], relic: null } };
    s = applyRunAction(s, { type: 'takeCard', cardId: null }, CONTENT);
    expect(s.act).toBe(2);
    expect(s.currentNodeId).toBeNull();
    expect(nodeAt(s.map, s.map.layers[0]![0]!).type).toBe('battle');
  });

  it('3막 관문을 이기면 완주다', () => {
    const r = run0();
    const s0: RunState = {
      ...r, act: 3, currentNodeId: r.map.layers[5]![0]!,
      screen: 'reward', reward: { gold: 50, cards: [], relic: null },
    };
    const s = applyRunAction(s0, { type: 'takeCard', cardId: null }, CONTENT);
    expect(s.result).toBe('victory');
    expect(s.screen).toBe('result');
  });
});

describe('결정성', () => {
  it('같은 시드에 같은 액션 열은 같은 결과를 낸다', () => {
    const play = (): RunState => {
      let s = startRun('재현', CONTENT);
      s = applyRunAction(s, { type: 'chooseNode', nodeId: s.map.layers[0]![0]! }, CONTENT);
      return grind(s);
    };
    expect(play()).toEqual(play());
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/engine/run.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/run"`

- [ ] **Step 3: 구현**

```ts
// src/engine/run.ts
import { applyAction, startCombat, type CombatAction } from './combat';
import type { ContentIndex } from './content';
import { SCHOOLS } from './gamedata';
import { generateMap, nodeAt, type GameMap, type NodeType } from './map';
import { triggerRelics } from './relics';
import { Rng, seedFrom } from './rng';
import type { CardInstance, CombatState, Rarity } from './types';

export type RunScreen = 'map' | 'combat' | 'reward' | 'rest' | 'shop' | 'result';

export interface ShopItem {
  kind: 'card' | 'relic' | 'remove';
  id: string;
  price: number;
}

export interface RewardState {
  gold: number;
  cards: string[];
  relic: string | null;
}

export interface RunState {
  version: 1;
  seedText: string;
  school: 'gaebang';
  act: number;
  map: GameMap;
  currentNodeId: string | null;
  screen: RunScreen;
  player: {
    hp: number;
    maxHp: number;
    gold: number;
    deck: CardInstance[];
    relics: string[];
  };
  combat: CombatState | null;
  reward: RewardState | null;
  shop: ShopItem[] | null;
  rngState: number;
  nextUid: number;
  result: 'ongoing' | 'victory' | 'defeat';
  stats: { floors: number; kills: number; elites: number };
}

export type RunAction =
  | { type: 'chooseNode'; nodeId: string }
  | { type: 'combat'; action: CombatAction }
  | { type: 'takeCard'; cardId: string | null }
  | { type: 'rest'; choice: 'heal' }
  | { type: 'rest'; choice: 'upgrade'; uid: string }
  | { type: 'buy'; index: number }
  | { type: 'leave' };

const REST_HEAL_RATIO = 0.3;

export function startRun(seedText: string, content: ContentIndex): RunState {
  const school = SCHOOLS.gaebang;
  const rng = new Rng(seedFrom(seedText));
  const map = generateMap(rng, 1);

  let nextUid = 0;
  const deck = school.startingDeck.map((defId) => ({
    uid: `c${nextUid++}`, defId, upgraded: false,
  }));

  return {
    version: 1,
    seedText,
    school: 'gaebang',
    act: 1,
    map,
    currentNodeId: null,
    screen: 'map',
    player: {
      hp: school.maxHp,
      maxHp: school.maxHp,
      gold: 0,
      deck,
      relics: [school.startingRelic],
    },
    combat: null,
    reward: null,
    shop: null,
    rngState: rng.state,
    nextUid,
    result: 'ongoing',
    stats: { floors: 0, kills: 0, elites: 0 },
  };
}

export function availableNodes(run: RunState): string[] {
  if (run.screen !== 'map') return [];
  if (run.currentNodeId === null) return [...run.map.layers[0]!];
  return [...nodeAt(run.map, run.currentNodeId).next];
}

function pickEnemies(rng: Rng, act: number, type: NodeType, content: ContentIndex): string[] {
  if (type === 'boss') return [content.enemiesOf(act, 'boss')[0]!.id];
  if (type === 'elite') return [content.enemiesOf(act, 'elite')[0]!.id];
  const pool = content.enemiesOf(act, 'normal');
  const count = rng.weighted([[1, 40], [2, 45], [3, 15]] as const);
  return Array.from({ length: count }, () => rng.pick(pool).id);
}

function rewardCards(rng: Rng, content: ContentIndex, school: 'gaebang'): string[] {
  const pool = content.cards().filter(
    (c) => c.rarity !== 'basic' && (c.school === 'common' || c.school === school),
  );
  const picked: string[] = [];
  const weights: Record<Rarity, number> = { basic: 0, common: 70, rare: 25, ultra: 5 };
  while (picked.length < 3) {
    const candidates = pool.filter((c) => !picked.includes(c.id));
    const chosen = rng.weighted(candidates.map((c) => [c.id, weights[c.rarity]] as const));
    picked.push(chosen);
  }
  return picked;
}

function pickRelic(rng: Rng, owned: string[], content: ContentIndex): string | null {
  const pool = content.relics().filter((r) => !owned.includes(r.id));
  return pool.length === 0 ? null : rng.pick(pool).id;
}

function makeShop(rng: Rng, run: RunState, content: ContentIndex): ShopItem[] {
  const cards = rewardCards(rng, content, run.school);
  const items: ShopItem[] = cards.map((id) => ({
    kind: 'card' as const, id, price: rng.range(45, 70),
  }));
  const relic = pickRelic(rng, run.player.relics, content);
  if (relic) items.push({ kind: 'relic', id: relic, price: rng.range(140, 180) });
  items.push({ kind: 'remove', id: 'remove', price: 70 });
  return items;
}

function enterNode(run: RunState, nodeId: string, content: ContentIndex): RunState {
  const node = nodeAt(run.map, nodeId);
  const rng = new Rng(run.rngState);
  const base: RunState = {
    ...run,
    currentNodeId: nodeId,
    stats: { ...run.stats, floors: run.stats.floors + 1 },
  };

  if (node.type === 'rest') {
    return { ...base, screen: 'rest', rngState: rng.state };
  }
  if (node.type === 'shop') {
    const shop = makeShop(rng, base, content);
    return { ...base, screen: 'shop', shop, rngState: rng.state };
  }

  const school = SCHOOLS[run.school];
  const combat = startCombat({
    seed: rng.int(0x7fffffff),
    player: {
      hp: run.player.hp,
      maxHp: run.player.maxHp,
      maxQi: school.maxQi,
      stance: school.line,
      relics: run.player.relics,
    },
    enemyIds: pickEnemies(rng, run.act, node.type, content),
    deck: run.player.deck,
  }, content);

  return { ...base, screen: 'combat', combat, rngState: rng.state };
}

function finishCombat(run: RunState, combat: CombatState, content: ContentIndex): RunState {
  const node = nodeAt(run.map, run.currentNodeId!);

  if (combat.phase === 'lost') {
    return {
      ...run, combat: null, screen: 'result', result: 'defeat',
      player: { ...run.player, hp: 0 },
    };
  }

  const settled = triggerRelics(combat, 'onCombatEnd', content);
  const rng = new Rng(run.rngState);
  const goldRange: [number, number] =
    node.type === 'boss' ? [40, 60] : node.type === 'elite' ? [25, 35] : [10, 20];

  const reward: RewardState = {
    gold: rng.range(goldRange[0], goldRange[1]),
    cards: rewardCards(rng, content, run.school),
    relic: node.type === 'elite' || node.type === 'boss'
      ? pickRelic(rng, run.player.relics, content)
      : null,
  };

  return {
    ...run,
    combat: null,
    screen: 'reward',
    reward,
    rngState: rng.state,
    player: { ...run.player, hp: settled.player.hp },
    stats: {
      ...run.stats,
      kills: run.stats.kills + 1,
      elites: run.stats.elites + (node.type === 'elite' ? 1 : 0),
    },
  };
}

function leaveReward(run: RunState, cardId: string | null, content: ContentIndex): RunState {
  const reward = run.reward;
  if (!reward) return run;

  let nextUid = run.nextUid;
  const deck = cardId
    ? [...run.player.deck, { uid: `c${nextUid++}`, defId: cardId, upgraded: false }]
    : run.player.deck;

  const relics = reward.relic ? [...run.player.relics, reward.relic] : run.player.relics;
  const grown = {
    ...run,
    nextUid,
    reward: null,
    player: { ...run.player, gold: run.player.gold + reward.gold, deck, relics },
  };

  const node = nodeAt(run.map, run.currentNodeId!);
  if (node.type !== 'boss') return { ...grown, screen: 'map' };

  if (run.act >= 3) return { ...grown, screen: 'result', result: 'victory' };

  const rng = new Rng(grown.rngState);
  return {
    ...grown,
    act: run.act + 1,
    map: generateMap(rng, run.act + 1),
    currentNodeId: null,
    screen: 'map',
    rngState: rng.state,
  };
}

export function applyRunAction(
  run: RunState, action: RunAction, content: ContentIndex,
): RunState {
  if (run.result !== 'ongoing') return run;

  switch (action.type) {
    case 'chooseNode': {
      if (run.screen !== 'map') return run;
      if (!availableNodes(run).includes(action.nodeId)) return run;
      return enterNode(run, action.nodeId, content);
    }

    case 'combat': {
      if (run.screen !== 'combat' || !run.combat) return run;
      const combat = applyAction(run.combat, action.action, content);
      if (combat.phase === 'won' || combat.phase === 'lost') {
        return finishCombat(run, combat, content);
      }
      return { ...run, combat };
    }

    case 'takeCard': {
      if (run.screen !== 'reward') return run;
      if (action.cardId !== null && !run.reward?.cards.includes(action.cardId)) return run;
      return leaveReward(run, action.cardId, content);
    }

    case 'rest': {
      if (run.screen !== 'rest') return run;
      if (action.choice === 'heal') {
        const heal = Math.floor(run.player.maxHp * REST_HEAL_RATIO);
        return {
          ...run, screen: 'map',
          player: { ...run.player, hp: Math.min(run.player.maxHp, run.player.hp + heal) },
        };
      }
      const card = run.player.deck.find((c) => c.uid === action.uid);
      if (!card || card.upgraded || !content.card(card.defId).upgrade) return run;
      return {
        ...run, screen: 'map',
        player: {
          ...run.player,
          deck: run.player.deck.map((c) => (c.uid === action.uid ? { ...c, upgraded: true } : c)),
        },
      };
    }

    case 'buy': {
      if (run.screen !== 'shop' || !run.shop) return run;
      const item = run.shop[action.index];
      if (!item || run.player.gold < item.price) return run;

      const shop = run.shop.filter((_, i) => i !== action.index);
      const gold = run.player.gold - item.price;

      if (item.kind === 'card') {
        let nextUid = run.nextUid;
        return {
          ...run, shop, nextUid: nextUid + 1,
          player: {
            ...run.player, gold,
            deck: [...run.player.deck, { uid: `c${nextUid}`, defId: item.id, upgraded: false }],
          },
        };
      }
      if (item.kind === 'relic') {
        return { ...run, shop, player: { ...run.player, gold, relics: [...run.player.relics, item.id] } };
      }
      return { ...run, shop, player: { ...run.player, gold } };
    }

    case 'leave':
      return run.screen === 'shop' ? { ...run, screen: 'map', shop: null } : run;
  }
}
```

카드 제거는 P1에서 엽전만 소모하고 실제 제거 대상 선택 UI는 Task 17에서 붙인다. 그때 `RunAction`에 `{ type: 'removeCard'; uid: string }`를 추가한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run && npm run typecheck`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/engine/run.ts tests/engine/run.test.ts
git commit -m "엔진: 런 진행. 노드 진입·보상·객잔·장터·막 전환"
```

---

## Task 13: 저장

**Files:**
- Create: `src/engine/save.ts`
- Test: `tests/engine/save.test.ts`

**Interfaces:**
- Produces:
  - `interface MetaState { version: 1; runsStarted: number; runsWon: number; bestAct: number; bestFloors: number }`
  - `interface SaveData { version: 1; meta: MetaState; run: RunState | null }`
  - `function emptySave(): SaveData`
  - `function serialize(save: SaveData): string`
  - `function parseSave(raw: string | null): { save: SaveData; quarantined: string[] }`
  - `function recordRunEnd(meta: MetaState, run: RunState): MetaState`

손상된 구획은 통째로 버리지 않고 **그 구획만 격리하고 나머지는 살린다.** `quarantined`에 격리된 구획 이름이 담긴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/engine/save.test.ts
import { describe, it, expect } from 'vitest';
import { emptySave, serialize, parseSave, recordRunEnd } from '../../src/engine/save';
import { startRun } from '../../src/engine/run';
import { CONTENT } from '../../src/engine/gamedata';

const run = startRun('저장시드', CONTENT);

describe('왕복', () => {
  it('빈 저장을 왕복해도 같다', () => {
    const s = emptySave();
    expect(parseSave(serialize(s)).save).toEqual(s);
  });

  it('진행 중 런을 왕복해도 같다', () => {
    const s = { ...emptySave(), run };
    expect(parseSave(serialize(s)).save.run).toEqual(run);
  });

  it('격리된 구획이 없다', () => {
    expect(parseSave(serialize(emptySave())).quarantined).toEqual([]);
  });
});

describe('손상 격리', () => {
  it('null이면 빈 저장을 준다', () => {
    expect(parseSave(null).save).toEqual(emptySave());
  });

  it('JSON이 깨졌으면 빈 저장으로 되돌리고 전체를 격리한다', () => {
    const out = parseSave('{{{망가진');
    expect(out.save).toEqual(emptySave());
    expect(out.quarantined).toContain('전체');
  });

  it('run만 깨졌으면 meta는 살린다', () => {
    const good = { ...emptySave(), meta: { ...emptySave().meta, runsWon: 4 }, run };
    const broken = JSON.parse(serialize(good));
    broken.run.player = null;
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.meta.runsWon).toBe(4);
    expect(out.save.run).toBeNull();
    expect(out.quarantined).toContain('run');
  });

  it('meta만 깨졌으면 run은 살린다', () => {
    const broken = JSON.parse(serialize({ ...emptySave(), run }));
    broken.meta = '숫자가 아님';
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.run).not.toBeNull();
    expect(out.quarantined).toContain('meta');
  });

  it('버전이 다르면 런은 버리고 meta는 살린다', () => {
    const broken = JSON.parse(serialize({ ...emptySave(), run }));
    broken.run.version = 99;
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.run).toBeNull();
    expect(out.quarantined).toContain('run');
  });

  it('덱이 비면 손상으로 본다', () => {
    const broken = JSON.parse(serialize({ ...emptySave(), run }));
    broken.run.player.deck = [];
    expect(parseSave(JSON.stringify(broken)).save.run).toBeNull();
  });
});

describe('기록', () => {
  it('완주는 승수와 최고 기록을 올린다', () => {
    const meta = recordRunEnd(emptySave().meta, { ...run, result: 'victory', act: 3, stats: { floors: 24, kills: 20, elites: 3 } });
    expect(meta.runsWon).toBe(1);
    expect(meta.bestAct).toBe(3);
    expect(meta.bestFloors).toBe(24);
  });

  it('패배는 승수를 올리지 않는다', () => {
    const meta = recordRunEnd(emptySave().meta, { ...run, result: 'defeat' });
    expect(meta.runsWon).toBe(0);
  });

  it('최고 기록은 내려가지 않는다', () => {
    const first = recordRunEnd(emptySave().meta, { ...run, result: 'defeat', act: 3, stats: { floors: 20, kills: 1, elites: 0 } });
    const second = recordRunEnd(first, { ...run, result: 'defeat', act: 1, stats: { floors: 2, kills: 1, elites: 0 } });
    expect(second.bestAct).toBe(3);
    expect(second.bestFloors).toBe(20);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/engine/save.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/save"`

- [ ] **Step 3: 구현**

```ts
// src/engine/save.ts
import type { RunState } from './run';

export interface MetaState {
  version: 1;
  runsStarted: number;
  runsWon: number;
  bestAct: number;
  bestFloors: number;
}

export interface SaveData {
  version: 1;
  meta: MetaState;
  run: RunState | null;
}

export function emptySave(): SaveData {
  return {
    version: 1,
    meta: { version: 1, runsStarted: 0, runsWon: 0, bestAct: 0, bestFloors: 0 },
    run: null,
  };
}

export function serialize(save: SaveData): string {
  return JSON.stringify(save);
}

function isMeta(value: unknown): value is MetaState {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return m.version === 1
    && typeof m.runsStarted === 'number'
    && typeof m.runsWon === 'number'
    && typeof m.bestAct === 'number'
    && typeof m.bestFloors === 'number';
}

function isRun(value: unknown): value is RunState {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (r.version !== 1) return false;
  if (typeof r.seedText !== 'string' || typeof r.act !== 'number') return false;
  if (typeof r.map !== 'object' || r.map === null) return false;
  const player = r.player as Record<string, unknown> | null;
  if (typeof player !== 'object' || player === null) return false;
  if (typeof player.hp !== 'number' || typeof player.maxHp !== 'number') return false;
  if (!Array.isArray(player.deck) || player.deck.length === 0) return false;
  if (!Array.isArray(player.relics)) return false;
  return true;
}

/** 구획별로 검증해 손상된 부분만 격리한다. */
export function parseSave(raw: string | null): { save: SaveData; quarantined: string[] } {
  if (raw === null || raw === '') return { save: emptySave(), quarantined: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { save: emptySave(), quarantined: ['전체'] };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { save: emptySave(), quarantined: ['전체'] };
  }

  const source = parsed as Record<string, unknown>;
  const quarantined: string[] = [];
  const save = emptySave();

  if (isMeta(source.meta)) save.meta = source.meta;
  else if (source.meta !== undefined) quarantined.push('meta');

  if (source.run === null || source.run === undefined) save.run = null;
  else if (isRun(source.run)) save.run = source.run;
  else quarantined.push('run');

  return { save, quarantined };
}

export function recordRunEnd(meta: MetaState, run: RunState): MetaState {
  return {
    ...meta,
    runsWon: meta.runsWon + (run.result === 'victory' ? 1 : 0),
    bestAct: Math.max(meta.bestAct, run.act),
    bestFloors: Math.max(meta.bestFloors, run.stats.floors),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/engine/save.test.ts`
Expected: PASS — 12 tests

- [ ] **Step 5: 커밋**

```bash
git add src/engine/save.ts tests/engine/save.test.ts
git commit -m "엔진: 저장 직렬화와 구획별 손상 격리"
```

---

## Task 14: 순수성 검사와 자동 플레이 시뮬

엔진이 브라우저에서 독립적이라는 것을 사람이 지키는 대신 기계가 강제한다. 그리고 무작위 자동 플레이로 크래시와 승률을 본다.

**Files:**
- Create: `tools/check_engine_purity.mjs`, `tools/balance_sim.mjs`

- [ ] **Step 1: 순수성 검사기 작성**

```js
// tools/check_engine_purity.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ENGINE = new URL('../src/engine/', import.meta.url).pathname;
const BANNED = [
  { re: /\bdocument\b/, why: 'document 참조' },
  { re: /\bwindow\b/, why: 'window 참조' },
  { re: /\blocalStorage\b/, why: 'localStorage 참조' },
  { re: /\bnavigator\b/, why: 'navigator 참조' },
  { re: /Math\.random\s*\(/, why: 'Math.random 직접 호출' },
];
// randomSeedText 는 런 시드를 뽑는 유일한 지점이라 허용한다.
const ALLOW = new Map([['rng.ts', /Math\.random\s*\(/]]);

const problems = [];
for (const name of readdirSync(ENGINE)) {
  if (!name.endsWith('.ts')) continue;
  const source = readFileSync(join(ENGINE, name), 'utf8');
  source.split('\n').forEach((line, i) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    for (const { re, why } of BANNED) {
      if (!re.test(line)) continue;
      const allowed = ALLOW.get(name);
      if (allowed && allowed.source === re.source) continue;
      problems.push(`src/engine/${name}:${i + 1} — ${why}`);
    }
  });
}

if (problems.length) {
  console.error('엔진 순수성 위반:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('엔진 순수성 통과 — DOM·전역 난수 참조 없음');
```

- [ ] **Step 2: 자동 플레이 시뮬 작성**

엔진이 순수하므로 브라우저 없이 그대로 돌린다. TypeScript를 직접 실행하기 위해 `vitest`의 러너를 재사용한다 — 시뮬을 테스트 파일이 아닌 별도 진입점으로 두되 `node --experimental-strip-types`로 돌린다 (Node 20에서는 미지원이므로 `vite-node`를 devDependency로 추가한다).

```bash
npm install -D vite-node
```

`package.json`의 `balance` 스크립트를 교체한다:

```json
"balance": "vite-node tools/balance_sim.ts"
```

```ts
// tools/balance_sim.ts
import { CONTENT } from '../src/engine/gamedata';
import { applyRunAction, availableNodes, startRun, type RunState } from '../src/engine/run';
import { canPlay, effectiveCard } from '../src/engine/combat';
import { Rng } from '../src/engine/rng';

const RUNS = Number(process.argv[2] ?? 300);

/** 낼 수 있는 카드를 아무거나 내고, 못 내면 턴을 넘기는 최소 휴리스틱. */
function playCombat(run: RunState, rng: Rng): RunState {
  let s = run;
  for (let guard = 0; guard < 4000 && s.screen === 'combat' && s.combat; guard++) {
    const playable = s.combat.hand.filter((c) => canPlay(s.combat!, c.uid, CONTENT));
    if (playable.length === 0) {
      s = applyRunAction(s, { type: 'combat', action: { type: 'endTurn' } }, CONTENT);
      continue;
    }
    // 공격 카드를 우선한다.
    const attack = playable.find((c) =>
      effectiveCard(CONTENT.card(c.defId), c.upgraded).effects.some((e) => e.op === 'damage'));
    const chosen = attack ?? rng.pick(playable);
    const target = s.combat.enemies.find((e) => e.hp > 0)?.uid;
    s = applyRunAction(s, { type: 'combat', action: { type: 'playCard', uid: chosen.uid, targetUid: target } }, CONTENT);
  }
  return s;
}

function playRun(seedText: string): RunState {
  const rng = new Rng(seedText.length * 7919 + 13);
  let s = startRun(seedText, CONTENT);

  for (let guard = 0; guard < 500 && s.result === 'ongoing'; guard++) {
    if (s.screen === 'map') {
      const options = availableNodes(s);
      if (options.length === 0) break;
      s = applyRunAction(s, { type: 'chooseNode', nodeId: rng.pick(options) }, CONTENT);
    } else if (s.screen === 'combat') {
      s = playCombat(s, rng);
    } else if (s.screen === 'reward') {
      const pick = s.reward?.cards[rng.int(3)] ?? null;
      s = applyRunAction(s, { type: 'takeCard', cardId: pick }, CONTENT);
    } else if (s.screen === 'rest') {
      s = applyRunAction(s, { type: 'rest', choice: 'heal' }, CONTENT);
    } else if (s.screen === 'shop') {
      s = applyRunAction(s, { type: 'leave' }, CONTENT);
    } else {
      break;
    }
  }
  return s;
}

let wins = 0;
let floors = 0;
const deaths: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

for (let i = 0; i < RUNS; i++) {
  const result = playRun(`시드${i}`);
  floors += result.stats.floors;
  if (result.result === 'victory') wins++;
  else deaths[result.act] = (deaths[result.act] ?? 0) + 1;
}

console.log(`자동 플레이 ${RUNS}회`);
console.log(`  완주율      ${((wins / RUNS) * 100).toFixed(1)}%`);
console.log(`  평균 층수   ${(floors / RUNS).toFixed(1)}`);
console.log(`  막별 전멸   1막 ${deaths[1]} · 2막 ${deaths[2]} · 3막 ${deaths[3]}`);
```

- [ ] **Step 3: 둘 다 실행**

```bash
npm run check:purity
npm run balance
```

Expected: 순수성 통과 메시지. 시뮬이 크래시 없이 완료되고 완주율·평균 층수를 출력한다. **완주율이 0%거나 100%면 밸런스가 깨진 것이므로 적 체력이나 카드 수치를 조정한다.** 무작위에 가까운 AI 기준 5~25%를 목표로 한다.

- [ ] **Step 4: 커밋**

```bash
git add tools/check_engine_purity.mjs tools/balance_sim.ts package.json package-lock.json
git commit -m "도구: 엔진 순수성 검사와 자동 플레이 시뮬"
```

---

## Task 15: UI 셸 · 저장 브릿지 · 타이틀

**Files:**
- Create: `src/platform/storage.ts`, `src/ui/dom.ts`, `src/ui/app.ts`, `src/ui/screens/title.ts`, `src/styles/layout.css`
- Modify: `src/main.ts`
- Test: `tests/engine/storage.test.ts`

**Interfaces:**
- Produces:
  - `src/platform/storage.ts` → `const SAVE_KEY = 'gangho.save.v1'`, `function loadSave(store?: Storage): { save: SaveData; quarantined: string[] }`, `function persistSave(save: SaveData, store?: Storage): boolean`, `function exportSave(save: SaveData): string`, `function importSave(text: string): SaveData | null`
  - `src/ui/dom.ts` → `function el<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Partial<HTMLElementTagNameMap[K]> & { class?: string; dataset?: Record<string, string> }, children?: Array<Node | string>): HTMLElementTagNameMap[K]`, `function clear(node: HTMLElement): void`
  - `src/ui/app.ts` → `function mountApp(root: HTMLElement): void`, `interface AppApi { dispatch(action: RunAction): void; newRun(seedText?: string): void; abandon(): void; getState(): AppState }`
  - `src/ui/screens/title.ts` → `function renderTitle(api: AppApi, state: AppState): HTMLElement`

`storage.ts`는 `engine/` 밖에 있으므로 `localStorage`를 만져도 순수성 검사에 걸리지 않는다. 브라우저가 저장을 거부해도(사생활 모드) 게임은 계속 돌아가야 하므로 `persistSave`는 예외를 삼키고 `false`를 돌려준다.

- [ ] **Step 1: 저장 브릿지 테스트 작성**

```ts
// tests/engine/storage.test.ts
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
```

- [ ] **Step 2: 테스트 실패 확인 후 storage.ts 작성**

Run: `npx vitest run tests/engine/storage.test.ts` → FAIL

```ts
// src/platform/storage.ts
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
```

- [ ] **Step 3: dom.ts 작성**

```ts
// src/ui/dom.ts
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
```

- [ ] **Step 4: app.ts 작성**

```ts
// src/ui/app.ts
import { CONTENT } from '../engine/gamedata';
import { applyRunAction, startRun, type RunAction, type RunState } from '../engine/run';
import { recordRunEnd, type SaveData } from '../engine/save';
import { randomSeedText } from '../engine/rng';
import { loadSave, persistSave } from '../platform/storage';
import { clear } from './dom';
import { renderTitle } from './screens/title';
import { renderCombat } from './screens/combat';
import { renderMap } from './screens/map';
import { renderReward } from './screens/reward';
import { renderRest } from './screens/rest';
import { renderShop } from './screens/shop';
import { renderResult } from './screens/result';

export interface AppState {
  save: SaveData;
  view: 'title' | 'run';
  notice: string | null;
}

export interface AppApi {
  dispatch(action: RunAction): void;
  newRun(seedText?: string): void;
  toTitle(): void;
  dismissNotice(): void;
  getState(): AppState;
}

export function mountApp(root: HTMLElement): void {
  const loaded = loadSave();
  const state: AppState = {
    save: loaded.save,
    view: loaded.save.run && loaded.save.run.result === 'ongoing' ? 'run' : 'title',
    notice: loaded.quarantined.length
      ? `저장 기록 일부가 손상되어 격리했습니다 (${loaded.quarantined.join(', ')}). 나머지는 그대로 이어집니다.`
      : null,
  };

  function commit(run: RunState | null): void {
    let save: SaveData = { ...state.save, run };
    if (run && run.result !== 'ongoing') {
      save = { ...save, meta: recordRunEnd(save.meta, run) };
    }
    state.save = save;
    persistSave(save);
    render();
  }

  const api: AppApi = {
    dispatch(action) {
      const run = state.save.run;
      if (!run) return;
      commit(applyRunAction(run, action, CONTENT));
    },
    newRun(seedText) {
      const seed = seedText && seedText.trim() ? seedText.trim() : randomSeedText();
      const run = startRun(seed, CONTENT);
      state.view = 'run';
      state.save = { ...state.save, meta: { ...state.save.meta, runsStarted: state.save.meta.runsStarted + 1 } };
      commit(run);
    },
    toTitle() {
      state.view = 'title';
      render();
    },
    dismissNotice() {
      state.notice = null;
      render();
    },
    getState: () => state,
  };

  function screenFor(run: RunState): HTMLElement {
    switch (run.screen) {
      case 'combat': return renderCombat(api, run);
      case 'reward': return renderReward(api, run);
      case 'rest': return renderRest(api, run);
      case 'shop': return renderShop(api, run);
      case 'result': return renderResult(api, run);
      default: return renderMap(api, run);
    }
  }

  function render(): void {
    clear(root);
    const run = state.save.run;
    root.append(state.view === 'run' && run ? screenFor(run) : renderTitle(api, state));
    if (state.notice) root.append(renderNotice(state.notice, api));
  }

  render();
}

function renderNotice(text: string, api: AppApi): HTMLElement {
  const box = document.createElement('div');
  box.className = 'notice';
  box.setAttribute('role', 'status');
  box.textContent = text;
  const close = document.createElement('button');
  close.className = 'notice-close';
  close.textContent = '×';
  close.setAttribute('aria-label', '알림 닫기');
  close.addEventListener('click', () => api.dismissNotice());
  box.append(close);
  return box;
}
```

- [ ] **Step 5: title.ts 작성**

```ts
// src/ui/screens/title.ts
import type { AppApi, AppState } from '../app';
import { el } from '../dom';

export function renderTitle(api: AppApi, state: AppState): HTMLElement {
  const { meta, run } = state.save;
  const seedInput = el('input', {
    class: 'seed-input', type: 'text', placeholder: '시드 (비우면 무작위)',
    maxLength: 24, id: 'seed-input',
  });

  const actions = el('div', { class: 'title-actions' }, [
    el('button', {
      class: 'btn primary', textContent: '새로운 강호행', onclick: () => api.newRun(seedInput.value),
    }),
  ]);

  if (run && run.result === 'ongoing') {
    actions.prepend(el('button', {
      class: 'btn primary', textContent: `이어하기 — ${run.act}막`,
      onclick: () => { api.getState().view = 'run'; api.dismissNotice(); },
    }));
  }

  return el('main', { class: 'screen title' }, [
    el('h1', { class: 'title-name', textContent: '강호비급' }),
    el('p', { class: 'title-hanja', textContent: '江湖祕笈' }),
    el('p', { class: 'title-tagline', textContent: '초식을 모아 강호를 오른다' }),
    el('label', { class: 'seed-label', htmlFor: 'seed-input', textContent: '시드' }),
    seedInput,
    actions,
    el('p', { class: 'title-stats', textContent:
      `강호행 ${meta.runsStarted}회 · 완주 ${meta.runsWon}회 · 최고 ${meta.bestAct}막 ${meta.bestFloors}층` }),
    el('p', { class: 'fan', textContent:
      '김용 원작 세계관을 참조한 비공식·비영리 팬메이드 작품입니다. 원작 문장과 저작물은 사용하지 않았습니다.' }),
  ]);
}
```

`이어하기` 버튼이 `getState().view`를 직접 바꾸는 것은 렌더를 부르지 않아 동작하지 않는다. `AppApi`에 `resume(): void`를 추가하고 (`state.view = 'run'; render();`) 버튼은 `api.resume()`을 부르도록 한다.

- [ ] **Step 6: main.ts 교체**

```ts
// src/main.ts
import './styles/base.css';
import './styles/layout.css';
import { mountApp } from './ui/app';

const root = document.getElementById('app');
if (root) mountApp(root);
```

- [ ] **Step 7: 스타일 작성**

`src/styles/layout.css`에 화면 공통 레이아웃을 넣는다. 요구 사항: `.screen`은 `height:100%`에 세로 flex, 상단바는 `position:sticky`, 하단 행동바는 `padding-bottom: env(safe-area-inset-bottom)`. `.btn`은 최소 터치 영역 `44px`. `.notice`는 화면 하단 고정. 폭 `520px` 이상에서 `.screen`을 가운데 정렬하고 최대 폭 `900px`으로 제한한다.

- [ ] **Step 8: 나머지 화면의 자리표시 구현**

Task 16·17에서 채울 `renderCombat` · `renderMap` · `renderReward` · `renderRest` · `renderShop` · `renderResult`를 지금은 각각 화면 이름과 `맵으로` 버튼만 있는 최소 구현으로 만들어 앱이 실행되게 한다. 각 파일은 `src/ui/screens/<name>.ts`이며 시그니처는 `(api: AppApi, run: RunState) => HTMLElement`다.

- [ ] **Step 9: 확인하고 커밋**

```bash
npx vitest run && npm run typecheck && npm run build
git add src/platform src/ui src/main.ts src/styles tests/engine/storage.test.ts
git commit -m "UI: 앱 셸·화면 라우터·저장 브릿지·타이틀"
```

---

## Task 16: 전투 화면

가장 중요한 화면이다. 모바일 세로를 기준으로 짜고 데스크톱에서는 같은 배치를 넓힌다.

**Files:**
- Create: `src/ui/components/card.ts`, `src/ui/components/enemy.ts`, `src/ui/components/stance.ts`, `src/ui/input.ts`, `src/styles/combat.css`
- Modify: `src/ui/screens/combat.ts`

**Interfaces:**
- Produces:
  - `renderCardFace(def: CardDef, opts: { upgraded: boolean; playable: boolean }): HTMLElement`
  - `renderEnemy(enemy: EnemyState, opts: { selected: boolean }): HTMLElement`
  - `renderStanceBar(state: CombatState): HTMLElement`
  - `bindCombatKeys(root: HTMLElement, handlers: { play(index: number): void; endTurn(): void; cancel(): void }): () => void`

화면 구성 (위에서 아래로):
1. **상단바** — 체력 / 호신강기 / 내공 · 막·층 · 기물 줄
2. **적 열** — 초상, 체력 바, 상태 배지, **의도 카드**(행동 아이콘 + 수치 + 계열 도형·한자)
3. **자세 띠** — 내 자세와 적 자세를 나란히 놓고 그 사이에 관계를 글자로 적는다: `외 ◆ → 破 → 輕 ▲` 처럼. 연계 카운터를 점으로 표시하고 임계 도달 시 강조한다.
4. **손패** — 하단 가로 스크롤. 카드마다 계열 띠(색+한자+도형), 코스트, 이름, 설명.
5. **행동바** — `턴 종료` · `덱 보기` · `버린 패` · `설정`

상호작용: 카드를 탭하면 선택되고, 대상이 필요한 카드는 적을 한 번 더 탭해서 확정한다. 적이 하나면 즉시 발동한다. 선택 상태에서 빈 곳을 탭하거나 `Esc`를 누르면 취소한다.

접근성: 카드 버튼의 `aria-label`은 `이름, 계열, 내공 N, 설명` 순으로 읽는다. 계열은 `LINE_LABEL`의 이름·한자·도형을 모두 넣어 색 없이 구분되게 한다. 의도에는 `aria-label`로 `다음 행동: 공격 22, 경공`처럼 붙인다.

- [ ] **Step 1: 카드 컴포넌트 작성**

```ts
// src/ui/components/card.ts
import { LINE_LABEL } from '../../engine/stance';
import type { CardDef } from '../../engine/types';
import { el } from '../dom';

export function renderCardFace(
  def: CardDef, opts: { upgraded: boolean; playable: boolean },
): HTMLElement {
  const line = LINE_LABEL[def.line];
  const name = opts.upgraded ? `${def.name}＋` : def.name;

  return el('article', {
    class: `card line-${def.line} rarity-${def.rarity}${opts.playable ? '' : ' unplayable'}`,
  }, [
    el('div', { class: 'card-cost', textContent: String(def.cost) }),
    el('div', { class: 'card-line', title: line.name }, [
      el('span', { class: 'card-line-shape', textContent: line.shape }),
      el('span', { class: 'card-line-hanja', textContent: line.hanja }),
    ]),
    el('h3', { class: 'card-name', textContent: name }),
    el('p', { class: 'card-hanja', textContent: def.hanja }),
    el('p', { class: 'card-text', textContent: def.text }),
  ]);
}

export function cardAriaLabel(def: CardDef, upgraded: boolean): string {
  const line = LINE_LABEL[def.line];
  return `${def.name}${upgraded ? ' 강화' : ''}, ${line.name}, 내공 ${def.cost}, ${def.text}`;
}
```

- [ ] **Step 2: 적·자세 컴포넌트와 키보드 바인딩 작성**

`renderEnemy`는 이름·한자, 체력 바(`role="meter"`, `aria-valuenow`), 호신강기 배지, 상태 배지 목록, 의도 블록을 담는다. 의도 블록은 `STATUS_META`와 같은 방식으로 `IntentKind`별 기호를 쓴다: 공격 `⚔`, 방어 `⛨`, 디버프 `⌁`, 버프 `↑`, 특수 `◇`. 수치가 `hits > 1`이면 `22 ×2`로 적는다.

`renderStanceBar`는 `matchup(플레이어 자세, 적 자세)`와 그 역방향을 함께 계산해 두 줄로 보여준다 — 내가 지금 치면 어떻게 되는지, 적이 지금 치면 어떻게 되는지. 이 화면이 이 게임의 핵심 정보다.

`bindCombatKeys`는 `1`~`9`로 손패 n번째를 고르고, `Space`/`Enter`로 턴 종료, `Esc`로 선택 취소한다. 반환값은 해제 함수다.

- [ ] **Step 3: combat.ts 작성**

`renderCombat(api, run)`은 위 다섯 구역을 조립하고 카드 탭 → 대상 선택 → `api.dispatch({ type: 'combat', action: { type: 'playCard', uid, targetUid } })`로 잇는다. 선택 상태는 모듈 지역 변수가 아니라 `renderCombat` 호출 안의 클로저에 둔다. 매 dispatch 후 앱이 전체를 다시 그리므로 선택 상태는 자연히 초기화된다.

- [ ] **Step 4: 스타일 작성**

`src/styles/combat.css`. 요구 사항:
- `.combat`은 `display:grid; grid-template-rows: auto 1fr auto auto auto`
- `.hand`은 `display:flex; overflow-x:auto; scroll-snap-type:x mandatory; gap:.5rem`, 카드 폭 `min(30vw, 132px)`
- `.card.unplayable { opacity:.45 }`
- 계열 색은 `--wai/--gyeong/--nae` 변수를 쓰되 **도형과 한자를 항상 함께 렌더**한다
- `@media (min-width: 900px)`에서 손패 카드 폭을 `150px`로 키우고 적 열을 가운데 정렬
- `@media (prefers-reduced-motion: reduce)`에서 모든 트랜지션을 끈다

- [ ] **Step 5: 실제로 돌려 확인**

```bash
npm run dev
```

브라우저에서 새 강호행을 시작하고 첫 격전에 들어가 카드를 내 본다. 확인할 것: 카드가 실제로 발동하는가, 자세 띠가 파훼·저항을 맞게 표시하는가, 연계 3장째에 강조가 뜨는가, 세로 화면에서 손패가 가로 스크롤되는가, `Esc`로 선택이 풀리는가.

- [ ] **Step 6: 커밋**

```bash
npm run typecheck && npm run build
git add src/ui src/styles/combat.css
git commit -m "UI: 전투 화면. 자세 띠·적 의도·손패 조작"
```

---

## Task 17: 맵 · 보상 · 객잔 · 장터 · 결과 화면

**Files:**
- Modify: `src/ui/screens/map.ts`, `reward.ts`, `rest.ts`, `shop.ts`, `result.ts`
- Create: `src/ui/components/deckview.ts`, `src/styles/screens.css`
- Modify: `src/engine/run.ts` (카드 제거 액션 추가)

**Interfaces:**
- 추가: `RunAction`에 `{ type: 'removeCard'; uid: string }`. 장터에서 `remove` 항목을 사면 `shop`에서 그 항목을 지우고 `screen`은 `'shop'`으로 두되 `pendingRemoval: true` 플래그를 세운다. `removeCard`는 `pendingRemoval`이 참일 때만 덱에서 카드를 지우고 플래그를 내린다. `RunState`에 `pendingRemoval: boolean`을 추가하고 `startRun`에서 `false`로 초기화한다. `save.ts`의 `isRun` 검증에는 이 필드를 요구하지 않는다 (구버전 저장 호환).

각 화면 요구 사항:

- **맵**: 6층을 세로로 그리고 현재 위치 아래층의 갈 수 있는 노드만 활성화한다. 노드 타입은 아이콘 + 한글 라벨을 함께 쓴다 (격전 ⚔ · 정예 ✦ · 객잔 ⌂ · 장터 ⚖ · 관문 ▣). 상단에 체력·엽전·막, 우상단에 `덱 보기` 버튼.
- **보상**: 엽전 획득량을 먼저 보이고 초식 3장을 카드 면으로 나란히 놓는다. `넘기기` 버튼을 항상 제공한다. 기물 보상이 있으면 카드 위에 따로 띄운다.
- **객잔**: `휴식 — 체력 24 회복`과 `수련 — 초식 1장 강화` 두 버튼. 수련을 고르면 강화 가능한 카드만 추린 덱 목록을 띄운다.
- **장터**: 진열 항목마다 가격과 `구매` 버튼. 엽전이 모자라면 버튼을 `disabled`로 두고 `aria-disabled`도 함께 준다. `remove` 항목을 사면 덱에서 지울 카드를 고르는 목록으로 넘어간다.
- **결과**: 완주/전멸을 크게 적고 시드·도달 막·층수·처치 수를 보여준다. `타이틀로` 버튼. 시드는 탭하면 클립보드로 복사한다 (실패해도 조용히 넘어간다).

`deckview.ts`는 세 화면이 공유한다: `renderDeckList(deck: CardInstance[], opts: { onPick?(uid: string): void; filter?(card: CardInstance): boolean; emptyText: string }): HTMLElement`.

- [ ] **Step 1: run.ts에 제거 액션 추가하고 테스트 작성**

```ts
// tests/engine/run.test.ts 에 추가
describe('카드 제거', () => {
  it('제거 항목을 사면 제거 대기 상태가 된다', () => {
    const r = startRun('제거', CONTENT);
    const s = { ...r, screen: 'shop' as const, player: { ...r.player, gold: 200 },
      shop: [{ kind: 'remove' as const, id: 'remove', price: 70 }] };
    const after = applyRunAction(s, { type: 'buy', index: 0 }, CONTENT);
    expect(after.pendingRemoval).toBe(true);
    expect(after.player.gold).toBe(130);
  });

  it('대기 상태에서만 카드가 지워진다', () => {
    const r = startRun('제거2', CONTENT);
    const uid = r.player.deck[0]!.uid;
    expect(applyRunAction(r, { type: 'removeCard', uid }, CONTENT).player.deck).toHaveLength(10);
    const armed = { ...r, screen: 'shop' as const, pendingRemoval: true };
    const done = applyRunAction(armed, { type: 'removeCard', uid }, CONTENT);
    expect(done.player.deck).toHaveLength(9);
    expect(done.pendingRemoval).toBe(false);
  });

  it('덱이 1장이면 지울 수 없다', () => {
    const r = startRun('제거3', CONTENT);
    const one = { ...r, screen: 'shop' as const, pendingRemoval: true,
      player: { ...r.player, deck: r.player.deck.slice(0, 1) } };
    expect(applyRunAction(one, { type: 'removeCard', uid: one.player.deck[0]!.uid }, CONTENT).player.deck).toHaveLength(1);
  });
});
```

`applyRunAction`에 분기를 추가한다:

```ts
    case 'removeCard': {
      if (!run.pendingRemoval || run.player.deck.length <= 1) return run;
      if (!run.player.deck.some((c) => c.uid === action.uid)) return run;
      return {
        ...run,
        pendingRemoval: false,
        player: { ...run.player, deck: run.player.deck.filter((c) => c.uid !== action.uid) },
      };
    }
```

`buy`의 `remove` 분기를 `return { ...run, shop, pendingRemoval: true, player: { ...run.player, gold } };`로 바꾼다.

- [ ] **Step 2: 테스트 통과 확인**

Run: `npx vitest run tests/engine/run.test.ts`
Expected: PASS

- [ ] **Step 3: 다섯 화면과 deckview 구현**

- [ ] **Step 4: 실제로 한 판 완주해 본다**

```bash
npm run dev
```

1막 관문까지 가서 보상·객잔·장터를 모두 거친다. 확인할 것: 맵에서 갈 수 없는 노드가 눌리지 않는가, 보상 넘기기가 되는가, 수련이 카드에 `＋`를 붙이는가, 장터에서 엽전이 모자란 항목이 비활성인가, 제거가 덱에서 실제로 빠지는가, 관문을 이기면 2막 맵이 새로 뜨는가.

- [ ] **Step 5: 커밋**

```bash
npm run validate && npx vitest run && npm run typecheck && npm run build
git add src/ui src/styles/screens.css src/engine/run.ts tests/engine/run.test.ts
git commit -m "UI: 맵·보상·객잔·장터·결과 화면과 카드 제거"
```

---

## Task 18: 아트와 사운드

이미지 자산은 보스 초상 3장뿐이고 나머지는 전부 코드로 그린다.

**Files:**
- Create: `src/art/svg.ts`, `src/art/portraits.ts`, `src/audio/sfx.ts`
- Create: `public/portraits/*.webp` (3장)
- Modify: `src/ui/components/card.ts`, `enemy.ts` (문양·초상 연결)

**Interfaces:**
- Produces:
  - `function lineSigil(line: Line, seed: number): SVGSVGElement` — 계열별 문양. 외공은 먹선 검격, 경공은 바람 소용돌이, 내공은 동심 기운. `seed`로 획의 각도와 굵기를 흔들어 카드마다 다르게 만든다.
  - `function inkBackdrop(act: number): SVGSVGElement` — 막별 원경 산세 실루엣.
  - `function portraitFor(defId: string): HTMLElement` — WebP가 있으면 `<img loading="lazy">`, 없으면 `fallbackFace(defId)`.
  - `function fallbackFace(defId: string): SVGSVGElement` — id 해시로 윤곽·눈·수염을 정하는 결정적 SVG 얼굴.
  - `const sfx: { enabled: boolean; play(name: SfxName): void; setEnabled(on: boolean): void }` where `type SfxName = 'card' | 'hit' | 'break' | 'block' | 'combo' | 'defeat' | 'victory'`

- [ ] **Step 1: 보스 초상 3장 가져오기**

sajo-game은 같은 제작자의 자체 제작 초상만 담고 있으므로 재사용할 수 있다. 파일명이 인물 id로 되어 있으니 매핑을 먼저 확인한다.

```bash
git clone --depth 1 https://github.com/Flyest1/sajo-game.git /tmp/sajo-ref
node -e "const p=require('/tmp/sajo-ref/src/data/portraits.json'); console.log(JSON.stringify(p,null,1))" | head -80
```

출력에서 **매초풍 · 구천인 · 구양봉** 세 인물의 id를 찾아 해당 파일을 복사한다:

```bash
mkdir -p public/portraits
cp /tmp/sajo-ref/public/portraits/hero/<매초풍id>.webp public/portraits/maechopung.webp
cp /tmp/sajo-ref/public/portraits/hero/<구천인id>.webp public/portraits/guchunin.webp
cp /tmp/sajo-ref/public/portraits/hero/<구양봉id>.webp public/portraits/guyangbong.webp
rm -rf /tmp/sajo-ref
```

`src/data/enemies.json`의 보스 세 항목에 `"portrait": "maechopung"` 형태로 필드를 채운다. 일반·정예 적은 `portrait`를 비워 두고 `fallbackFace`가 그린다.

README에 초상 출처를 적는다: `보스 초상 3장은 같은 제작자의 sajo-game 프로젝트에서 자체 제작한 것을 가져왔습니다.`

- [ ] **Step 2: svg.ts 구현**

모든 함수는 `document.createElementNS('http://www.w3.org/2000/svg', ...)`로 그린다. 외부 자산도 폰트도 부르지 않는다. `lineSigil`은 `viewBox="0 0 64 64"`에 `stroke="currentColor"`를 써서 CSS 색을 그대로 받는다. 카드가 140장이 되어도 이미지 요청은 0이다.

- [ ] **Step 3: portraits.ts 구현**

`fallbackFace`는 `defId`를 FNV 해시해 얼굴형 3종 · 눈매 3종 · 수염 4종 · 관모 3종을 조합한다. 같은 적은 항상 같은 얼굴이 나와야 하므로 `Math.random`을 쓰지 않는다.

- [ ] **Step 4: sfx.ts 구현**

`AudioContext`를 첫 사용자 제스처에서 지연 생성한다. 각 효과음은 오실레이터 + 게인 엔벨로프로 만든다: `card` 짧은 나무 소리(삼각파 220Hz, 60ms), `hit` 잡음 버스트, `break` 하강 스윕(파훼 전용, 명확히 다르게), `block` 저역 사인, `combo` 상승 3음, `victory`/`defeat` 오음계 짧은 프레이즈. 설정은 `localStorage`의 `gangho.sfx`에 저장하고 기본은 켜짐이다. `AudioContext` 생성이 실패해도 게임은 계속 돌아야 한다.

- [ ] **Step 5: 확인하고 커밋**

```bash
npm run dev   # 카드 문양이 계열마다 다른지, 보스 초상이 뜨는지, 소리가 나는지
npm run build
git add src/art src/audio public/portraits src/ui src/data/enemies.json README.md
git commit -m "아트·사운드: 코드 생성 SVG 문양과 절차 합성 효과음"
```

---

## Task 19: PWA 오프라인과 접근성 마감

**Files:**
- Create: `src/platform/pwa.ts`
- Modify: `src/main.ts`, `src/ui/app.ts`, `src/styles/base.css`

**Interfaces:**
- Produces: `function mountPwaUpdates(): void` — `virtual:pwa-register`의 `registerSW`를 감싸 새 버전 알림과 오프라인 준비 알림을 띄운다.

- [ ] **Step 1: pwa.ts 구현**

```ts
// src/platform/pwa.ts
import { registerSW } from 'virtual:pwa-register';

export function mountPwaUpdates(): void {
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
}

function showBanner(title: string, body: string, onApply: (() => void) | null): void {
  document.getElementById('pwa-banner')?.remove();
  const box = document.createElement('section');
  box.id = 'pwa-banner';
  box.className = 'notice';
  box.setAttribute('role', onApply ? 'alertdialog' : 'status');
  box.append(
    Object.assign(document.createElement('b'), { textContent: title }),
    Object.assign(document.createElement('span'), { textContent: body }),
  );
  if (onApply) {
    const apply = Object.assign(document.createElement('button'), {
      className: 'btn small', textContent: '적용',
    });
    apply.addEventListener('click', () => { apply.disabled = true; onApply(); });
    box.append(apply);
  }
  const close = Object.assign(document.createElement('button'), {
    className: 'notice-close', textContent: '×',
  });
  close.setAttribute('aria-label', '알림 닫기');
  close.addEventListener('click', () => box.remove());
  box.append(close);
  document.body.append(box);
  if (!onApply) setTimeout(() => box.remove(), 4500);
}
```

`src/main.ts`에서 `mountApp` 뒤에 `mountPwaUpdates()`를 부른다.

- [ ] **Step 2: 접근성 마감**

- 모달(덱 보기, 수련 목록, 제거 목록)은 열릴 때 첫 요소로 초점을 옮기고 `Tab`을 모달 안에 가두며 닫을 때 원래 버튼으로 되돌린다. 공용 헬퍼 `trapFocus(node: HTMLElement): () => void`를 `src/ui/dom.ts`에 추가한다.
- 모든 상호작용 요소는 `<button>`이다. `div`에 `onclick`을 달지 않는다.
- 체력·호신강기 바에 `role="meter"`와 `aria-valuenow`/`aria-valuemin`/`aria-valuemax`를 준다.
- `prefers-reduced-motion: reduce`에서 모든 애니메이션과 트랜지션을 제거한다.
- 계열 색만으로 정보를 전달하는 곳이 없는지 화면마다 확인한다. 카드·의도·자세 띠 전부 한자와 도형을 함께 그린다.

- [ ] **Step 3: 오프라인 실제 확인**

```bash
npm run build && npm run preview
```

브라우저에서 열어 한 판 시작 → DevTools Network를 `Offline`으로 바꾸고 새로고침 → 게임이 그대로 뜨고 진행 중 런이 이어지는지 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add src/platform/pwa.ts src/main.ts src/ui src/styles
git commit -m "PWA: 오프라인 플레이·업데이트 알림·접근성 마감"
```

---

## Task 20: 브라우저 스모크 테스트와 최종 배포

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `tools/verify_build.mjs`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: playwright.config.ts 작성**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173/gangho-bigeup/', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/gangho-bigeup/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
```

- [ ] **Step 2: 스모크 테스트 작성**

```ts
// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

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
  await page.waitForTimeout(2000); // 서비스워커 프리캐시
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '강호비급' })).toBeVisible();
  await context.setOffline(false);
});

test('턴 종료로 적이 행동하고 다음 턴이 온다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새로운 강호행' }).click();
  await page.getByRole('button', { name: /격전/ }).first().click();
  await page.getByRole('button', { name: '턴 종료' }).click();
  await expect(page.locator('.turn-indicator')).toContainText('2');
});
```

전투 화면과 맵 화면에 테스트가 의존하는 훅을 붙인다: `.combat`, `.map`, `.hand .card`, `.enemy[data-hp]`, `.turn-indicator`, 그리고 노드 버튼의 접근 가능한 이름에 타입 라벨(`격전` 등)이 들어가야 한다.

- [ ] **Step 3: 빌드 검증기 작성**

```js
// tools/verify_build.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url).pathname;
const problems = [];

if (!existsSync(`${dist}index.html`)) problems.push('index.html 없음');
if (!existsSync(`${dist}manifest.webmanifest`)) problems.push('매니페스트 없음');
if (!existsSync(`${dist}sw.js`)) problems.push('서비스워커 없음');

for (const icon of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
  if (!existsSync(dist + icon)) problems.push(`아이콘 없음: ${icon}`);
}

const html = readFileSync(`${dist}index.html`, 'utf8');
if (!html.includes('/gangho-bigeup/')) problems.push('base 경로가 적용되지 않았다');

const sw = existsSync(`${dist}sw.js`) ? readFileSync(`${dist}sw.js`, 'utf8') : '';
if (!sw.includes('precache') && !sw.includes('__WB_MANIFEST')) {
  problems.push('서비스워커에 프리캐시 목록이 없다');
}

const assets = existsSync(`${dist}assets`) ? readdirSync(`${dist}assets`) : [];
if (!assets.some((f) => f.endsWith('.js'))) problems.push('번들 JS 없음');

if (problems.length) {
  console.error('빌드 검증 실패:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('빌드 검증 통과 — 앱 셸·매니페스트·서비스워커·아이콘 확인');
```

`package.json`에 `"verify:build": "node tools/verify_build.mjs"`를 추가한다.

- [ ] **Step 4: 로컬에서 전 파이프라인 실행**

```bash
npm run validate && npm run check:purity && npm run typecheck && npm run test && npm run build && npm run verify:build && npm run test:e2e
```

Expected: 전부 통과. 실패하면 여기서 고친다 — CI에서 처음 보는 실패가 없어야 한다.

- [ ] **Step 5: 워크플로 확장**

`.github/workflows/deploy.yml`의 `build` 잡 스텝을 아래로 교체한다:

```yaml
      - run: npm ci
      - name: 데이터 검증
        run: npm run validate
      - name: 엔진 순수성
        run: npm run check:purity
      - name: 타입 검사
        run: npm run typecheck
      - name: 엔진 단위 테스트
        run: npm run test
      - name: 빌드
        run: npm run build
      - name: 오프라인 빌드 검증
        run: npm run verify:build
      - name: 브라우저 설치
        run: npx playwright install --with-deps chromium
      - name: 브라우저 스모크
        run: npm run test:e2e
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
```

- [ ] **Step 6: 푸시하고 배포 확인**

```bash
git add playwright.config.ts tests/e2e tools/verify_build.mjs .github/workflows/deploy.yml package.json src
git commit -m "테스트·CI: 브라우저 스모크와 전체 파이프라인"
git push
gh run watch
```

Expected: 워크플로 전 단계 통과, 배포 성공.

- [ ] **Step 7: 배포본으로 실제 완주**

`https://flyest1.github.io/gangho-bigeup/`를 휴대폰과 데스크톱에서 열어 각각 한 판씩 끝까지 간다. **P1 완료 조건은 배포된 URL에서 개방으로 3막 관문까지 완주가 되는 것이다.** 도중에 막히는 지점이 있으면 수치를 조정하고 다시 배포한다.

확인 목록:
- [ ] 휴대폰 세로에서 손패·의도·자세 띠가 모두 읽힌다
- [ ] 홈 화면에 설치되고 기내 모드에서 실행된다
- [ ] 앱을 껐다 켜도 진행 중 런이 이어진다
- [ ] 3막 관문을 이기면 결과 화면이 뜨고 완주 기록이 남는다
- [ ] `npm run balance` 완주율이 5~25% 범위다

- [ ] **Step 8: README 갱신하고 커밋**

P1에서 실제로 구현된 범위(개방 1문파·3막·초식 60장·기물 20종)를 README에 적고, P2 이후 예정 항목을 목록으로 남긴다.

```bash
git add README.md
git commit -m "문서: P1 배포 범위 정리"
git push
```

---

## 자체 검토 결과

계획을 설계서와 대조하며 확인한 것들이다.

**스펙 커버리지.** 설계서 §7의 P1 정의(엔진 코어 + 개방 1문파 + 축약 3막 + 보스 3 + 카드 60 + 기물 20 + 저장 + PWA 배포)는 Task 2~14가 엔진과 콘텐츠를, Task 15~19가 화면과 PWA를, Task 20이 배포를 덮는다. §2 전투 규칙 전체, §3.1 맵 제약, §3.3 노드 상호작용(기연·비급 제외), §5 기술 설계, §6 테스트·CI가 각각 대응 Task를 가진다.

**의도적으로 P1에서 뺀 것.** 기연·비급 노드, 고묘파·소림, 승단 15단, 메타 해금, 저주 카드, 보스 2단계 패턴, 게임패드. 전부 설계서에서 P2 이후로 배정된 항목이며 계획 앞머리에 명시했다.

**고친 것 세 가지.**
- 설계서 §2.5의 피해 순서에 연계 보너스 위치가 빠져 있었다. 기본값에 가산하는 것으로 확정하고 Global Constraints에 적었다.
- 「낡은 죽립」을 `mods.startBlock`으로 구현하면 `beginPlayerTurn`이 매 턴 적용하므로 `전투 시작 시`가 아니라 `매 턴 시작 시`가 된다. 기물 텍스트를 실제 동작에 맞췄다 (Task 9 Step 4).
- Task 15의 `이어하기` 버튼 초안이 `getState().view`를 직접 바꿔 렌더를 부르지 않는 버그가 있었다. `AppApi.resume()`을 추가하도록 같은 단계에 적어 뒀다.

**남은 위험 하나.** 카드 60장·기물 20종·적 17종의 수치는 표로 확정했지만 실제 밸런스는 Task 14의 자동 플레이와 Task 20 Step 7의 실제 완주에서만 검증된다. 완주율이 범위를 벗어나면 조정 대상은 **적 체력 → 보상 엽전 → 카드 피해** 순이다. 카드 수치를 먼저 건드리면 연계·상성 설계가 흔들린다.

