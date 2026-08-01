import { CONTENT } from '../src/engine/gamedata';
import { applyRunAction, availableNodes, startRun, type RunState } from '../src/engine/run';
import { canPlay, effectiveCard } from '../src/engine/combat';
import { Rng, seedFrom } from '../src/engine/rng';

const RUNS = Number(process.argv[2] ?? 300);

/** 낼 수 있는 카드를 아무거나 내고, 못 내면 턴을 넘기는 최소 휴리스틱. */
function playCombat(run: RunState, rng: Rng): RunState {
  let s = run;
  for (let guard = 0; guard < 4000 && s.screen === 'combat' && s.combat; guard++) {
    const playable = s.combat.hand.filter((c) => canPlay(s.combat!, c.uid, CONTENT));
    if (playable.length === 0) {
      s = applyRunAction(s, { type: 'combat', action: { type: 'endTurn' } }, CONTENT);
      continue;
    }
    // 공격 카드를 우선한다.
    const attack = playable.find((c) =>
      effectiveCard(CONTENT.card(c.defId), c.upgraded).effects.some((e) => e.op === 'damage'));
    const chosen = attack ?? rng.pick(playable);
    const target = s.combat.enemies.find((e) => e.hp > 0)?.uid;
    s = applyRunAction(s, { type: 'combat', action: { type: 'playCard', uid: chosen.uid, targetUid: target } }, CONTENT);
  }
  return s;
}

function playRun(seedText: string): RunState {
  // 시드 문자열 전체를 해싱한다. 길이만 쓰면 `시드0`..`시드999` 가 길이 3·4·5
  // 세 가지 상태로 뭉쳐, 1000회 중 900여 회가 같은 결정 스트림을 공유한다.
  const rng = new Rng(seedFrom(`ai:${seedText}`));
  let s = startRun(seedText, CONTENT);

  for (let guard = 0; guard < 500 && s.result === 'ongoing'; guard++) {
    if (s.screen === 'map') {
      const options = availableNodes(s);
      if (options.length === 0) break;
      s = applyRunAction(s, { type: 'chooseNode', nodeId: rng.pick(options) }, CONTENT);
    } else if (s.screen === 'combat') {
      s = playCombat(s, rng);
    } else if (s.screen === 'reward') {
      const pick = s.reward?.cards[rng.int(3)] ?? null;
      s = applyRunAction(s, { type: 'takeCard', cardId: pick }, CONTENT);
    } else if (s.screen === 'rest') {
      s = applyRunAction(s, { type: 'rest', choice: 'heal' }, CONTENT);
    } else if (s.screen === 'shop') {
      s = applyRunAction(s, { type: 'leave' }, CONTENT);
    } else {
      break;
    }
  }
  return s;
}

let wins = 0;
let floors = 0;
const deaths: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

for (let i = 0; i < RUNS; i++) {
  const result = playRun(`시드${i}`);
  floors += result.stats.floors;
  if (result.result === 'victory') wins++;
  else deaths[result.act] = (deaths[result.act] ?? 0) + 1;
}

console.log(`자동 플레이 ${RUNS}회`);
console.log(`  완주율      ${((wins / RUNS) * 100).toFixed(1)}%`);
console.log(`  평균 층수   ${(floors / RUNS).toFixed(1)}`);
console.log(`  막별 전멸   1막 ${deaths[1]} · 2막 ${deaths[2]} · 3막 ${deaths[3]}`);
