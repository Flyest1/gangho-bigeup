// @vitest-environment happy-dom
//
// 기물은 전투 상단바에만 있었다. 검증 두 차례가 같은 것을 짚었다 — 맵에서 다음
// 노드를 고를 때(정예를 칠지 객잔에서 쉴지)도, 장터에서 무엇을 살지 고를 때도
// 보유 기물이 판단의 근거인데 볼 방법이 없었다. 여기서 고정하는 것은 두 가지다:
// (1) 칩을 만드는 공용 컴포넌트의 계약, (2) 전투 밖 네 화면이 실제로 그것을 쓴다는 것.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/engine/gamedata';
import { startRun, type RunAction, type RunState } from '../../src/engine/run';
import type { AppApi, AppState } from '../../src/ui/app';
import { renderRelicStrip } from '../../src/ui/components/relics';
import { renderMap } from '../../src/ui/screens/map';
import { renderRest } from '../../src/ui/screens/rest';
import { renderShop } from '../../src/ui/screens/shop';
import { renderReward } from '../../src/ui/screens/reward';

function fakeApi(sent: RunAction[] = []): AppApi {
  return {
    dispatch: (action) => { sent.push(action); },
    newRun: () => {},
    toTitle: () => {},
    resume: () => {},
    dismissNotice: () => {},
    dismissSaveNotice: () => {},
    reclaimTab: () => {},
    getState: () => ({
      save: { version: 1, meta: { version: 1, runsStarted: 0, runsWon: 0, bestAct: 0, bestFloors: 0 }, run: null },
      view: 'title', notice: null, saveNotice: null, tabConflict: false,
    } satisfies AppState),
  };
}

function mount(node: HTMLElement): HTMLElement {
  document.body.append(node);
  return node;
}

/** 근골(筋)·낡은 죽립(笠) 두 기물을 들고 있는 런. */
function runWithRelics(seed: string): RunState {
  const base = startRun(seed, CONTENT);
  return { ...base, player: { ...base.player, relics: ['geungol', 'jungnip'] } };
}

function chipNames(root: HTMLElement): string[] {
  return [...root.querySelectorAll('.relics .relic .relic-name')].map((n) => n.textContent ?? '');
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { document.body.innerHTML = ''; });

describe('기물 띠 컴포넌트', () => {
  it('보유 기물마다 칩을 하나씩 내고 이름·한자·설명을 모두 싣는다', () => {
    const strip = renderRelicStrip(['geungol', 'jungnip']);
    expect(strip).not.toBeNull();
    mount(strip!);

    const chips = [...strip!.querySelectorAll('.relic')];
    expect(chips).toHaveLength(2);
    // 색이 아니라 한자+이름으로 구분한다 — 접근성 계약이 그렇다.
    expect(chips[0]!.querySelector('.relic-hanja')!.textContent).toBe('筋');
    expect(chips[0]!.querySelector('.relic-name')!.textContent).toBe('근골');
    // 설명은 스크린리더와 마우스 양쪽에 닿아야 한다.
    expect(chips[0]!.getAttribute('aria-label')).toContain('최대 체력 +8');
    expect(chips[0]!.getAttribute('title')).toContain('최대 체력 +8');
  });

  it('기물이 없으면 아무것도 내지 않는다 (빈 상자를 남기지 않는다)', () => {
    expect(renderRelicStrip([])).toBeNull();
  });

  it('알 수 없는 기물 id도 던지지 않고 자리를 지킨다 (손상 저장)', () => {
    const strip = renderRelicStrip(['없는기물']);
    expect(strip).not.toBeNull();
    expect(strip!.querySelectorAll('.relic')).toHaveLength(1);
    expect(strip!.textContent).toContain('없는기물');
  });
});

describe('전투 밖 화면이 보유 기물을 보여준다', () => {
  it('맵 화면', () => {
    const root = mount(renderMap(fakeApi(), runWithRelics('기물맵')));
    expect(chipNames(root)).toEqual(['근골', '낡은 죽립']);
  });

  it('객잔 화면', () => {
    const root = mount(renderRest(fakeApi(), runWithRelics('기물객잔')));
    expect(chipNames(root)).toEqual(['근골', '낡은 죽립']);
  });

  it('장터 화면', () => {
    const base = runWithRelics('기물장터');
    const run: RunState = { ...base, screen: 'shop', shop: [] };
    const root = mount(renderShop(fakeApi(), run));
    expect(chipNames(root)).toEqual(['근골', '낡은 죽립']);
  });

  it('보상 화면 — 새로 주는 기물과 이미 가진 기물이 섞이지 않는다', () => {
    const base = runWithRelics('기물보상');
    const run: RunState = {
      ...base,
      currentNodeId: base.map.layers[0]![0]!,
      screen: 'reward',
      reward: { gold: 15, cards: ['gangsu'], relic: 'gihaehyeol' },
    };
    const root = mount(renderReward(fakeApi(), run));

    // 보유 기물 띠에는 새 기물(기해혈)이 끼어들지 않는다.
    expect(chipNames(root)).toEqual(['근골', '낡은 죽립']);
    // 새로 주는 기물은 따로 제 자리에 남아 있다.
    expect(root.querySelector('.reward-relic .relic-name')!.textContent).toBe('기해혈');
  });

  it('기물이 하나도 없으면 빈 띠가 생기지 않는다', () => {
    // 개방은 시작 기물(반쪽 비급)을 하나 들고 출발하므로 정상 플레이로는 이
    // 상태에 닿지 않는다. 그래도 P2에서 시작 기물이 없는 문파가 들어오거나
    // 기물을 잃는 효과가 생기면 곧바로 실제 상태가 된다.
    const base = startRun('기물없음', CONTENT);
    const bare: RunState = { ...base, player: { ...base.player, relics: [] } };
    for (const node of [renderMap(fakeApi(), bare), renderRest(fakeApi(), bare)]) {
      expect(node.querySelector('.relics')).toBeNull();
    }
  });
});
