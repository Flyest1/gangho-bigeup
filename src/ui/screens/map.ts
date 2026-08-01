// src/ui/screens/map.ts
//
// 6층을 세로로 쌓아 그린다. 0층(첫 격전)이 화면 위, 5층(관문)이 아래 — "현재
// 위치 아래층의 갈 수 있는 노드만 활성화한다"는 브리핑 문구를 그대로 화면
// 배치로 옮긴 것이다. 갈 수 있는지는 전부 `availableNodes` 가 낸 목록을
// 그대로 따르고, 여기서 도달 가능 여부를 다시 계산하지 않는다.
import { availableNodes, effectiveMaxHp, type RunState } from '../../engine/run';
import { nodeAt, type MapNode, type NodeType } from '../../engine/map';
import { CONTENT } from '../../engine/gamedata';
import type { AppApi } from '../app';
import { el, trapFocus } from '../dom';
import { renderDeckList } from '../components/deckview';

const NODE_META: Record<NodeType, { icon: string; label: string }> = {
  battle: { icon: '⚔', label: '격전' },
  elite: { icon: '✦', label: '정예' },
  rest: { icon: '⌂', label: '객잔' },
  shop: { icon: '⚖', label: '장터' },
  boss: { icon: '▣', label: '관문' },
};

type NodeStatus = 'current' | 'reachable' | 'past' | 'locked';

export function renderMap(api: AppApi, run: RunState): HTMLElement {
  const root = el('main', { class: 'screen map' });
  const reachable = new Set(availableNodes(run));
  const currentLayer = run.currentNodeId === null ? -1 : nodeAt(run.map, run.currentNodeId).layer;

  function statusOf(node: MapNode): NodeStatus {
    if (node.id === run.currentNodeId) return 'current';
    if (node.layer <= currentLayer) return 'past';
    return reachable.has(node.id) ? 'reachable' : 'locked';
  }

  function nodeButton(node: MapNode, col: number, width: number): HTMLElement {
    const meta = NODE_META[node.type];
    const status = statusOf(node);
    const btn = el('button', {
      class: `map-node type-${node.type} status-${status}`,
      type: 'button',
      disabled: status !== 'reachable',
    }, [
      el('span', { class: 'map-node-icon', textContent: meta.icon, aria: { hidden: 'true' } }),
      el('span', { class: 'map-node-label', textContent: meta.label }),
    ]);

    const posSuffix = width > 1 ? `, ${col + 1}/${width}번째 길` : '';
    const statusSuffix = status === 'current' ? ', 현재 위치'
      : status === 'reachable' ? ', 갈 수 있음'
      : status === 'past' ? ', 지나온 자리'
      : ', 아직 갈 수 없음';
    btn.setAttribute('aria-label', `${meta.label} 노드${posSuffix}${statusSuffix}`);
    if (status === 'current') btn.setAttribute('aria-current', 'location');
    if (status === 'reachable') {
      btn.addEventListener('click', () => api.dispatch({ type: 'chooseNode', nodeId: node.id }));
    }
    return btn;
  }

  function layers(): HTMLElement {
    const wrap = el('div', { class: 'map-layers' });
    run.map.layers.forEach((ids, layerIdx) => {
      const row = el('div', { class: 'map-layer' });
      row.setAttribute('aria-label', `${layerIdx + 1}층`);
      ids.forEach((id, col) => row.append(nodeButton(nodeAt(run.map, id), col, ids.length)));
      wrap.append(row);
    });
    return wrap;
  }

  function topBar(onOpenDeck: () => void): HTMLElement {
    const stats = el('div', { class: 'map-stats' }, [
      el('span', { class: 'map-stat', textContent: `체력 ${run.player.hp} / ${effectiveMaxHp(run, CONTENT)}` }),
      el('span', { class: 'map-stat', textContent: `엽전 ${run.player.gold}` }),
      el('span', { class: 'map-stat', textContent: `${run.act}막` }),
    ]);
    const deckBtn = el('button', { class: 'btn quiet', type: 'button', textContent: '덱 보기' });
    deckBtn.addEventListener('click', onOpenDeck);
    return el('header', { class: 'topbar map-topbar' }, [stats, deckBtn]);
  }

  function deckOverlay(onClose: () => void): HTMLElement {
    const close = el('button', { class: 'btn', type: 'button', textContent: '닫기' });
    close.addEventListener('click', onClose);

    const box = el('div', { class: 'modal-view' }, [
      el('div', { class: 'modal-head' }, [
        el('h2', { textContent: `덱 ${run.player.deck.length}장` }),
        close,
      ]),
      renderDeckList(run.player.deck, { emptyText: '덱이 비어 있다.' }),
    ]);
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', '덱 보기');
    box.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    });
    return box;
  }

  function openDeckView(): void {
    let untrap: (() => void) | null = null;
    const overlay = deckOverlay(() => {
      untrap?.();
      overlay.remove();
    });
    root.append(overlay);
    untrap = trapFocus(overlay);
  }

  root.append(topBar(openDeckView), layers());

  return root;
}
