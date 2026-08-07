// 순수성 가드 자체의 테스트. Task 14에서 이 검사기는 다섯 번 고쳐졌고 매번 같은
// 방향으로 새어 나갔다(실제 코드를 주석으로 오인해 위반을 삼킴). 그때 결론은
// "손으로 파싱하지 말고 TypeScript AST를 태운다"였는데, 정작 가드 자체에는
// 테스트가 없었다 — CI 인프라라 화면에 안 나온다는 이유로. fail-open 하는 가드는
// 없는 가드보다 나쁘므로 여기서 계약을 고정한다.
//
// 픽스처는 리포에 파일로 두지 않고 임시 디렉터리에 그때그때 쓴다. `document`를
// 참조하는 .ts 파일을 tests/ 아래 두면 tsc --noEmit이 그것까지 타입체크하고,
// 확장자 대소문자 픽스처(.TS)는 Windows와 Linux에서 서로 다르게 보인다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPurity } from '../../tools/engine_purity.mjs';

let dir: string;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'purity-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** 픽스처 파일 하나를 쓴다. 이름에 `/`가 있으면 하위 디렉터리도 만든다. */
function write(name: string, source: string): void {
  const full = join(dir, name);
  const slash = name.lastIndexOf('/');
  if (slash >= 0) mkdirSync(join(dir, name.slice(0, slash)), { recursive: true });
  writeFileSync(full, source, 'utf8');
}

function problems(): string[] {
  return checkPurity(dir, { label: 'fixture' });
}

describe('순수성 가드 — 기존 계약', () => {
  it('깨끗한 파일은 통과한다', () => {
    write('pure.ts', 'export const add = (a: number, b: number) => a + b;\n');
    expect(problems()).toEqual([]);
  });

  it('Math.random 직접 호출을 잡는다', () => {
    write('dirty.ts', 'export const roll = () => Math.random();\n');
    expect(problems().join()).toContain('Math.random');
  });

  it('document 참조를 잡는다', () => {
    write('dirty.ts', 'export const q = () => document.body;\n');
    expect(problems().join()).toContain('document');
  });

  it('주석과 문자열 안의 금지어는 잡지 않는다 (AST를 타는 이유)', () => {
    write('ok.ts', [
      '// document 를 쓰지 않는다',
      'export const label = "window";',
      'export const tricky = `a//b ${"localStorage"} c`;',
      '/* navigator */',
    ].join('\n'));
    expect(problems()).toEqual([]);
  });

  it('하위 디렉터리도 훑는다', () => {
    write('sub/deep/dirty.ts', 'export const w = window.innerWidth;\n');
    expect(problems().join()).toContain('window');
  });
});

describe('순수성 가드 — Task 14에서 미뤄 둔 구멍', () => {
  it('self 를 전역 벼락치기 통로로 쓰는 것을 잡는다', () => {
    // globalThis["document"] 는 globalThis 이름 자체를 막아 잡혔지만, self 는
    // 목록에 없어 그대로 통과했다. 브라우저에서 self 는 window 와 같은 것을 가리킨다.
    write('bypass.ts', 'export const d = self["document"];\n');
    expect(problems().join()).toContain('self');
  });

  it('.jsx 파일도 스캔한다', () => {
    // Vite 가 .jsx 를 그대로 번들한다. 가드만 못 보면 배포까지 그대로 나간다.
    write('sneaky.jsx', 'export const d = document.title;\n');
    expect(problems().join()).toContain('document');
  });

  it('확장자가 대문자여도 스캔한다', () => {
    // 대소문자를 가리면 Windows 에서는 잘 돌다가 Linux CI 에서만 조용히 놓친다.
    write('SHOUT.TS', 'export const d = document.title;\n');
    expect(problems().join()).toContain('document');
  });

  it('purity-allow 한 줄에 위반을 여러 개 얹어도 한 개만 면제된다', () => {
    // 예전 구현은 표식이 붙은 *줄 수*를 셌다. 그래서 축복받은 그 한 줄에 금지
    // 참조를 덧붙이면 개수와 무관하게 통과했다 — 순수한 fail-open.
    write('greedy.ts', 'export const x = [Math.random(), document.title]; // purity-allow: 시드\n');
    const found = problems().join();
    expect(found).toContain('purity-allow');
    expect(found).toContain('2');
  });

  it('purity-allow 한 줄에 위반 하나는 그대로 면제된다 (rng.ts 가 쓰는 길)', () => {
    write('blessed.ts', 'export const seed = () => Math.random(); // purity-allow: 런 시작 시드\n');
    expect(problems()).toEqual([]);
  });

  it('표식이 붙은 줄이 둘이면 통과하지 못한다', () => {
    write('two.ts', [
      'export const a = () => Math.random(); // purity-allow: 하나',
      'export const b = () => Math.random(); // purity-allow: 둘',
    ].join('\n'));
    expect(problems().join()).toContain('purity-allow');
  });
});
