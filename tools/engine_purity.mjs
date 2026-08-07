// tools/engine_purity.mjs
//
// 엔진 순수성 검사의 알맹이. CLI(check_engine_purity.mjs)와 분리해 둔 이유는
// 하나다 — 이 규칙들에 테스트를 붙일 수 있게 하려고. Task 14에서 이 검사기는
// 다섯 번 고쳐졌고 매번 fail-open 방향으로 새어 나갔는데, 정작 가드 자체를
// 검증하는 수단이 없었다. 이제 tests/engine/purity-guard.test.ts 가 임시
// 디렉터리에 픽스처를 써서 아래 규칙들을 직접 겨눈다.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

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
export const BANNED_GLOBALS = new Set([
  'document', 'window', 'localStorage', 'navigator',
  // 문자열 우회로. `globalThis["document"]` 나 `new Function('return document')`
  // 는 AST 에서 식별자가 아니라 문자열이라 위의 네 이름으로는 잡히지 않는다.
  // 엔진에는 이 넷의 정당한 쓰임이 없으므로 이름 자체를 막는다. `self` 는
  // 브라우저에서 window 와 같은 것을 가리키므로 globalThis 와 같은 부류다 —
  // 지역 변수 이름으로도 쓰지 못하게 되지만(combat.ts 의 그 변수는 `actor` 로
  // 바꿨다), 넓게 잡아 오탐하는 쪽이 놓치는 쪽보다 낫다는 이 파일의 기존
  // 판단을 그대로 따른다.
  'globalThis', 'self', 'eval', 'Function',
]);

export const ALLOW_MARK = 'purity-allow';
export const ALLOW_LIMIT = 1;

// 대소문자를 가리면 Windows 에서만 통과하고 Linux CI 에서 조용히 놓친다.
// `.jsx` 는 Vite 가 그대로 번들하므로 스캔 대상에 든다.
const SCANNED = /\.(ts|tsx|jsx|mts|cts|js|mjs|cjs)$/i;

/**
 * 하위 디렉터리까지 훑는다. `readdirSync` 한 번으로 끝내고 `.ts` 만 보면,
 * 하위 디렉터리나 `.tsx`·`.mts`·`.js` 파일은 tsconfig 가 컴파일해 배포까지
 * 가는데 가드만 못 본다. 순수한 fail-open 이다.
 */
function collect(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (SCANNED.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * @param dir 훑을 디렉터리(절대 경로).
 * @param opts.label 문제 메시지에 붙일 경로 접두사.
 * @param opts.allowLimit `purity-allow` 로 면제할 수 있는 **위반의 개수**.
 * @returns 사람이 읽을 문제 목록. 비어 있으면 통과.
 */
export function checkPurity(dir, opts = {}) {
  const label = opts.label ?? 'src/engine';
  const allowLimit = opts.allowLimit ?? ALLOW_LIMIT;

  const problems = [];
  // 표식이 붙은 *줄 수*가 아니라 그 표식으로 **면제된 위반의 수**를 센다.
  // 예전 구현은 줄을 셌고, 그래서 축복받은 그 한 줄에 금지 참조를 몇 개든
  // 덧붙일 수 있었다 — 개수와 무관하게 통과하는 fail-open 이었다.
  let waived = 0;

  for (const file of collect(dir)) {
    const name = relative(dir, file).replace(/\\/g, '/');
    const source = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true);
    const lines = source.split('\n');

    const report = (node, why) => {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      if (lines[line]?.includes(ALLOW_MARK)) {
        waived++;
        return;
      }
      problems.push(`${label}/${name}:${line + 1} — ${why}`);
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
      // 정당한 쓰임이 없다.
      if (ts.isIdentifier(node) && BANNED_GLOBALS.has(node.text)) {
        report(node, `${node.text} 참조`);
      }

      ts.forEachChild(node, visit);
    };

    visit(sf);
  }

  if (waived > allowLimit) {
    problems.push(
      `${ALLOW_MARK} 로 면제된 위반이 ${waived}개다. 허용치는 ${allowLimit}개뿐이다`,
    );
  }

  return problems;
}
