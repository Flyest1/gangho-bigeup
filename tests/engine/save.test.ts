import { describe, it, expect } from 'vitest';
import { emptySave, serialize, parseSave, recordRunEnd } from '../../src/engine/save';
import { applyRunAction, availableNodes, startRun, type RunState } from '../../src/engine/run';
import { CONTENT } from '../../src/engine/gamedata';

const run = startRun('저장시드', CONTENT);

describe('왕복', () => {
  it('빈 저장을 왕복해도 같다', () => {
    const s = emptySave();
    expect(parseSave(serialize(s)).save).toEqual(s);
  });

  it('진행 중 런을 왕복해도 같다', () => {
    const s = { ...emptySave(), run };
    expect(parseSave(serialize(s)).save.run).toEqual(run);
  });

  it('격리된 구획이 없다', () => {
    expect(parseSave(serialize(emptySave())).quarantined).toEqual([]);
  });

  it('pendingRemoval이 없는 구버전 저장도 격리되지 않고 살아남는다', () => {
    const legacy = JSON.parse(serialize({ ...emptySave(), run }));
    delete legacy.run.pendingRemoval;
    const out = parseSave(JSON.stringify(legacy));
    expect(out.quarantined).toEqual([]);
    expect(out.save.run).not.toBeNull();
    expect('pendingRemoval' in out.save.run!).toBe(false);
    expect(out.save.run!.seedText).toBe(run.seedText);
  });
});

describe('손상 격리', () => {
  it('null이면 빈 저장을 준다', () => {
    expect(parseSave(null).save).toEqual(emptySave());
  });

  it('JSON이 깨졌으면 빈 저장으로 되돌리고 전체를 격리한다', () => {
    const out = parseSave('{{{망가진');
    expect(out.save).toEqual(emptySave());
    expect(out.quarantined).toContain('전체');
  });

  it('run만 깨졌으면 meta는 살린다', () => {
    const good = { ...emptySave(), meta: { ...emptySave().meta, runsWon: 4 }, run };
    const broken = JSON.parse(serialize(good));
    broken.run.player = null;
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.meta.runsWon).toBe(4);
    expect(out.save.run).toBeNull();
    expect(out.quarantined).toContain('run');
  });

  it('meta만 깨졌으면 run은 살린다', () => {
    const broken = JSON.parse(serialize({ ...emptySave(), run }));
    broken.meta = '숫자가 아님';
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.run).not.toBeNull();
    expect(out.quarantined).toContain('meta');
  });

  it('버전이 다르면 런은 버리고 meta는 살린다', () => {
    const broken = JSON.parse(serialize({ ...emptySave(), run }));
    broken.run.version = 99;
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.run).toBeNull();
    expect(out.quarantined).toContain('run');
  });

  it('덱이 비면 손상으로 본다', () => {
    const broken = JSON.parse(serialize({ ...emptySave(), run }));
    broken.run.player.deck = [];
    expect(parseSave(JSON.stringify(broken)).save.run).toBeNull();
  });

  it('JSON 배열은 전체를 격리한다', () => {
    const out = parseSave('[1,2,3]');
    expect(out.save).toEqual(emptySave());
    expect(out.quarantined).toContain('전체');
  });

  it('map이 비어있으면 런은 버리고 meta는 살린다', () => {
    const good = { ...emptySave(), meta: { ...emptySave().meta, runsWon: 5 }, run };
    const broken = JSON.parse(serialize(good));
    broken.run.map = {};
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.meta.runsWon).toBe(5);
    expect(out.save.run).toBeNull();
    expect(out.quarantined).toContain('run');
  });

  it('currentNodeId가 맵에 없으면 런은 버리고 meta는 살린다', () => {
    const good = { ...emptySave(), meta: { ...emptySave().meta, runsWon: 3 }, run };
    const broken = JSON.parse(serialize(good));
    broken.run.currentNodeId = '존재하지않는노드';
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.meta.runsWon).toBe(3);
    expect(out.save.run).toBeNull();
    expect(out.quarantined).toContain('run');
  });

  it('screen이 combat인데 combat이 객체가 아니면 런은 버린다', () => {
    const good = { ...emptySave(), meta: { ...emptySave().meta, runsWon: 2 }, run };
    const broken = JSON.parse(serialize(good));
    broken.run.screen = 'combat';
    broken.run.combat = null;
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.meta.runsWon).toBe(2);
    expect(out.save.run).toBeNull();
    expect(out.quarantined).toContain('run');
  });

  // Finding 2 — isRun이 stats·nextUid·school·screen(RunScreen 멤버 여부)을 보지
  // 않던 시절에는 이 넷이 없거나 헛돈 저장도 그대로 통과해 다음 섹션(손상 격리가
  // 왜 필요한가)에서 보듯 재기동할 때마다 흰 화면·uid 충돌·전투 진입 실패로
  // 이어졌다. 여기서는 "격리하는가"만 못박고, 실제로 무엇이 터지는지는 아래
  // 별도 describe에서 증명한다.
  it('stats가 없으면 런은 버린다', () => {
    const broken = JSON.parse(serialize({ ...emptySave(), run }));
    delete broken.run.stats;
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.run).toBeNull();
    expect(out.quarantined).toContain('run');
  });

  it('nextUid가 없으면 런은 버린다', () => {
    const broken = JSON.parse(serialize({ ...emptySave(), run }));
    delete broken.run.nextUid;
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.run).toBeNull();
    expect(out.quarantined).toContain('run');
  });

  it('school이 없으면 런은 버린다', () => {
    const broken = JSON.parse(serialize({ ...emptySave(), run }));
    delete broken.run.school;
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.run).toBeNull();
    expect(out.quarantined).toContain('run');
  });

  it('school이 존재하지 않는 문파면 런은 버린다', () => {
    const broken = JSON.parse(serialize({ ...emptySave(), run }));
    broken.run.school = '존재하지않는문파';
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.run).toBeNull();
    expect(out.quarantined).toContain('run');
  });

  it("screen이 RunScreen의 멤버가 아니면(예: 'bogus') 런은 버린다", () => {
    const broken = JSON.parse(serialize({ ...emptySave(), run }));
    broken.run.screen = 'bogus';
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.run).toBeNull();
    expect(out.quarantined).toContain('run');
  });

  it('meta와 run이 동시에 깨졌으면 둘 다 격리한다', () => {
    const broken = JSON.parse(serialize({ ...emptySave(), run }));
    broken.meta = { invalid: 'meta' };
    broken.run.player = null;
    const out = parseSave(JSON.stringify(broken));
    expect(out.save).toEqual(emptySave());
    expect(out.quarantined).toContain('meta');
    expect(out.quarantined).toContain('run');
  });

  it('meta 버전이 다르면 격리하고 run은 살린다', () => {
    const good = { ...emptySave(), run };
    const broken = JSON.parse(serialize(good));
    broken.meta.version = 99;
    const out = parseSave(JSON.stringify(broken));
    expect(out.save.run).not.toBeNull();
    expect(out.quarantined).toContain('meta');
  });
});

// Finding 2 — isRun이 위 넷을 막지 않았다면 실제로 벌어졌을 일. isRun 자체가 아니라
// 그 값이 통과했을 때 아래로 흘러가 터지는 실제 소비자(recordRunEnd·엔진의 uid
// 생성·SCHOOLS 역참조·availableNodes)를 직접 부른다 — 격리가 "왜" 필요한지, 이
// 값들을 막지 않으면 다음 저장부터 매번 재현되는 사고임을 증명한다.
describe('손상 격리가 막아야 하는 실제 사고 (Finding 2)', () => {
  it('stats가 없으면 recordRunEnd가 그 자리에서 터진다', () => {
    const broken = { ...run } as Partial<RunState>;
    delete broken.stats;
    expect(() => recordRunEnd(emptySave().meta, broken as RunState)).toThrow();
  });

  it('nextUid가 없으면 이후 새로 만드는 카드 uid가 전부 충돌한다', () => {
    // run.ts의 buy(card)는 `uid: c${nextUid}`와 `nextUid: nextUid + 1`을 따로
    // 계산한다(증가 연산자가 아니다). nextUid가 undefined면 첫 구매는 "cundefined"
    // 를 쓰고 저장 값은 undefined+1=NaN이 된다. NaN+1도 NaN이므로 그 다음부터는
    // 전부 "cNaN"으로 굳어 서로 충돌한다 — uid 기준 조회(removeCard·canUpgrade)가
    // 어느 카드를 가리키는지 더 이상 가릴 수 없다.
    const base = startRun('nextUid없음', CONTENT);
    const broken: RunState = {
      ...base,
      screen: 'shop',
      player: { ...base.player, gold: 999 },
      shop: [
        { kind: 'card', id: 'byeokta', price: 10 },
        { kind: 'card', id: 'bangsin', price: 10 },
        { kind: 'card', id: 'gangsu', price: 10 },
      ],
      nextUid: undefined as unknown as number,
    };
    const afterFirst = applyRunAction(broken, { type: 'buy', index: 0 }, CONTENT);
    const afterSecond = applyRunAction(afterFirst, { type: 'buy', index: 0 }, CONTENT);
    const afterThird = applyRunAction(afterSecond, { type: 'buy', index: 0 }, CONTENT);
    const bought = afterThird.player.deck.slice(-3);
    expect(bought[1]!.uid).toBe(bought[2]!.uid);
    expect(bought[0]!.uid).not.toBe(bought[1]!.uid);
  });

  it('school이 없으면 다음 전투 진입에서 SCHOOLS 역참조가 터진다', () => {
    const base = startRun('school없음', CONTENT);
    const broken: RunState = { ...base, school: undefined as unknown as 'gaebang' };
    const nodeId = base.map.layers[0]![0]!;
    expect(() => applyRunAction(broken, { type: 'chooseNode', nodeId }, CONTENT)).toThrow();
  });

  it("screen이 'bogus'면 맵 화면인데도 갈 수 있는 노드가 하나도 없어 갇힌다", () => {
    const base = startRun('screen고장', CONTENT);
    const broken = { ...base, screen: 'bogus' } as unknown as RunState;
    expect(availableNodes(broken)).toEqual([]);
  });
});

describe('기록', () => {
  it('완주는 승수와 최고 기록을 올린다', () => {
    const meta = recordRunEnd(emptySave().meta, { ...run, result: 'victory', act: 3, stats: { floors: 24, kills: 20, elites: 3 } });
    expect(meta.runsWon).toBe(1);
    expect(meta.bestAct).toBe(3);
    expect(meta.bestFloors).toBe(24);
  });

  it('패배는 승수를 올리지 않는다', () => {
    const meta = recordRunEnd(emptySave().meta, { ...run, result: 'defeat' });
    expect(meta.runsWon).toBe(0);
  });

  it('최고 기록은 내려가지 않는다', () => {
    const first = recordRunEnd(emptySave().meta, { ...run, result: 'defeat', act: 3, stats: { floors: 20, kills: 1, elites: 0 } });
    const second = recordRunEnd(first, { ...run, result: 'defeat', act: 1, stats: { floors: 2, kills: 1, elites: 0 } });
    expect(second.bestAct).toBe(3);
    expect(second.bestFloors).toBe(20);
  });
});
