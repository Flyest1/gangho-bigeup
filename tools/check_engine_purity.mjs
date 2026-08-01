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
 * 한 줄에서 주석 부분만 잘라낸다. 문자열 안의 `//` 는 건드리지 않는다.
 * 정규식으로 `//` 뒤를 통째로 버리면 `"a//b" + window.location` 같은 줄에서
 * 실제 위반이 주석으로 오인돼 통째로 사라진다. 가드가 열린 채 실패하는 셈이다.
 */
function stripLineComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

/**
 * 주석을 지운 사본을 만든다. 줄 번호를 유지해야 하므로 블록 주석은 공백으로 덮는다.
 * 앞서 `*` 로 시작하는 줄을 통째로 건너뛰던 방식은 여러 줄에 걸친 곱셈식
 * (`base` 다음 줄이 `* window.innerWidth`) 을 주석으로 오인해 실제 위반을 놓쳤다.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map(stripLineComment)
    .join('\n');
}

const problems = [];
let allowCount = 0;

for (const name of readdirSync(ENGINE)) {
  if (!name.endsWith('.ts')) continue;
  const raw = readFileSync(join(ENGINE, name), 'utf8');
  const rawLines = raw.split('\n');
  stripComments(raw).split('\n').forEach((line, i) => {
    let marked = false;
    for (const { re, why } of BANNED) {
      if (!re.test(line)) continue;
      // 표식은 줄당 한 번만 센다. 한 줄이 규칙 두 개에 걸린다고 허용치를 두 번
      // 깎으면, 정당한 예외 하나짜리 파일이 헛되이 검사에 걸린다.
      if (rawLines[i]?.includes(ALLOW_MARK)) { marked = true; continue; }
      problems.push(`src/engine/${name}:${i + 1} — ${why}`);
    }
    if (marked) allowCount++;
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
