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
 * 소스에서 주석만 지운다. 문자열·템플릿 리터럴 안의 `//` 와 `/*` 는 건드리지 않고,
 * 템플릿 리터럴은 여러 줄에 걸치므로 상태를 줄 경계 너머로 이어간다. 줄 번호를
 * 유지해야 하므로 지운 자리는 같은 길이의 공백으로 채우고 개행만 남긴다.
 *
 * 정규식으로도, 줄 단위 스캔으로도 이 일은 되지 않는다. 둘 다 시도했고 둘 다
 * 실제 위반을 주석으로 오인해 삼켰다 — 가드가 위반을 못 보는 방향으로 실패한다.
 * 알려진 한계: 정규식 리터럴 안의 `//` 는 여전히 주석으로 읽힌다. 현재 엔진에는
 * 정규식 리터럴이 없다.
 */
function stripComments(src) {
  let out = '';
  let mode = 'code'; // 'code' | 'line' | 'block' | 'quote'
  let quote = null;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];

    if (mode === 'line') {
      if (c === '\n') { out += '\n'; mode = 'code'; } else out += ' ';
      continue;
    }
    if (mode === 'block') {
      if (c === '*' && next === '/') { out += '  '; i++; mode = 'code'; }
      else out += c === '\n' ? '\n' : ' ';
      continue;
    }
    if (mode === 'quote') {
      out += c;
      if (c === '\\' && next !== undefined) { out += next; i++; continue; }
      if (c === quote) { mode = 'code'; quote = null; }
      continue;
    }

    if (c === '/' && next === '/') { out += '  '; i++; mode = 'line'; continue; }
    if (c === '/' && next === '*') { out += '  '; i++; mode = 'block'; continue; }
    if (c === '"' || c === "'" || c === '`') { out += c; mode = 'quote'; quote = c; continue; }
    out += c;
  }

  return out;
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
