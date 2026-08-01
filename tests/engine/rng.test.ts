import { describe, it, expect } from 'vitest';
import { Rng, seedFrom, randomSeedText } from '../../src/engine/rng';

describe('Rng', () => {
  it('같은 시드는 같은 수열을 낸다', () => {
    const a = new Rng(seedFrom('강호'));
    const b = new Rng(seedFrom('강호'));
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('다른 시드는 다른 수열을 낸다', () => {
    const a = new Rng(seedFrom('강호'));
    const b = new Rng(seedFrom('무림'));
    expect(a.next()).not.toBe(b.next());
  });

  it('state를 복원하면 이후 수열이 이어진다', () => {
    const a = new Rng(seedFrom('복원'));
    a.next(); a.next(); a.next();
    const saved = a.state;
    const expected = [a.next(), a.next()];
    const restored = new Rng(saved);
    expect([restored.next(), restored.next()]).toEqual(expected);
  });

  it('next는 [0,1) 범위다', () => {
    const r = new Rng(seedFrom('범위'));
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n)은 0 이상 n 미만 정수다', () => {
    const r = new Rng(seedFrom('정수'));
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it('range(min,max)는 양끝을 포함한다', () => {
    const r = new Rng(seedFrom('구간'));
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(r.range(3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('shuffle은 원본을 바꾸지 않고 순열을 낸다', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const r = new Rng(seedFrom('셔플'));
    const out = r.shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(src);
    expect(out).not.toEqual(src);
  });

  it('weighted는 가중치 0인 항목을 절대 뽑지 않는다', () => {
    const r = new Rng(seedFrom('가중'));
    for (let i = 0; i < 500; i++) {
      expect(r.weighted([['a', 1], ['b', 0]] as const)).toBe('a');
    }
  });

  it('weighted는 가중치에 비례해 뽑는다', () => {
    const r = new Rng(seedFrom('비례'));
    let a = 0;
    for (let i = 0; i < 4000; i++) if (r.weighted([['a', 3], ['b', 1]] as const) === 'a') a++;
    expect(a / 4000).toBeGreaterThan(0.70);
    expect(a / 4000).toBeLessThan(0.80);
  });

  // 음절 6개 · 알파벳 12개 = 12^6 = 2,985,984가지. 생일 문제 근사
  // 1 - e^(-n(n-1)/(2N)) 에 n=50, N=2,985,984 를 넣으면 충돌 확률 ≈ 0.041%(1/2,439)다
  // — 정확도가 필요한 계산은 아니고(n≪N이라 근사가 실측과 거의 같다), 목표인
  // 1/1000 미만보다 24배 여유롭다. 그래도 `size === 50` 을 그대로 요구하는 대신
  // 충돌 1건까지 허용해(`>= 49`) 안전판을 하나 더 둔다 — 같은 근사로 충돌 2건
  // 이상(제거 후 남는 통계)이 나올 확률은 λ²/2 ≈ 8×10⁻⁸(1/1200만) 수준이라
  // 사실상 0인 반면, 시드 텍스트가 고정값이나 아주 작은 고정 집합에서만 나오는
  // 퇴행이 생기면 50개 중 다수가 겹쳐 이 문턱도 가볍게 넘는다.
  it('randomSeedText는 매번 다른 문자열을 낸다 (50개 중 충돌 1건까지는 허용)', () => {
    const set = new Set(Array.from({ length: 50 }, () => randomSeedText()));
    expect(set.size).toBeGreaterThanOrEqual(49);
  });
});
