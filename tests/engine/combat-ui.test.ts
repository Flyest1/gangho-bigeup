// @vitest-environment happy-dom
//
// 전투 화면 회귀 테스트. Task 20 의 Playwright 묶음이 기대는 선택자(`.combat`,
// `.hand .card`, `.enemy[data-hp]`, `.turn-indicator`, `턴 종료` 버튼)와, 화면이
// 규칙을 다시 계산하지 않는다는 성질(내공이 모자란 카드는 아예 못 낸다)을 못박는다.
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { applyAction, startCombat } from '../../src/engine/combat';
import { CONTENT } from '../../src/engine/gamedata';
import { startRun, type RunAction, type RunState } from '../../src/engine/run';
import type { CardInstance, CombatState } from '../../src/engine/types';
import type { AppApi, AppState } from '../../src/ui/app';
import { renderCombat } from '../../src/ui/screens/combat';

const DECK: CardInstance[] = [
  { uid: 'c0', defId: 'byeokta', upgraded: false },    // 외공 · 내공 1 · 6 피해
  { uid: 'c1', defId: 'bangsin', upgraded: false },    // 내공 · 내공 1 · 호신강기 5
  { uid: 'c2', defId: 'gyeokgong', upgraded: false },  // 외공 · 내공 2 · 14 피해
  { uid: 'c3', defId: 'apgu_bae', upgraded: false },   // 내공 · 내공 1 · 적 대상
  { uid: 'c4', defId: 'bongta_ssanggyeon', upgraded: false }, // 외공 · 내공 1 · 적 전체 6 피해
];

function makeCombat(enemyIds: string[], patch: Partial<CombatState> = {}): CombatState {
  const combat = startCombat({
    seed: 7,
    player: { hp: 80, maxHp: 80, maxQi: 3, stance: 'wai', relics: [] },
    enemyIds,
    deck: DECK,
  }, CONTENT);
  return { ...combat, hand: [...DECK], draw: [], discard: [], ...patch };
}

interface Harness {
  root: HTMLElement;
  sent: RunAction[];
  api: AppApi;
}

function mount(combat: CombatState): Harness {
  const base: RunState = startRun('전투UI', CONTENT);
  const run: RunState = { ...base, screen: 'combat', combat };
  const sent: RunAction[] = [];
  const api: AppApi = {
    dispatch: (action) => { sent.push(action); },
    newRun: () => {},
    toTitle: () => {},
    resume: () => {},
    dismissNotice: () => {},
    dismissSaveNotice: () => {},
    reclaimTab: () => {},
    getState: () => ({ save: { version: 1, meta: { version: 1, runsStarted: 0, runsWon: 0, bestAct: 0, bestFloors: 0 }, run }, view: 'run', notice: null, saveNotice: null, tabConflict: false } satisfies AppState),
  };
  const root = renderCombat(api, run);
  document.body.append(root);
  return { root, sent, api };
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { document.body.innerHTML = ''; });

describe('전투 화면 — 시험 고리', () => {
  it('Task 20 이 기대는 선택자가 모두 있다', () => {
    const { root } = mount(makeCombat(['deulgae']));

    expect(root.classList.contains('combat')).toBe(true);
    expect(root.querySelectorAll('.hand .card')).toHaveLength(5);
    expect(root.querySelectorAll('.enemy[data-hp]')).toHaveLength(1);

    const turn = root.querySelector('.turn-indicator');
    expect(turn?.textContent).toContain('1');

    const buttons = [...root.querySelectorAll('button')];
    expect(buttons.some((b) => b.textContent === '턴 종료')).toBe(true);
  });

  it('적의 체력이 data-hp 로 드러난다', () => {
    const combat = makeCombat(['deulgae']);
    const { root } = mount(combat);
    const node = root.querySelector<HTMLElement>('.enemy[data-hp]');
    expect(node?.dataset.hp).toBe(String(combat.enemies[0]!.hp));
  });
});

describe('전투 화면 — 발동', () => {
  it('적이 하나면 카드를 탭하는 즉시 발동한다', () => {
    const { root, sent } = mount(makeCombat(['deulgae']));
    root.querySelector<HTMLElement>('.hand-slot[data-uid="c0"]')!.click();
    expect(sent).toEqual([{ type: 'combat', action: { type: 'playCard', uid: 'c0', targetUid: undefined } }]);
  });

  it('적이 둘이면 카드를 고른 뒤 적을 탭해야 발동한다', () => {
    const { root, sent } = mount(makeCombat(['deulgae', 'sanjeok']));
    root.querySelector<HTMLElement>('.hand-slot[data-uid="c0"]')!.click();
    expect(sent).toHaveLength(0);

    const second = root.querySelectorAll<HTMLElement>('.enemy[data-hp]')[1]!;
    second.click();
    expect(sent).toEqual([{ type: 'combat', action: { type: 'playCard', uid: 'c0', targetUid: 'e1' } }]);
  });

  it('Esc 를 누르면 선택이 풀린다', () => {
    const { root, sent } = mount(makeCombat(['deulgae', 'sanjeok']));
    root.querySelector<HTMLElement>('.hand-slot[data-uid="c0"]')!.click();
    expect(root.querySelector('.hand-slot.selected')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(root.querySelector('.hand-slot.selected')).toBeNull();

    root.querySelectorAll<HTMLElement>('.enemy[data-hp]')[1]!.click();
    expect(sent).toHaveLength(0);
  });

  it('내공이 모자란 카드는 눌러도 발동되지 않는다', () => {
    const combat = makeCombat(['deulgae']);
    const { root, sent } = mount({ ...combat, player: { ...combat.player, qi: 1 } });

    const dead = root.querySelector<HTMLButtonElement>('.hand-slot[data-uid="c2"]')!;
    expect(dead.disabled).toBe(true);
    expect(dead.querySelector('.card')!.classList.contains('unplayable')).toBe(true);
    dead.click();
    expect(sent).toHaveLength(0);

    // 키보드 경로도 같은 판정을 거친다 (3번 = 격공).
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
    expect(sent).toHaveLength(0);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    expect(sent).toHaveLength(1);
  });

  it('턴 종료 버튼이 endTurn 을 보낸다', () => {
    const { root, sent } = mount(makeCombat(['deulgae']));
    const end = [...root.querySelectorAll('button')].find((b) => b.textContent === '턴 종료')!;
    end.click();
    expect(sent).toEqual([{ type: 'combat', action: { type: 'endTurn' } }]);
  });
});

describe('전투 화면 — 자세 띠', () => {
  it('내 계열이 적 자세를 이기면 파훼로 적힌다', () => {
    // 들개는 경공 자세로 시작하고 나는 외공 자세다. 외공▶경공이므로 파훼.
    const { root } = mount(makeCombat(['deulgae']));
    const mine = root.querySelector('.stance-row.tone-mine')!;
    expect(mine.classList.contains('verdict-break')).toBe(true);
    expect(mine.textContent).toContain('파훼');
    expect(mine.textContent).toContain('×1.5');
  });

  it('내 계열이 적 자세에 눌리면 저항으로 적힌다', () => {
    const combat = makeCombat(['deulgae']);
    const enemy = { ...combat.enemies[0]!, stance: 'nae' as const };
    const { root } = mount({ ...combat, enemies: [enemy] });
    const mine = root.querySelector('.stance-row.tone-mine')!;
    expect(mine.classList.contains('verdict-resisted')).toBe(true);
    expect(mine.textContent).toContain('저항');
  });

  it('적이 치는 줄은 자세가 아니라 의도 계열로 판정한다', () => {
    const combat = makeCombat(['deulgae']);
    const enemy = {
      ...combat.enemies[0]!,
      stance: 'wai' as const,
      intent: { actionId: 'mul', kind: 'attack' as const, line: 'gyeong' as const, value: 6, hits: 1, label: '물어뜯기' },
    };
    // 내 자세는 외공. 적 자세(외공)로 보면 평타지만, 의도 계열(경공)로 보면 내가 저항한다.
    const { root } = mount({ ...combat, enemies: [enemy] });
    const theirs = root.querySelector('.stance-row.tone-theirs')!;
    expect(theirs.classList.contains('verdict-resisted')).toBe(true);
  });

  it('고른 초식의 계열로 내 공격 줄을 미리 본다', () => {
    const combat = makeCombat(['deulgae', 'sanjeok']);
    const { root } = mount(combat);
    // 압구배는 내공 계열이고 적을 겨눈다. 들개(경공)를 상대로는 내공이 눌린다 — 경공▶내공.
    root.querySelector<HTMLElement>('.hand-slot[data-uid="c3"]')!.click();
    const mine = root.querySelector('.stance-row.tone-mine')!;
    expect(mine.classList.contains('preview')).toBe(true);
    expect(mine.classList.contains('verdict-resisted')).toBe(true);
  });
});

describe('전투 화면 — 연계', () => {
  it('임계 직전이면 다음 한 장을 예고한다', () => {
    const combat = makeCombat(['deulgae'], { combo: { line: 'wai', count: 2 } });
    const { root } = mount(combat);
    const combo = root.querySelector('.combo')!;
    expect(combo.classList.contains('ready')).toBe(true);
    expect(combo.textContent).toContain('연계');
    expect(root.querySelectorAll('.combo-dot.on')).toHaveLength(2);
  });

  it('임계에 닿으면 발동 중으로 강조한다', () => {
    const combat = makeCombat(['deulgae'], { combo: { line: 'wai', count: 3 } });
    const { root } = mount(combat);
    const combo = root.querySelector('.combo')!;
    expect(combo.classList.contains('firing')).toBe(true);
    expect(combo.textContent).toContain('피해 +6');
  });

  it('계열이 없으면 점이 모두 비어 있다', () => {
    const combat = makeCombat(['deulgae'], { combo: { line: null, count: 0 } });
    const { root } = mount(combat);
    expect(root.querySelectorAll('.combo-dot')).toHaveLength(3);
    expect(root.querySelectorAll('.combo-dot.on')).toHaveLength(0);
  });
});

describe('전투 화면 — 적 전체 초식의 판정', () => {
  // 봉타쌍견(c4)은 외공 계열로 적 전체를 친다. 상성은 적마다 따로 계산되므로,
  // 카드에 붙는 판정은 그것이 가리키는 모든 적에게 참이어야 한다.
  function twoEnemies(stanceA: 'wai' | 'gyeong' | 'nae', stanceB: 'wai' | 'gyeong' | 'nae'): CombatState {
    const combat = makeCombat(['deulgae', 'sanjeok']);
    return {
      ...combat,
      enemies: [
        { ...combat.enemies[0]!, stance: stanceA },
        { ...combat.enemies[1]!, stance: stanceB },
      ],
    };
  }

  it('맞는 적 전부가 같은 판정이면 그 판정을 그대로 적는다', () => {
    const { root } = mount(twoEnemies('gyeong', 'gyeong'));
    const aoe = root.querySelector('.hand-slot[data-uid="c4"]')!;
    expect(aoe.querySelector('.card-mu')!.classList.contains('mu-break')).toBe(true);
    expect(aoe.getAttribute('aria-label')).toContain('적 전체 파훼');
  });

  it('적마다 판정이 갈리면 한쪽으로 단정하지 않는다', () => {
    // 외공은 들개(경공)를 파훼하지만 산적(외공)에게는 평타다.
    const { root } = mount(twoEnemies('gyeong', 'wai'));
    const aoe = root.querySelector('.hand-slot[data-uid="c4"]')!;
    const badge = aoe.querySelector('.card-mu')!;
    expect(badge.classList.contains('mu-mixed')).toBe(true);
    expect(badge.classList.contains('mu-break')).toBe(false);

    const label = aoe.getAttribute('aria-label') ?? '';
    expect(label).toContain('들개 파훼');
    expect(label).toContain('산적 평타');
    // 카드 설명문 자체가 "적 전체 6 피해."라서 '적 전체'만으로는 못 가른다.
    // 단정하는 문구(적 전체 <판정>)가 없어야 한다.
    expect(label).not.toContain('적 전체 파훼');
  });

  it('하나를 겨누는 초식은 갈림이 아니라 초점 적 기준으로 적는다', () => {
    const { root } = mount(twoEnemies('gyeong', 'wai'));
    const single = root.querySelector('.hand-slot[data-uid="c0"]')!; // 벽타, 적 하나
    expect(single.querySelector('.card-mu')!.classList.contains('mu-break')).toBe(true);
    expect(single.getAttribute('aria-label')).toContain('들개 기준 파훼');
  });

  it('맞는 적이 전부 평타면 아무 도장도 붙이지 않는다', () => {
    const { root } = mount(twoEnemies('wai', 'wai'));
    expect(root.querySelector('.hand-slot[data-uid="c4"]')!.querySelector('.card-mu')).toBeNull();
  });
});

describe('전투 화면 — 접근성', () => {
  it('카드 이름표에 이름·계열·내공·설명이 순서대로 들어간다', () => {
    const { root } = mount(makeCombat(['deulgae']));
    const label = root.querySelector('.hand-slot[data-uid="c0"]')!.getAttribute('aria-label') ?? '';
    expect(label.startsWith('벽타, 외공, 내공 1, 6 피해.')).toBe(true);
  });

  it('의도 이름표가 행동·수치·계열을 읽는다 (수치는 상성까지 반영한 실제 값)', () => {
    const combat = makeCombat(['deulgae']);
    const enemy = {
      ...combat.enemies[0]!,
      intent: { actionId: 'mul', kind: 'attack' as const, line: 'gyeong' as const, value: 6, hits: 2, label: '물어뜯기' },
    };
    const { root } = mount({ ...combat, enemies: [enemy] });
    const label = root.querySelector('.intent')!.getAttribute('aria-label');
    // 내 자세는 외공(byeokta 덱 기준), 의도 계열은 경공 → 외공이 경공을 누르므로
    // 저항(×0.75). floor(6 × 0.75) = 4. 정적 데이터의 6을 그대로 보이면 안 된다 —
    // computeDamage가 실제로 매기는 값과 같아야 한다(Finding 5).
    expect(label).toBe('다음 행동: 물어뜯기, 공격 4 2회, 경공');
    expect(root.querySelector('.intent-value')!.textContent).toBe('4 ×2');
  });

  it('의도에 적힌 수치가 실제로 맞았을 때 깎이는 체력과 정확히 같다 (Finding 5)', () => {
    // 기세 3을 얹은 적의 공격 의도. 정적 데이터의 value(6)를 그대로 보이면
    // 기세가 통째로 빠진 6이 뜨고, 실제로 맞으면 (6+3)×0.75(외공↔경공 저항)=6이
    // 깎여 화면과 실제가 어긋난다. 한 테스트에서 두 값을 나란히 재 두면 둘 중
    // 하나만 바뀌는 회귀(엔진은 고쳤는데 화면을 안 고치거나, 그 반대)를 잡는다.
    const combat = makeCombat(['deulgae']);
    const enemy = {
      ...combat.enemies[0]!,
      status: { momentum: 3 },
      intent: { actionId: 'mul', kind: 'attack' as const, line: 'gyeong' as const, value: 6, hits: 1, label: '물어뜯기' },
    };
    const rigged: CombatState = { ...combat, enemies: [enemy] };
    const { root } = mount(rigged);

    const displayed = Number(root.querySelector('.intent-value')!.textContent);
    const after = applyAction(rigged, { type: 'endTurn' }, CONTENT);
    const actualLoss = rigged.player.hp - after.player.hp;

    expect(displayed).toBe(6);
    expect(actualLoss).toBe(displayed);
  });

  it('적 이름표가 그 적이 나를 어떻게 치는지도 읽는다', () => {
    // 눈으로는 의도 옆 상성 도장으로 보이는 정보다. 자세 띠는 초점 적 하나만
    // 다루므로, 이름표에 없으면 스크린리더 사용자는 나머지 적의 방어 판정을 잃는다.
    const combat = makeCombat(['deulgae', 'sanjeok']);
    const enemies = [
      {
        ...combat.enemies[0]!, stance: 'gyeong' as const,
        intent: { actionId: 'mul', kind: 'attack' as const, line: 'gyeong' as const, value: 6, hits: 1, label: '물어뜯기' },
      },
      {
        ...combat.enemies[1]!, stance: 'wai' as const,
        intent: { actionId: 'hwidu', kind: 'attack' as const, line: 'wai' as const, value: 8, hits: 1, label: '휘두르기' },
      },
    ];
    const { root } = mount({ ...combat, enemies });
    const labels = [...root.querySelectorAll('.enemy[data-hp]')].map((e) => e.getAttribute('aria-label') ?? '');

    // 내 자세는 외공. 경공이 외공을 치면 저항, 외공이 외공을 치면 평타.
    expect(labels[0]).toContain('이 적이 경공으로 치면 내가 저항');
    expect(labels[1]).toContain('이 적이 외공으로 치면 내가 평타');
    // 초점이 아닌 적도 반드시 갖는다.
    expect(labels.every((l) => l.includes('이 적이'))).toBe(true);
  });

  it('공격이 아닌 의도에는 방어 판정을 붙이지 않는다', () => {
    const combat = makeCombat(['deulgae']);
    const enemy = {
      ...combat.enemies[0]!,
      intent: { actionId: 'uleum', kind: 'buff' as const, line: 'sul' as const, value: 1, hits: 1, label: '울부짖기' },
    };
    const { root } = mount({ ...combat, enemies: [enemy] });
    expect(root.querySelector('.enemy[data-hp]')!.getAttribute('aria-label')).not.toContain('이 적이');
  });

  it('체력·호신강기 막대가 meter 값을 모두 낸다', () => {
    const combat = makeCombat(['deulgae']);
    const { root } = mount({ ...combat, player: { ...combat.player, hp: 62, block: 7 } });
    const hp = root.querySelector('.topbar .meter-hp')!;
    expect(hp.getAttribute('role')).toBe('meter');
    expect(hp.getAttribute('aria-valuenow')).toBe('62');
    expect(hp.getAttribute('aria-valuemin')).toBe('0');
    expect(hp.getAttribute('aria-valuemax')).toBe('80');

    const block = root.querySelector('.topbar .meter-block')!;
    expect(block.getAttribute('aria-valuenow')).toBe('7');
  });

  it('계열 표시는 색 없이도 도형과 한자로 갈린다', () => {
    const { root } = mount(makeCombat(['deulgae']));
    const chip = root.querySelector('.my-stance .line-chip')!;
    expect(chip.querySelector('.line-shape')!.textContent).toBe('◆');
    expect(chip.querySelector('.line-hanja')!.textContent).toBe('外');
    expect(chip.getAttribute('aria-label')).toBe('외공');
  });
});

describe('전투 화면 — 손패/버린 패 모달의 초점 관리', () => {
  // 이 화면은 조작마다 전체를 다시 그린다(map.ts·rest.ts와 달리 바탕 화면이
  // 그대로 남는 오버레이가 아니다). 이 모달이 실제 접근성 결함이었던 자리라
  // (trapFocus 없음, 이번에 추가) 회귀를 잡을 테스트가 없었다 — 코드 리뷰 지적.
  it('열면 초점이 모달 안(닫기 버튼)으로 옮겨가고, Tab을 눌러도 뒤에 깔린 손패로 새지 않는다', async () => {
    const { root } = mount(makeCombat(['deulgae']));

    const trigger = root.querySelector<HTMLButtonElement>('[data-fkey="pile:draw"]')!;
    trigger.click();

    // trapFocus의 첫 초점 이동은 큐에 미뤄진다(dom.ts의 trapFocus 주석 참조) —
    // 이 렌더가 반환된 뒤 한 틱 기다려야 반영된다.
    await Promise.resolve();

    const overlay = root.querySelector('.pile-view');
    expect(overlay).not.toBeNull();
    const close = overlay!.querySelector<HTMLButtonElement>('button')!;
    expect(document.activeElement).toBe(close);

    // 이 모달의 유일한 포커스 대상은 닫기 버튼뿐이다(카드 목록은 순수 텍스트) —
    // Tab을 눌러도 오버레이 밖(손패·행동바)으로 새지 않고 그 안에 갇혀야 한다.
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(overlay!.contains(document.activeElement)).toBe(true);
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(overlay!.contains(document.activeElement)).toBe(true);
  });

  it('닫기 버튼을 누르면 오버레이가 사라지고 초점이 정확히 연 버튼으로 돌아온다', async () => {
    const { root } = mount(makeCombat(['deulgae']));
    root.querySelector<HTMLButtonElement>('[data-fkey="pile:draw"]')!.click();
    await Promise.resolve();

    const close = root.querySelector<HTMLButtonElement>('.pile-view button')!;
    close.click();

    expect(root.querySelector('.pile-view')).toBeNull();
    expect(document.activeElement).toBe(root.querySelector('[data-fkey="pile:draw"]'));
  });

  it('Escape로 닫아도 초점이 연 버튼으로 돌아온다', async () => {
    const { root } = mount(makeCombat(['deulgae']));
    root.querySelector<HTMLButtonElement>('[data-fkey="pile:discard"]')!.click();
    await Promise.resolve();
    expect(root.querySelector('.pile-view')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(root.querySelector('.pile-view')).toBeNull();
    expect(document.activeElement).toBe(root.querySelector('[data-fkey="pile:discard"]'));
  });

  it('토글 버튼을 다시 눌러 스스로 닫아도 같은 버튼에 초점이 남는다', async () => {
    const { root } = mount(makeCombat(['deulgae']));
    root.querySelector<HTMLButtonElement>('[data-fkey="pile:draw"]')!.click();
    await Promise.resolve();
    expect(root.querySelector('.pile-view')).not.toBeNull();

    // 다시 눌러 스스로 닫는다 — 새로 그려진 트리에서 다시 찾아야 한다(이전
    // 참조는 clear(root)로 이미 문서에서 떨어져 나갔다).
    root.querySelector<HTMLButtonElement>('[data-fkey="pile:draw"]')!.click();

    expect(root.querySelector('.pile-view')).toBeNull();
    expect(document.activeElement).toBe(root.querySelector('[data-fkey="pile:draw"]'));
  });

  it('토글 버튼과 닫기 버튼은 서로 다른 fkey를 쓴다(모호한 매칭 방지)', async () => {
    const { root } = mount(makeCombat(['deulgae']));
    root.querySelector<HTMLButtonElement>('[data-fkey="pile:draw"]')!.click();
    await Promise.resolve();

    const trigger = root.querySelector<HTMLButtonElement>('[data-fkey="pile:draw"]')!;
    const close = root.querySelector<HTMLButtonElement>('.pile-view button')!;
    expect(close.dataset.fkey).not.toBe(trigger.dataset.fkey);
  });
});

describe('전투 화면 — 손상 복구 (Finding 3)', () => {
  it('combat이 없으면(손상 저장) 타이틀로 버튼이 실제로 타이틀로 나간다', () => {
    // run.ts가 screen='combat'과 combat을 항상 함께 세우므로 정상 플레이로는
    // 도달하지 않지만, isRun은 이 조합을 (combat이 객체이기만 하면) 막지 않는다.
    // 예전 버튼은 leave를 보냈는데, run.ts의 leave 처리는 screen이 'shop'일 때만
    // 뜻이 있어 여기서는 막다른 길이었다.
    const base = startRun('전투깨짐', CONTENT);
    const run: RunState = { ...base, screen: 'combat', combat: null };
    let toTitleCalled = false;
    const api: AppApi = {
      dispatch: () => { throw new Error('타이틀로는 dispatch가 아니라 toTitle을 불러야 한다'); },
      newRun: () => {},
      toTitle: () => { toTitleCalled = true; },
      resume: () => {},
      dismissNotice: () => {},
      dismissSaveNotice: () => {},
    reclaimTab: () => {},
      getState: () => ({
        save: { version: 1, meta: { version: 1, runsStarted: 0, runsWon: 0, bestAct: 0, bestFloors: 0 }, run },
        view: 'run', notice: null, saveNotice: null, tabConflict: false,
      } satisfies AppState),
    };
    const root = renderCombat(api, run);

    const btn = [...root.querySelectorAll('button')].find((b) => b.textContent === '타이틀로');
    expect(btn).not.toBeUndefined();
    btn!.click();
    expect(toTitleCalled).toBe(true);
  });
});
