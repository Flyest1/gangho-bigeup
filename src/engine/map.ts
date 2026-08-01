import type { Rng } from './rng';

export type NodeType = 'battle' | 'elite' | 'rest' | 'shop' | 'boss';

export interface MapNode {
  id: string;
  layer: number;
  col: number;
  type: NodeType;
  next: string[];
}

export interface GameMap {
  act: number;
  layers: string[][];
  nodes: Record<string, MapNode>;
}

export const LAYER_WIDTHS = [1, 2, 2, 1, 1, 1] as const;

const MIDDLE_WEIGHTS: ReadonlyArray<readonly [NodeType, number]> = [
  ['battle', 65], ['elite', 15], ['rest', 12], ['shop', 8],
];

export function nodeAt(map: GameMap, id: string): MapNode {
  const node = map.nodes[id];
  if (!node) throw new Error(`알 수 없는 노드: ${id}`);
  return node;
}

/** 이 노드에 이 타입을 두면 어떤 부모 경로에서든 3연속이 되는가. */
function wouldTriple(
  type: NodeType, layer: number, parents: MapNode[], nodes: Record<string, MapNode>,
): boolean {
  if (layer < 2) return false;
  for (const parent of parents) {
    if (parent.type !== type) continue;
    const grandparents = Object.values(nodes).filter((n) => n.next.includes(parent.id));
    if (grandparents.some((g) => g.type === type)) return true;
  }
  return false;
}

export function generateMap(rng: Rng, act: number): GameMap {
  const nodes: Record<string, MapNode> = {};
  const layers: string[][] = [];

  for (let layer = 0; layer < LAYER_WIDTHS.length; layer++) {
    const width = LAYER_WIDTHS[layer]!;
    const ids: string[] = [];
    for (let col = 0; col < width; col++) {
      ids.push(`a${act}-${layer}-${col}`);
    }
    layers.push(ids);
  }

  // 간선을 먼저 놓는다. 각 노드는 다음 층에서 1~2개를 고르고, 다음 층은 전부 부모를 갖는다.
  for (let layer = 0; layer < layers.length - 1; layer++) {
    const current = layers[layer]!;
    const next = layers[layer + 1]!;
    const linked = new Set<string>();

    for (let i = 0; i < current.length; i++) {
      const span = next.length === 1 ? 1 : rng.range(1, Math.min(2, next.length));
      const start = next.length === 1 ? 0 : Math.min(i, next.length - span);
      const chosen = next.slice(start, start + span);
      for (const id of chosen) linked.add(id);
      nodes[current[i]!] = {
        id: current[i]!, layer, col: i, type: 'battle', next: [...chosen],
      };
    }

    for (const id of next) {
      if (linked.has(id)) continue;
      const parentId = rng.pick(current);
      const parent = nodes[parentId]!;
      parent.next = [...parent.next, id];
    }
  }

  const lastLayer = layers.length - 1;
  layers[lastLayer]!.forEach((id, col) => {
    nodes[id] = { id, layer: lastLayer, col, type: 'boss', next: [] };
  });

  // 타입을 정한다. 고정 층 먼저, 중간 층은 3연속을 피해 추첨.
  nodes[layers[0]![0]!]!.type = 'battle';
  nodes[layers[4]![0]!]!.type = 'rest';

  for (const layer of [1, 2, 3]) {
    for (const id of layers[layer]!) {
      const node = nodes[id]!;
      const parents = Object.values(nodes).filter((n) => n.next.includes(id));
      const safe = (t: NodeType): boolean => !wouldTriple(t, layer, parents, nodes);

      // 노드마다 정확히 한 번만 추첨한다. 3연속이 되면 안전한 타입 중 첫 번째로 대체한다.
      // 후보가 넷이고 앞선 경로는 최대 둘이므로 안전한 타입은 반드시 존재한다.
      let type = rng.weighted(MIDDLE_WEIGHTS);
      if (!safe(type)) {
        type = (['battle', 'elite', 'rest', 'shop'] as NodeType[]).find(safe) ?? 'battle';
      }
      node.type = type;
    }
  }

  return { act, layers, nodes };
}
