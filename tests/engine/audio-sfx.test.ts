// @vitest-environment happy-dom
//
// src/audio/sfx.ts 회귀. 이 환경(happy-dom)에는 AudioContext가 없으므로, 그
// 자체가 "실패해도 조용히 무음이 될 뿐"이라는 요구를 자연스럽게 검증해 준다.
// 합성 그래프 자체(오실레이터·게인 엔벨로프 수식이 유효한 값을 내는지)는 최소
// Web Audio 표면을 흉내 낸 가짜 AudioContext를 주입해 확인한다.
//
// sfx는 모듈 스코프에 AudioContext 인스턴스를 캐시하므로, 테스트마다
// vi.resetModules() + 동적 import로 깨끗한 상태에서 시작한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'gangho.sfx';
const ALL_NAMES = ['card', 'hit', 'break', 'block', 'combo', 'defeat', 'victory'] as const;

class FakeParam {
  setValueAtTime(_v: number, _t: number): void {}
  linearRampToValueAtTime(_v: number, _t: number): void {}
  exponentialRampToValueAtTime(v: number, _t: number): void {
    // 실제 Web Audio도 0 이하로는 지수 램프를 허용하지 않는다 — 우리 envGain이
    // 이 규칙을 어기면 여기서 바로 터진다.
    if (!(v > 0)) throw new RangeError(`exponential ramp target must be > 0, got ${v}`);
  }
}

class FakeOsc {
  type = 'sine';
  frequency = new FakeParam();
  connect(dest: unknown): unknown { return dest; }
  start(_t: number): void {}
  stop(_t: number): void {}
}

class FakeFilter {
  type = 'lowpass';
  frequency = { value: 0 };
  connect(dest: unknown): unknown { return dest; }
}

class FakeBufferSource {
  buffer: unknown;
  connect(dest: unknown): unknown { return dest; }
  start(_t: number): void {}
  stop(_t: number): void {}
}

class FakeGain {
  gain = new FakeParam();
  connect(dest: unknown): unknown { return dest; }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  sampleRate = 44100;
  currentTime = 0;
  state: 'running' | 'suspended' = 'running';
  destination = {};
  oscillators: FakeOsc[] = [];
  bufferSources: FakeBufferSource[] = [];

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain(): FakeGain { return new FakeGain(); }

  createOscillator(): FakeOsc {
    const o = new FakeOsc();
    this.oscillators.push(o);
    return o;
  }

  createBiquadFilter(): FakeFilter { return new FakeFilter(); }

  createBuffer(_channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data, length, sampleRate };
  }

  createBufferSource(): FakeBufferSource {
    const s = new FakeBufferSource();
    this.bufferSources.push(s);
    return s;
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
}

function setGlobalAudioContext(ctor: unknown): void {
  (window as unknown as { AudioContext?: unknown }).AudioContext = ctor;
}

function clearGlobalAudioContext(): void {
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  FakeAudioContext.instances.length = 0;
  clearGlobalAudioContext();
});

describe('sfx — 설정 저장', () => {
  it('기본은 켜짐이다', async () => {
    const { sfx } = await import('../../src/audio/sfx');
    expect(sfx.enabled).toBe(true);
  });

  it('setEnabled(false)가 gangho.sfx에 저장되고, 다시 불러와도 유지된다', async () => {
    const { sfx } = await import('../../src/audio/sfx');
    sfx.setEnabled(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('0');

    vi.resetModules();
    const reloaded = await import('../../src/audio/sfx');
    expect(reloaded.sfx.enabled).toBe(false);
  });

  it('setEnabled(true)는 1로 저장된다', async () => {
    const { sfx } = await import('../../src/audio/sfx');
    sfx.setEnabled(false);
    sfx.setEnabled(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('localStorage.getItem이 실패해도 기본값(켜짐)으로 시작한다', async () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('boom'); };
    try {
      const { sfx } = await import('../../src/audio/sfx');
      expect(sfx.enabled).toBe(true);
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  it('localStorage.setItem이 실패해도(비공개 모드 등) setEnabled 자체는 죽지 않는다', async () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('quota'); };
    try {
      const { sfx } = await import('../../src/audio/sfx');
      expect(() => sfx.setEnabled(false)).not.toThrow();
      expect(sfx.enabled).toBe(false); // 저장은 실패해도 이번 세션의 상태는 바뀐다.
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe('sfx — AudioContext 없이도 게임은 계속된다', () => {
  it('AudioContext 자체가 없는 환경(이 테스트 환경)에서 모든 이름이 예외 없이 지나간다', async () => {
    const { sfx } = await import('../../src/audio/sfx');
    for (const name of ALL_NAMES) expect(() => sfx.play(name)).not.toThrow();
  });

  it('AudioContext 생성자가 던져도 조용히 무음이 된다', async () => {
    class ThrowingCtx {
      constructor() { throw new Error('정책 위반'); }
    }
    setGlobalAudioContext(ThrowingCtx);
    const { sfx } = await import('../../src/audio/sfx');
    expect(() => sfx.play('card')).not.toThrow();
    // 한 번 실패하면 다시 시도하지 않고 계속 조용해야 한다.
    expect(() => sfx.play('victory')).not.toThrow();
  });

  it('꺼져 있으면(setEnabled(false)) play를 불러도 그래프를 만들지 않는다', async () => {
    setGlobalAudioContext(FakeAudioContext);
    const { sfx } = await import('../../src/audio/sfx');
    sfx.setEnabled(false);
    sfx.play('hit');
    expect(FakeAudioContext.instances).toHaveLength(0);
  });
});

describe('sfx — 실제 합성 그래프(가짜 AudioContext 주입)', () => {
  it('일곱 이름 전부 유효한 오디오 그래프를 만든다(엔벨로프 수식이 안 터진다)', async () => {
    setGlobalAudioContext(FakeAudioContext);
    const { sfx } = await import('../../src/audio/sfx');
    for (const name of ALL_NAMES) expect(() => sfx.play(name)).not.toThrow();
    expect(FakeAudioContext.instances).toHaveLength(1); // AudioContext는 한 번만 만든다.
  });

  it('break는 hit과 다른 그래프다 — 파훼는 절대 hit과 헷갈리면 안 된다', async () => {
    setGlobalAudioContext(FakeAudioContext);
    const { sfx } = await import('../../src/audio/sfx');

    sfx.play('hit');
    const ctx = FakeAudioContext.instances[0]!;
    const hitOsc = ctx.oscillators.length;
    const hitBuf = ctx.bufferSources.length;

    sfx.play('break');
    const breakOsc = ctx.oscillators.length - hitOsc;
    const breakBuf = ctx.bufferSources.length - hitBuf;

    // hit은 잡음 버스트뿐이고(오실레이터 0개), break는 그 위에 하강 스윕
    // 오실레이터를 더 얹는다 — 그래프 자체가 서로 다르다.
    expect(hitOsc).toBe(0);
    expect(hitBuf).toBe(1);
    expect(breakOsc).toBe(1);
    expect(breakBuf).toBe(1);
  });

  it('block은 오실레이터 하나(저역 사인)만 만든다', async () => {
    setGlobalAudioContext(FakeAudioContext);
    const { sfx } = await import('../../src/audio/sfx');
    sfx.play('block');
    const ctx = FakeAudioContext.instances[0]!;
    expect(ctx.oscillators).toHaveLength(1);
    expect(ctx.oscillators[0]!.type).toBe('sine');
    expect(ctx.bufferSources).toHaveLength(0);
  });

  it('combo는 세 음을, victory/defeat은 각각 오음계 다섯 음을 낸다', async () => {
    setGlobalAudioContext(FakeAudioContext);
    const { sfx } = await import('../../src/audio/sfx');

    sfx.play('combo');
    const afterCombo = FakeAudioContext.instances[0]!.oscillators.length;
    expect(afterCombo).toBe(3);

    sfx.play('victory');
    const afterVictory = FakeAudioContext.instances[0]!.oscillators.length;
    expect(afterVictory - afterCombo).toBe(5);

    sfx.play('defeat');
    const afterDefeat = FakeAudioContext.instances[0]!.oscillators.length;
    expect(afterDefeat - afterVictory).toBe(5);
  });

  it('suspended 상태면 resume을 시도한다', async () => {
    setGlobalAudioContext(FakeAudioContext);
    const { sfx } = await import('../../src/audio/sfx');
    sfx.play('card'); // AudioContext를 만들어 캐시에 태운다.
    const ctx = FakeAudioContext.instances[0]!;
    ctx.state = 'suspended';
    let resumed = false;
    const original = ctx.resume.bind(ctx);
    ctx.resume = () => { resumed = true; return original(); };
    sfx.play('card');
    expect(resumed).toBe(true);
  });
});
