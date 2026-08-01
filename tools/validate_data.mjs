// tools/validate_data.mjs
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));

const cards = [...read('cards_common.json'), ...read('cards_gaebang.json')];
const relics = read('relics.json');
const enemies = read('enemies.json');
const schools = read('schools.json');

const OPS = new Set(['damage', 'block', 'draw', 'gainQi', 'heal', 'applyStatus',
  'ifCombo', 'ifBreak', 'keepBlock', 'loseBlock', 'counterStance']);
const STATUSES = new Set(['poison', 'naesang', 'vulnerable', 'weak', 'momentum', 'afterimage']);
const LINES = new Set(['wai', 'gyeong', 'nae', 'sul']);
const RARITIES = new Set(['basic', 'common', 'rare', 'ultra']);
const MOD_KEYS = new Set(['maxHp', 'maxQi', 'handSize', 'startBlock', 'comboThreshold']);
// applyEnemyEffects 가 명시적으로 무시하는 원자들. 적 행동 데이터에서 금지한다.
const ENEMY_UNSUPPORTED = new Set(['draw', 'gainQi', 'keepBlock', 'loseBlock',
  'ifCombo', 'ifBreak', 'counterStance']);
const HOOKS = new Set(['onCombatStart', 'onTurnStart', 'onCombatEnd']);

const errors = [];
const fail = (msg) => errors.push(msg);

function checkEffects(where, atoms) {
  for (const a of atoms) {
    if (!OPS.has(a.op)) fail(`${where}: 알 수 없는 효과 ${a.op}`);
    if (a.op === 'applyStatus' && !STATUSES.has(a.status)) fail(`${where}: 알 수 없는 상태 ${a.status}`);
    if (a.then) checkEffects(where, a.then);
  }
}

const cardIds = new Set();
for (const c of cards) {
  if (cardIds.has(c.id)) fail(`카드 id 중복: ${c.id}`);
  cardIds.add(c.id);
  for (const key of ['name', 'hanja', 'school', 'line', 'rarity', 'target', 'text']) {
    if (!c[key]) fail(`${c.id}: ${key} 누락`);
  }
  if (!LINES.has(c.line)) fail(`${c.id}: 잘못된 계열 ${c.line}`);
  if (!RARITIES.has(c.rarity)) fail(`${c.id}: 잘못된 등급 ${c.rarity}`);
  if (!(c.cost >= 0 && c.cost <= 3)) fail(`${c.id}: 코스트 범위 밖 ${c.cost}`);
  if (!Array.isArray(c.effects) || c.effects.length === 0) fail(`${c.id}: 효과 없음`);
  checkEffects(c.id, c.effects ?? []);
  if (c.upgrade?.effects) checkEffects(`${c.id}+`, c.upgrade.effects);
}

const relicIds = new Set();
for (const r of relics) {
  if (relicIds.has(r.id)) fail(`기물 id 중복: ${r.id}`);
  relicIds.add(r.id);
  if (!RARITIES.has(r.rarity)) fail(`${r.id}: 잘못된 등급`);
  if (!r.text) fail(`${r.id}: 설명 누락`);
  for (const k of Object.keys(r.mods ?? {})) if (!MOD_KEYS.has(k)) fail(`${r.id}: 알 수 없는 보정 ${k}`);
  for (const t of r.triggers ?? []) {
    if (!HOOKS.has(t.hook)) fail(`${r.id}: 알 수 없는 훅 ${t.hook}`);
    checkEffects(r.id, t.effects ?? []);
    // 기물 훅은 술수(sul) 계열로 발동한다. 술수는 상성 순환에 참여하지 않으므로
    // ifBreak 는 어떤 경우에도 성립하지 않는다. 조용히 죽은 효과를 데이터에서 막는다.
    const walk = (atoms) => {
      for (const a of atoms) {
        if (a.op === 'ifBreak') fail(`${r.id}: 기물 훅에서 ifBreak 는 절대 발동하지 않는다`);
        if (a.then) walk(a.then);
      }
    };
    walk(t.effects ?? []);
  }
}

const enemyIds = new Set();
for (const e of enemies) {
  if (enemyIds.has(e.id)) fail(`적 id 중복: ${e.id}`);
  enemyIds.add(e.id);
  if (!Array.isArray(e.hp) || e.hp.length !== 2 || e.hp[0] > e.hp[1]) fail(`${e.id}: 체력 범위 이상`);
  if (!['normal', 'elite', 'boss'].includes(e.tier)) fail(`${e.id}: 잘못된 등급`);
  if (![1, 2, 3].includes(e.act)) fail(`${e.id}: 잘못된 막`);
  if (!e.actions?.length) fail(`${e.id}: 행동 없음`);
  for (const a of e.actions ?? []) {
    if (!LINES.has(a.line)) fail(`${e.id}/${a.id}: 잘못된 계열`);
    if (!(a.weight > 0)) fail(`${e.id}/${a.id}: 가중치는 양수여야 한다`);
    if (!a.label) fail(`${e.id}/${a.id}: 의도 문구 누락`);
    checkEffects(`${e.id}/${a.id}`, a.effects ?? []);
    // combat.ts 의 applyEnemyEffects 가 처리하지 않는 원자들이다. 거기서는 명시적으로
    // 무시되므로 조용히 아무 일도 일어나지 않는다. 데이터 단계에서 막는다.
    const walkEnemy = (atoms) => {
      for (const x of atoms) {
        if (ENEMY_UNSUPPORTED.has(x.op)) fail(`${e.id}/${a.id}: 적 행동은 ${x.op} 를 지원하지 않는다`);
        if (x.then) walkEnemy(x.then);
      }
    };
    walkEnemy(a.effects ?? []);
  }
}

for (const [id, s] of Object.entries(schools)) {
  if (s.startingDeck.length !== 10) fail(`${id}: 시작 덱은 10장이어야 한다`);
  for (const c of s.startingDeck) if (!cardIds.has(c)) fail(`${id}: 없는 시작 카드 ${c}`);
  if (!relicIds.has(s.startingRelic)) fail(`${id}: 없는 시작 기물 ${s.startingRelic}`);
}

for (const act of [1, 2, 3]) {
  const of = (tier) => enemies.filter((e) => e.act === act && e.tier === tier).length;
  if (of('normal') < 4) fail(`${act}막: 일반 적이 4종 미만`);
  if (of('elite') < 1) fail(`${act}막: 정예 없음`);
  if (of('boss') < 1) fail(`${act}막: 보스 없음`);
}

if (errors.length) {
  console.error(`데이터 검증 실패 ${errors.length}건:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`데이터 검증 통과 — 카드 ${cards.length} · 기물 ${relics.length} · 적 ${enemies.length}`);
