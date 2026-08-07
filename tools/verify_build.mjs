// tools/verify_build.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// new URL(...).pathname 은 Windows 에서 `/C:/...` 를 내놓아 경로가 깨진다.
// check_engine_purity.mjs 에서 이미 적용한 것과 같은 수정이다. POSIX(Linux CI
// 러너)에서는 fileURLToPath 와 .pathname 의 결과가 같으므로 CI 쪽 동작은
// 그대로다.
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const problems = [];

if (!existsSync(`${dist}index.html`)) problems.push('index.html 없음');
if (!existsSync(`${dist}manifest.webmanifest`)) problems.push('매니페스트 없음');
if (!existsSync(`${dist}sw.js`)) problems.push('서비스워커 없음');

for (const icon of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
  if (!existsSync(dist + icon)) problems.push(`아이콘 없음: ${icon}`);
}

const html = existsSync(`${dist}index.html`) ? readFileSync(`${dist}index.html`, 'utf8') : '';
if (!html.includes('/gangho-bigeup/')) problems.push('base 경로가 적용되지 않았다');

// iOS 홈 화면 아이콘. 소스에는 `/apple-touch-icon.png` 로 적혀 있고 base 접두사는
// Vite 가 붙인다 — 그 변환이 실제로 일어났는지는 dist 에서만 확인할 수 있다.
if (!/rel="apple-touch-icon"/.test(html)) problems.push('apple-touch-icon 링크 없음');
else if (!html.includes('/gangho-bigeup/apple-touch-icon.png')) {
  problems.push('apple-touch-icon 링크에 base 경로가 붙지 않았다');
}

// 마스커블 아이콘이 icon-512 와 바이트 단위로 같으면 안전지대가 없다는 뜻이다
// (안드로이드가 원형으로 잘라내면 테두리 네 모서리가 날아간다). 내용이 실제로
// 안전지대 안에 드는지는 tests/engine/pwa-assets.test.ts 가 픽셀에서 확인한다.
if (existsSync(`${dist}icon-maskable-512.png`) && existsSync(`${dist}icon-512.png`)) {
  const maskable = readFileSync(`${dist}icon-maskable-512.png`);
  if (maskable.equals(readFileSync(`${dist}icon-512.png`))) {
    problems.push('마스커블 아이콘이 icon-512 와 같다 (안전지대 없음)');
  }
}

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
