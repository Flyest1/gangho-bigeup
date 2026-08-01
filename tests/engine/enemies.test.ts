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

  it('가중 추첨으로 행동을 선택한다', () => {
    const e = spawnEnemy(def, 'e1', new Rng(1)); // empty history, no constraints
    const results: { bite: number; howl: number } = { bite: 0, howl: 0 };
    const sampleSize = 400;

    for (let i = 0; i < sampleSize; i++) {
      const intent = chooseIntent(def, e, new Rng(seedFrom(`weighted${i}`)));
      results[intent.actionId as keyof typeof results]++;
    }

    // Both actions should appear
    expect(results.bite).toBeGreaterThan(0);
    expect(results.howl).toBeGreaterThan(0);

    // bite has weight 3, howl has weight 1, so bite should be ~75%
    const biteShare = results.bite / sampleSize;
    expect(biteShare).toBeGreaterThan(0.68); // conservative band for 400 samples
    expect(biteShare).toBeLessThan(0.82);
  });
});
