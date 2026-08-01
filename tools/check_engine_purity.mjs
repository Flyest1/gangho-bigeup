import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENGINE = fileURLToPath(new URL('../src/engine/', import.meta.url));
const BANNED = [
  { re: /\bdocument\b/, why: 'document 참조' },
  { re: /\bwindow\b/, why: 'window 참조' },
  { re: /\blocalStorage\b/, why: 'localStorage 참조' },
  { re: /\bnavigator\b/, why: 'navigator 참조' },
  { re: /Math\.random\s*\(/, why: 'Math.random 직접 호출' },
];
/**
 * 예외는 줄 단위 표식으로만 낸다. 파일 단위로 규칙을 끄면 같은 파일에 두 번째
 * 위반이 들어와도 조용히 통과한다. 표식 총 개수도 아래에서 못박는다.
 */
const ALLOW_MARK = 'purity-allow';
const ALLOW_LIMIT = 1;

/**
 * 주석을 지운 사본을 만든다. 줄 번호를 유지해야 하므로 블록 주석은 공백으로 덮는다.
 * 앞서 `*` 로 시작하는 줄을 통째로 건너뛰던 방식은 여러 줄에 걸친 곱셈식
 * (`base` 다음 줄이 `* window.innerWidth`) 을 주석으로 오인해 실제 위반을 놓쳤다.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const problems = [];
let allowCount = 0;

for (const name of readdirSync(ENGINE)) {
  if (!name.endsWith('.ts')) continue;
  const raw = readFileSync(join(ENGINE, name), 'utf8');
  const rawLines = raw.split('\n');
  stripComments(raw).split('\n').forEach((line, i) => {
    for (const { re, why } of BANNED) {
      if (!re.test(line)) continue;
      if (rawLines[i]?.includes(ALLOW_MARK)) { allowCount++; continue; }
      problems.push(`src/engine/${name}:${i + 1} — ${why}`);
    }
  });
}

if (allowCount > ALLOW_LIMIT) {
  problems.push(`${ALLOW_MARK} 표식이 ${allowCount}개다. 허용치는 ${ALLOW_LIMIT}개뿐이다`);
}

if (problems.length) {
  console.error('엔진 순수성 위반:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('엔진 순수성 통과 — DOM·전역 난수 참조 없음');
