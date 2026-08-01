// src/ui/components/bars.ts
//
// 여러 구역이 함께 쓰는 표시 원자 두 개. 체력·호신강기 막대는 상단바와 적 열이
// 같은 모양을 써야 하고, 상태 배지도 플레이어와 적이 같은 규칙으로 읽혀야 한다.
// 브리핑의 파일 목록에는 없지만 enemy.ts 안에 플레이어용 위젯을 두는 쪽이 더
// 나쁘다고 판단해 따로 뺐다.
import { STATUS_META } from '../../engine/status';
import { getStatus } from '../../engine/status';
import type { StatusId, StatusMap } from '../../engine/types';
import { el } from '../dom';

export interface MeterOpts {
  /** 스크린리더가 읽을 이름. 예: `체력`. */
  label: string;
  value: number;
  max: number;
  className?: string;
  /** 막대 위에 겹쳐 쓰는 글자. 없으면 `값 / 최대`. */
  text?: string;
}

/**
 * `role="meter"` 막대. 접근성 요구가 aria-valuenow/min/max 를 모두 요구하므로
 * 셋을 한 곳에서만 만든다. 호신강기처럼 상한이 명확하지 않은 값은 현재 값이
 * max 를 넘길 수 있어, 넘치면 max 를 현재 값까지 늘려 aria 값이 모순되지 않게 한다.
 */
export function renderMeter(opts: MeterOpts): HTMLElement {
  const max = Math.max(1, opts.max, opts.value);
  const value = Math.max(0, Math.min(opts.value, max));
  const text = opts.text ?? `${opts.value} / ${opts.max}`;

  const fill = el('span', { class: 'meter-fill' });
  fill.style.width = `${(value / max) * 100}%`;

  const node = el('span', { class: opts.className ? `meter ${opts.className}` : 'meter' }, [
    fill,
    el('span', { class: 'meter-text', textContent: text }),
  ]);
  node.setAttribute('role', 'meter');
  node.setAttribute('aria-label', `${opts.label} ${text}`);
  node.setAttribute('aria-valuenow', String(value));
  node.setAttribute('aria-valuemin', '0');
  node.setAttribute('aria-valuemax', String(max));
  node.setAttribute('aria-valuetext', text);
  return node;
}

// 표시 순서를 엔진의 STATUS_META 선언 순서에서 끌어온다. 여기에 목록을 따로
// 적어두면 상태가 하나 늘 때마다 조용히 빠진다.
const STATUS_ORDER = Object.keys(STATUS_META) as StatusId[];

/** 상태 배지 줄. 색이 아니라 한자+수치로 구분한다. */
export function renderStatusBadges(status: StatusMap, opts: { empty?: string } = {}): HTMLElement {
  const box = el('span', { class: 'badges' });
  let shown = 0;

  for (const id of STATUS_ORDER) {
    const stacks = getStatus(status, id);
    if (stacks <= 0) continue;
    shown++;
    const meta = STATUS_META[id];
    const badge = el('span', {
      class: `badge ${meta.harmful ? 'harmful' : 'boon'}`,
      title: `${meta.name} ${meta.hanja} ${stacks} — ${meta.text}`,
    }, [
      el('span', { class: 'badge-hanja', textContent: meta.hanja }),
      el('span', { class: 'badge-count', textContent: String(stacks) }),
    ]);
    badge.setAttribute('role', 'img');
    badge.setAttribute('aria-label', `${meta.name} ${stacks}`);
    box.append(badge);
  }

  if (shown === 0 && opts.empty) {
    box.append(el('span', { class: 'badge-empty', textContent: opts.empty }));
  }
  return box;
}
