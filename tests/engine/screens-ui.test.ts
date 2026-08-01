// @vitest-environment happy-dom
//
// Task 17 다섯 화면(맵·보상·객잔·장터·결과)의 회귀 고정. combat-ui.test.ts가
// 전투 화면에 세운 것과 같은 목적이다 — 화면이 엔진에서 어긋나면 여기서 빨갛게
// 뜬다. dispatch는 기록만 하고(실제 상태 변경 없음), 엔진이 실제로 무엇을
// 하는지 검증할 때는 그 기록된 RunAction을 진짜 applyRunAction에 그대로 태운다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/engine/gamedata';
import { applyRunAction, startRun, type RunAction, type RunState } from '../../src/engine/run';
import type { AppApi, AppState } from '../../src/ui/app';
import { renderMap } from '../../src/ui/screens/map';
import { renderReward } from '../../src/ui/screens/reward';
import { renderRest } from '../../src/ui/screens/rest';
import { renderShop } from '../../src/ui/screens/shop';
import { renderResult } from '../../src/ui/screens/result';

function fakeApi(sent: RunAction[]): AppApi {
  return {
    dispatch: (action) => { sent.push(action); },
    newRun: () => {},
    toTitle: () => {},
    resume: () => {},
    dismissNotice: () => {},
    dismissSaveNotice: () => {},
    getState: () => ({
      save: { version: 1, meta: { version: 1, runsStarted: 0, runsWon: 0, bestAct: 0, bestFloors: 0 }, run: null },
      view: 'title', notice: null, saveNotice: null,
    } satisfies AppState),
  };
}

function mount(node: HTMLElement): HTMLElement {
  document.body.append(node);
  return node;
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { document.body.innerHTML = ''; });

describe('맵 화면', () => {
  it('갈 수 있는 노드만 활성화되고 나머지는 disabled다', () => {
    const run = startRun('맵UI', CONTENT);
    const root = mount(renderMap(fakeApi([]), run));

    const nodes = [...root.querySelectorAll<HTMLButtonElement>('.map-node')];
    // 0층(첫 격전) 하나만 갈 수 있다 — availableNodes(run)과 정확히 같다.
    const enabled = nodes.filter((n) => !n.disabled);
    expect(enabled).toHaveLength(1);
    expect(enabled[0]!.getAttribute('aria-label')).toContain('갈 수 있음');
    // 나머지는 전부 disabled.
    expect(nodes.filter((n) => n.disabled)).toHaveLength(nodes.length - 1);
  });

  it('체력 표시가 player.maxHp가 아니라 effectiveMaxHp를 쓴다 (근골 +8 보유)', () => {
    const base = startRun('맵HP', CONTENT);
    const run: RunState = { ...base, player: { ...base.player, hp: 80, relics: [...base.player.relics, 'geungol'] } };
    const root = mount(renderMap(fakeApi([]), run));

    const hpLine = root.querySelector('.map-stat')!.textContent;
    // effectiveMaxHp = 80(문파 기본) + 8(근골) = 88. player.maxHp 자체는 여전히 80이므로,
    // 화면이 player.maxHp를 그대로 읽으면 "80 / 80"이 나와 이 값과 어긋난다.
    expect(hpLine).toBe('체력 80 / 88');
  });
});

describe('보상 화면', () => {
  function rewardRun(): RunState {
    const r = startRun('보상UI', CONTENT);
    return {
      ...r,
      // leaveReward가 currentNodeId로 노드 타입(관문인지 아닌지)을 가리므로,
      // null이면 nodeAt이 곧바로 던진다. 보통 격전 노드로 채워 둔다.
      currentNodeId: r.map.layers[0]![0]!,
      screen: 'reward',
      reward: { gold: 15, cards: ['gangsu', 'gyeokgong', 'apgu_bae'], relic: null },
    };
  }

  it('넘기기 버튼이 있다', () => {
    const run = rewardRun();
    const root = mount(renderReward(fakeApi([]), run));
    const buttons = [...root.querySelectorAll('button')];
    expect(buttons.some((b) => b.textContent === '넘기기')).toBe(true);
  });

  it('카드를 고르면 (엔진에 그대로 반영해 보면) 덱이 정확히 한 장 는다', () => {
    const run = rewardRun();
    const sent: RunAction[] = [];
    const root = mount(renderReward(fakeApi(sent), run));

    const cardBtn = root.querySelector<HTMLButtonElement>('.reward-card-btn');
    expect(cardBtn).not.toBeNull();
    cardBtn!.click();

    expect(sent).toHaveLength(1);
    const after = applyRunAction(run, sent[0]!, CONTENT);
    expect(after.player.deck).toHaveLength(run.player.deck.length + 1);
  });

  it('reward가 null이면(손상 저장) takeCard가 아니라 타이틀로 실제로 나간다 (Finding 3)', () => {
    // run.ts가 screen='reward'와 reward를 항상 함께 세우므로 정상 플레이로는
    // 도달하지 않지만, isRun은 이 조합을 막지 않는다 — 손상된 저장이 이 화면에
    // 멈춰 서면 나갈 길이 있어야 한다. 예전 버튼은 takeCard(cardId:null)를 보냈는데,
    // leaveReward(run.ts)는 reward가 null이면 run을 그대로 돌려줘 막다른 길이었다.
    const base = rewardRun();
    const run: RunState = { ...base, reward: null };
    let toTitleCalled = false;
    const api: AppApi = {
      dispatch: () => { throw new Error('타이틀로는 dispatch가 아니라 toTitle을 불러야 한다'); },
      newRun: () => {},
      toTitle: () => { toTitleCalled = true; },
      resume: () => {},
      dismissNotice: () => {},
      dismissSaveNotice: () => {},
      getState: () => ({
        save: { version: 1, meta: { version: 1, runsStarted: 0, runsWon: 0, bestAct: 0, bestFloors: 0 }, run },
        view: 'run', notice: null, saveNotice: null,
      } satisfies AppState),
    };
    const root = mount(renderReward(api, run));

    const btn = [...root.querySelectorAll('button')].find((b) => b.textContent === '타이틀로');
    expect(btn).not.toBeUndefined();
    btn!.click();
    expect(toTitleCalled).toBe(true);
  });
});

describe('객잔 화면', () => {
  it('휴식 버튼에 적힌 회복량이 applyRunAction이 실제로 적용하는 양과 정확히 같다', () => {
    const r = startRun('객잔UI', CONTENT);
    const restId = r.map.layers[4]![0]!;
    const run: RunState = { ...r, currentNodeId: restId, screen: 'rest', player: { ...r.player, hp: 40 } };
    const root = mount(renderRest(fakeApi([]), run));

    const healBtn = [...root.querySelectorAll('button')].find((b) => (b.textContent ?? '').startsWith('휴식'))!;
    const shown = Number(healBtn.textContent!.match(/\d+/)![0]);

    const after = applyRunAction(run, { type: 'rest', choice: 'heal' }, CONTENT);
    // 40에서 시작해 최대 체력(80)에 한참 못 미치므로 이번엔 상한에 걸리지 않는다 —
    // 버튼 문구가 낸 수와 실제로 오른 체력이 같은 계산에서 나왔는지를 곧바로 비교한다.
    expect(after.player.hp - run.player.hp).toBe(shown);
  });
});

describe('장터 화면', () => {
  function shopRun(): RunState {
    const r = startRun('장터UI', CONTENT);
    return {
      ...r,
      screen: 'shop',
      player: { ...r.player, gold: 40 },
      shop: [
        { kind: 'card', id: 'gangsu', price: 30 },
        { kind: 'card', id: 'byeokta', price: 999 },
      ],
    };
  }

  it('살 수 있는 항목은 disabled도 aria-disabled도 없고, 못 사는 항목은 둘 다 있다', () => {
    const run = shopRun();
    const root = mount(renderShop(fakeApi([]), run));
    const buys = [...root.querySelectorAll<HTMLButtonElement>('.shop-buy')];
    expect(buys).toHaveLength(2);

    const [affordable, tooExpensive] = buys;
    expect(affordable!.disabled).toBe(false);
    expect(affordable!.hasAttribute('aria-disabled')).toBe(false);

    expect(tooExpensive!.disabled).toBe(true);
    expect(tooExpensive!.getAttribute('aria-disabled')).toBe('true');
  });

  it('제거 목록에 들어가면 진입 즉시 초점이 목록 제목으로 옮겨간다', async () => {
    const r = startRun('장터제거UI', CONTENT);
    const run: RunState = { ...r, screen: 'shop', pendingRemoval: true, shop: [] };
    const root = mount(renderShop(fakeApi([]), run));

    // 초점 이동은 마이크로태스크 큐에 미뤄진다 — 이 렌더 함수가 반환된 시점에는
    // 아직 root가 document에 붙기 전이라, 붙기 전에 곧바로 focus()를 부르면
    // 브라우저가 조용히 무시하기 때문이다(장터가 애초에 pendingRemoval 상태로
    // 시작하는 이 경우가 정확히 그 경로). 큐가 비워질 때까지 한 틱 기다린다.
    await Promise.resolve();

    const heading = root.querySelector('.shop-removal-heading');
    expect(heading).not.toBeNull();
    expect(document.activeElement).toBe(heading);
  });

  it('제거 목록 안에서 Esc를 누르면 leave가 디스패치된다', () => {
    const r = startRun('장터제거Esc', CONTENT);
    const run: RunState = { ...r, screen: 'shop', pendingRemoval: true, shop: [] };
    const sent: RunAction[] = [];
    const root = mount(renderShop(fakeApi(sent), run));

    const section = root.querySelector('.shop-removal')!;
    section.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(sent).toEqual([{ type: 'leave' }]);
  });
});

describe('결과 화면', () => {
  it('시드·도달 막·층수·처치가 모두 보인다', () => {
    const base = startRun('결과표시UI', CONTENT);
    const run: RunState = {
      ...base, screen: 'result', result: 'victory', act: 3,
      stats: { floors: 22, kills: 18, elites: 2 },
    };
    const root = mount(renderResult(fakeApi([]), run));
    const text = root.textContent ?? '';

    expect(text).toContain('결과표시UI'); // 시드
    expect(text).toContain('3막');        // 도달 막
    expect(text).toContain('22층');       // 층수
    expect(text).toContain('18');         // 처치
  });
});
