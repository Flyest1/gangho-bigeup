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
