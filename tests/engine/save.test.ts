import { describe, it, expect } from 'vitest';
import { emptySave, serialize, parseSave, recordRunEnd } from '../../src/engine/save';
import { startRun } from '../../src/engine/run';
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
