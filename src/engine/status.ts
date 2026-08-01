import type { StatusId, StatusMap } from './types';

export interface StatusMeta {
  name: string;
  hanja: string;
  decay: 'perTurn' | 'onUse' | 'never';
  harmful: boolean;
  text: string;
}

export const STATUS_META: Record<StatusId, StatusMeta> = {
  poison: {
    name: '중독', hanja: '毒', decay: 'perTurn', harmful: true,
    text: '턴 시작 시 스택만큼 체력이 깎인다. 호신강기로 막지 못한다. 매 턴 1 줄어든다.',
  },
  naesang: {
    name: '내상', hanja: '傷', decay: 'onUse', harmful: true,
    text: '다음 턴 최대 내공이 스택만큼 줄어든다. 발동하면 전량 사라진다.',
  },
  vulnerable: {
    name: '취약', hanja: '破', decay: 'perTurn', harmful: true,
    text: '받는 피해가 50% 늘어난다. 매 턴 1 줄어든다.',
  },
  weak: {
    name: '쇠약', hanja: '衰', decay: 'perTurn', harmful: true,
    text: '주는 피해가 25% 줄어든다. 매 턴 1 줄어든다.',
  },
  momentum: {
    name: '기세', hanja: '氣', decay: 'never', harmful: false,
    text: '공격 피해가 스택만큼 늘어난다. 전투가 끝날 때까지 유지된다.',
  },
  afterimage: {
    name: '잔상', hanja: '殘', decay: 'onUse', harmful: false,
    text: '받는 공격 1회를 완전히 흘린다. 발동하면 1 줄어든다.',
  },
};

export function getStatus(map: StatusMap, id: StatusId): number {
  return map[id] ?? 0;
}

export function addStatus(map: StatusMap, id: StatusId, amount: number): StatusMap {
  if (amount <= 0) return { ...map };
  return { ...map, [id]: getStatus(map, id) + amount };
}

export function consumeStatus(map: StatusMap, id: StatusId, amount: number): StatusMap {
  const left = getStatus(map, id) - amount;
  const out = { ...map };
  if (left > 0) out[id] = left;
  else delete out[id];
  return out;
}

/** 턴 경계에서 perTurn 상태를 1씩 줄인다. */
export function tickStatus(map: StatusMap): StatusMap {
  let out: StatusMap = { ...map };
  for (const key of Object.keys(map) as StatusId[]) {
    if (STATUS_META[key].decay === 'perTurn') out = consumeStatus(out, key, 1);
  }
  return out;
}
