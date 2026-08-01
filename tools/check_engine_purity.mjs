// tools/check_engine_purity.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// new URL(...).pathname 은 Windows 에서 `/C:/...` 를 내놓아 경로가 깨진다.
const ENGINE = fileURLToPath(new URL('../src/engine/', import.meta.url));

/**
 * 주석과 문자열을 손으로 걷어내려는 시도를 세 번 했고 세 번 다 같은 방향으로
 * 실패했다. 정규식, 줄 단위 스캐너, 파일 단위 상태 기계 — 매번 실제 코드를
 * 주석으로 오인해 위반을 삼켰고, 매번 더 좁은 입구로 다시 뚫렸다
 * (`"a//b"`, 여러 줄 템플릿 리터럴, `${}` 안의 중첩 템플릿).
 *
 * 그래서 직접 파싱하지 않는다. typescript 는 이미 devDependency 이고 바로 이
 * 파일들을 컴파일한다. 진짜 파서를 태우면 주석은 AST 에 아예 없고 문자열
 * 리터럴은 식별자가 아니므로, 이 부류의 누수가 구조적으로 불가능해진다.
 */
const BANNED_GLOBALS = new Set(['document', 'window', 'localStorage', 'navigator']);

const ALLOW_MARK = 'purity-allow';
const ALLOW_LIMIT = 1;

const problems = [];
const markedLines = new Set();

for (const name of readdirSync(ENGINE)) {
  if (!name.endsWith('.ts')) continue;

  const source = readFileSync(join(ENGINE, name), 'utf8');
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true);
  const lines = source.split('\n');

  const report = (node, why) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    if (lines[line]?.includes(ALLOW_MARK)) {
      markedLines.add(`${name}:${line}`);
      return;
    }
    problems.push(`src/engine/${name}:${line + 1} — ${why}`);
  };

  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Math' &&
      node.name.text === 'random'
    ) {
      report(node, 'Math.random 직접 호출');
    }

    // 이 이름이 붙은 식별자는 위치를 가리지 않고 전부 잡는다. 속성 접근
    // (`globalThis.document`) 도, 선언 (`const window = ...`) 도 엔진에서는
    // 정당한 쓰임이 없다. 넓게 잡아 오탐하는 쪽이 놓치는 쪽보다 낫다.
    if (ts.isIdentifier(node) && BANNED_GLOBALS.has(node.text)) {
      report(node, `${node.text} 참조`);
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);
}

if (markedLines.size > ALLOW_LIMIT) {
  problems.push(`${ALLOW_MARK} 표식이 ${markedLines.size}개다. 허용치는 ${ALLOW_LIMIT}개뿐이다`);
}

if (problems.length) {
  console.error('엔진 순수성 위반:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('엔진 순수성 통과 — DOM·전역 난수 참조 없음');
