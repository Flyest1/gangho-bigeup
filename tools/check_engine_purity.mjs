// tools/check_engine_purity.mjs
//
// CLI 껍데기. 규칙 자체는 engine_purity.mjs 에 있고(테스트가 그쪽을 겨눈다),
// 여기서는 어느 디렉터리를 볼지 정하고 결과를 사람이 읽을 모양으로 낼 뿐이다.
import { fileURLToPath } from 'node:url';
import { checkPurity } from './engine_purity.mjs';

// new URL(...).pathname 은 Windows 에서 `/C:/...` 를 내놓아 경로가 깨진다.
const ENGINE = fileURLToPath(new URL('../src/engine/', import.meta.url));

const problems = checkPurity(ENGINE, { label: 'src/engine' });

if (problems.length) {
  console.error('엔진 순수성 위반:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('엔진 순수성 통과 — DOM·전역 난수 참조 없음');
