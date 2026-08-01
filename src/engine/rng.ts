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

  /** 부모 스트림을 소비하지 않고 독립된 자식 스트림을 만든다. */
  fork(): Rng {
    return new Rng((Math.imul(this.state ^ 0x9e3779b9, 0x85ebca6b) >>> 0) + 1);
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

export function randomSeedText(): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += SEED_SYLLABLES[Math.floor(Math.random() * SEED_SYLLABLES.length)];
  }
  return `${out}-${Date.now().toString(36).slice(-4)}`;
}
