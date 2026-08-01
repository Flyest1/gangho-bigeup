import { describe, it, expect } from 'vitest';
import { generateMap, nodeAt, LAYER_WIDTHS } from '../../src/engine/map';
import { Rng, seedFrom } from '../../src/engine/rng';
import type { GameMap } from '../../src/engine/map';

function build(seed: string, act = 1): GameMap {
  return generateMap(new Rng(seedFrom(seed)), act);
}

const SEEDS = Array.from({ length: 60 }, (_, i) => `맵${i}`);

describe('구조', () => {
  it('층 너비가 정의대로다', () => {
    expect([...LAYER_WIDTHS]).toEqual([1, 2, 2, 1, 1, 1]);
  });

  it('노드가 8개다', () => {
    for (const s of SEEDS) expect(Object.keys(build(s).nodes)).toHaveLength(8);
  });

  it('첫 층은 격전, 마지막 앞은 객잔, 마지막은 관문이다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      expect(nodeAt(m, m.layers[0]![0]!).type).toBe('battle');
      expect(nodeAt(m, m.layers[4]![0]!).type).toBe('rest');
      expect(nodeAt(m, m.layers[5]![0]!).type).toBe('boss');
    }
  });

  it('관문은 각 막에 하나뿐이다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      expect(Object.values(m.nodes).filter((n) => n.type === 'boss')).toHaveLength(1);
    }
  });

  it('막 번호가 보존된다', () => {
    expect(build('x', 3).act).toBe(3);
  });
});

describe('간선', () => {
  it('마지막 층을 뺀 모든 노드가 다음 노드를 가진다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      for (const n of Object.values(m.nodes)) {
        if (n.layer === LAYER_WIDTHS.length - 1) expect(n.next).toHaveLength(0);
        else expect(n.next.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('간선은 바로 다음 층으로만 간다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      for (const n of Object.values(m.nodes)) {
        for (const id of n.next) expect(nodeAt(m, id).layer).toBe(n.layer + 1);
      }
    }
  });

  it('첫 층에서 관문까지 도달 가능하다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      const seen = new Set<string>();
      const stack = [m.layers[0]![0]!];
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        stack.push(...nodeAt(m, id).next);
      }
      expect(seen.has(m.layers[5]![0]!)).toBe(true);
    }
  });

  it('모든 노드가 도달 가능하다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      const incoming = new Set(Object.values(m.nodes).flatMap((n) => n.next));
      for (const n of Object.values(m.nodes)) {
        if (n.layer > 0) expect(incoming.has(n.id)).toBe(true);
      }
    }
  });
});

describe('타입 분포', () => {
  it('같은 타입이 한 경로에서 3연속 나오지 않는다', () => {
    // 이 성질은 시드 수십 개로 확인되지 않는다. 초기 구현이 4층 객잔 고정을
    // 고려하지 않아 약 2.2%의 시드에서 객잔 3연속이 나왔는데, 고정 시드 60개는
    // 전부 비껴갔다. 넓게 쓸어야 실제로 무는 테스트가 된다.
    const wide = Array.from({ length: 3000 }, (_, i) => `삼연속${i}`);
    for (const s of wide) {
      const m = build(s);
      const walk = (id: string, trail: string[]): void => {
        const n = nodeAt(m, id);
        const next = [...trail, n.type];
        const k = next.length;
        if (k >= 3) expect(new Set(next.slice(k - 3)).size).toBeGreaterThan(1);
        for (const child of n.next) walk(child, next);
      };
      walk(m.layers[0]![0]!, []);
    }
  });

  it('중간 층은 다섯 타입 중 관문이 아닌 것만 쓴다', () => {
    for (const s of SEEDS) {
      const m = build(s);
      for (const layer of [1, 2, 3]) {
        for (const id of m.layers[layer]!) {
          expect(['battle', 'elite', 'rest', 'shop']).toContain(nodeAt(m, id).type);
        }
      }
    }
  });

  it('60개 시드에서 정예와 장터가 모두 등장한다', () => {
    const types = new Set(SEEDS.flatMap((s) => Object.values(build(s).nodes).map((n) => n.type)));
    expect(types.has('elite')).toBe(true);
    expect(types.has('shop')).toBe(true);
  });
});

describe('결정성', () => {
  it('같은 시드는 같은 맵을 만든다', () => {
    expect(build('동일')).toEqual(build('동일'));
  });

  it('다른 시드는 대체로 다른 맵을 만든다', () => {
    const shapes = new Set(SEEDS.map((s) => JSON.stringify(build(s))));
    expect(shapes.size).toBeGreaterThan(30);
  });
});
