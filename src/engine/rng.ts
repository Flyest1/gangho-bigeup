/** mulberry32. state 하나로 완전히 재현되는 32비트 PRNG. */
export class Rng {
  constructor(public state: number) {
    this.state = state >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }

  range(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }

  pick<T>(items: readonly T[]): T {
    const item = items[this.int(items.length)];
    if (item === undefined) throw new Error('Rng.pick: 빈 배열');
    return item;
  }

  /** Fisher-Yates. 원본을 변경하지 않고 새 배열을 반환한다. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const a = out[i]!;
      const b = out[j]!;
      out[i] = b;
      out[j] = a;
    }
    return out;
  }

  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
    if (total <= 0) throw new Error('Rng.weighted: 가중치 합이 0');
    let roll = this.next() * total;
    for (const [value, weight] of entries) {
      roll -= Math.max(0, weight);
      if (roll < 0) return value;
    }
    return entries[entries.length - 1]![0];
  }
}

export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const SEED_SYLLABLES = ['강', '호', '무', '림', '검', '도', '풍', '운', '설', '월', '영', '협'];

// 이 파일에서 Math.random 을 쓰는 유일한 지점이다. 런의 시작 시드를 뽑는 곳이며,
// 이후 게임의 모든 난수는 이 시드에서 파생되므로 런 자체는 여전히 재현 가능하다.
// tools/check_engine_purity.mjs 가 아래 줄의 purity-allow 표식만 허용한다 (파일 전체가 아니다).
//
// 음절 4개(12^4 = 20,736가지)에 Date.now() 접미사를 더했던 이전 버전은, 동기 루프
// 안에서 여러 번 부르면 Date.now() 가 사실상 상수가 되어 순전히 음절 공간에만
// 기대는 것과 같았다. 50번 뽑았을 때 생일 문제 충돌 확률이 1 - e^(-50·49/(2·20736))
// ≈ 5.7% 로, vitest 전체 스위트를 몇 번 돌리면 반드시 한 번은 실패하는 수준이었다.
// 음절 6개(12^6 = 2,985,984가지)로 늘리면 같은 계산으로 충돌 확률이
// 1 - e^(-50·49/(2·2,985,984)) ≈ 0.041%(약 1/2,439)까지 떨어진다 — 목표(1/1000
// 미만)보다 24배 여유롭다. 접미사는 실질적인 엔트로피를 더하지 못하므로 뺐다.
export function randomSeedText(): string {
  return Array.from(
    { length: 6 },
    () => SEED_SYLLABLES[Math.floor(Math.random() * SEED_SYLLABLES.length)]!, // purity-allow: 런 시작 시드
  ).join('');
}
