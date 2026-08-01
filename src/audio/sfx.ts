// src/audio/sfx.ts
//
// 절차 합성 효과음. 오디오 파일을 하나도 부르지 않는다 — 오실레이터와 게인
// 엔벨로프로 그 자리에서 소리를 만든다. `AudioContext`는 첫 재생 요청에서 지연
// 생성한다(브라우저가 사용자 제스처 없이는 소리를 막으므로, 그리고 이 모듈의
// `play`는 이 게임에서 항상 클릭/키보드 핸들러 안에서만 불린다).
//
// 생성이든 재생이든 실패하면 조용히 무음이 될 뿐이어야 한다 — 헤드리스 환경,
// 엄격한 브라우저 정책, 아직 `AudioContext`가 없는 구형 브라우저에서도 판은
// 계속 돌아야 한다. 그래서 오디오 관련 호출은 전부 try/catch로 감싼다.
export type SfxName = 'card' | 'hit' | 'break' | 'block' | 'combo' | 'defeat' | 'victory';

const STORAGE_KEY = 'gangho.sfx';

function readEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

function writeEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    // 저장 공간이 없거나 비공개 모드라도 이번 세션의 설정 자체는 메모리에 남는다.
  }
}

type AudioCtor = new () => AudioContext;

function resolveCtor(): AudioCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

let ctx: AudioContext | null = null;
let ctxFailed = false;

/** 첫 호출에서만 실제로 생성을 시도한다. 실패하면 다시 시도하지 않고 계속 무음이다. */
function ensureCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (ctxFailed) return null;
  try {
    const Ctor = resolveCtor();
    if (!Ctor) {
      ctxFailed = true;
      return null;
    }
    ctx = new Ctor();
    return ctx;
  } catch {
    ctxFailed = true;
    return null;
  }
}

function envGain(c: AudioContext, at: number, peak: number, attack: number, release: number): GainNode {
  const g = c.createGain();
  const a = Math.max(0.002, attack);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(peak, at + a);
  g.gain.exponentialRampToValueAtTime(0.0001, at + a + release);
  return g;
}

interface ToneOpts {
  type: OscillatorType;
  freq: number;
  at: number;
  dur: number;
  peak?: number;
  /** 있으면 freq에서 이 값으로 지수적으로 미끄러진다(스윕). */
  freqEnd?: number;
}

function tone(c: AudioContext, opts: ToneOpts): void {
  const osc = c.createOscillator();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(Math.max(1, opts.freq), opts.at);
  if (opts.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), opts.at + opts.dur);
  }
  const gain = envGain(c, opts.at, opts.peak ?? 0.25, Math.min(0.015, opts.dur * 0.15), opts.dur);
  osc.connect(gain).connect(c.destination);
  osc.start(opts.at);
  osc.stop(opts.at + opts.dur + 0.05);
}

/** 잡음 버스트. 판정 자료가 아니라 피드백일 뿐이라 매번 스펙트럼이 달라도 무방하다. */
function noiseBurst(c: AudioContext, at: number, dur: number, peak: number, freq: number): void {
  const size = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, size, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const gain = envGain(c, at, peak, 0.002, dur);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(at);
  src.stop(at + dur + 0.02);
}

const C4 = 261.6256;
function noteFreq(semitonesFromC4: number): number {
  return C4 * 2 ** (semitonesFromC4 / 12);
}

type Recipe = (c: AudioContext, now: number) => void;

const RECIPES: Record<SfxName, Recipe> = {
  // 짧은 나무 소리 — 삼각파 220Hz, 60ms.
  card: (c, t) => tone(c, { type: 'triangle', freq: 220, at: t, dur: 0.06, peak: 0.22 }),

  // 잡음 버스트 — 평범한 타격.
  hit: (c, t) => noiseBurst(c, t, 0.08, 0.32, 1400),

  // 파훼 전용. hit과 절대 헷갈리면 안 되는 이 게임의 가장 중요한 피드백이라,
  // 잡음 버스트(더 짧고 날카롭게) 위에 사와톱 하강 스윕을 얹어 "뚫렸다"는 느낌을 낸다.
  break: (c, t) => {
    noiseBurst(c, t, 0.05, 0.42, 2200);
    tone(c, { type: 'sawtooth', freq: 900, freqEnd: 110, at: t, dur: 0.22, peak: 0.3 });
  },

  // 저역 사인 — 막았다는 둔중한 느낌.
  block: (c, t) => tone(c, { type: 'sine', freq: 95, at: t, dur: 0.22, peak: 0.3 }),

  // 상승 3음.
  combo: (c, t) => {
    [0, 4, 7].forEach((semi, i) => {
      tone(c, { type: 'triangle', freq: noteFreq(semi), at: t + i * 0.07, dur: 0.09, peak: 0.22 });
    });
  },

  // 오음계 상승 — 밝게 끝맺는다.
  victory: (c, t) => {
    [0, 4, 7, 12, 16].forEach((semi, i) => {
      tone(c, { type: 'triangle', freq: noteFreq(semi), at: t + i * 0.1, dur: 0.16, peak: 0.24 });
    });
  },

  // 오음계 하강 — 낮고 느리게, 사인으로 가라앉는다.
  defeat: (c, t) => {
    [12, 10, 7, 3, 0].forEach((semi, i) => {
      tone(c, { type: 'sine', freq: noteFreq(semi - 12), at: t + i * 0.16, dur: 0.26, peak: 0.2 });
    });
  },
};

function schedule(recipe: Recipe): void {
  const c = ensureCtx();
  if (!c) return;
  try {
    if (c.state === 'suspended') void c.resume().catch(() => {});
    recipe(c, c.currentTime);
  } catch {
    // 오디오 그래프 구성이 실패해도(엄격한 정책, 드문 구현 차이 등) 게임은 계속된다.
  }
}

export const sfx: { enabled: boolean; play(name: SfxName): void; setEnabled(on: boolean): void } = {
  enabled: readEnabled(),
  play(name) {
    if (!sfx.enabled) return;
    schedule(RECIPES[name]);
  },
  setEnabled(on) {
    sfx.enabled = on;
    writeEnabled(on);
  },
};
