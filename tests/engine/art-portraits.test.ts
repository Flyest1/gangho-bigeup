// @vitest-environment happy-dom
//
// src/art/portraits.ts 회귀. 확인할 성질은 두 가지뿐이다 — 보스 셋(enemies.json에
// portrait가 있는)은 <img loading="lazy">를, 나머지는 fallbackFace(<svg>)를
// 받는다는 것, 그리고 fallbackFace는 같은 defId에 항상 같은 얼굴을 낸다는 것
// (Math.random을 쓰면 이 성질이 깨진다).
import { describe, expect, it } from 'vitest';
import { fallbackFace, portraitFor } from '../../src/art/portraits';

describe('portraitFor', () => {
  it('portrait 필드가 있는 보스는 <img loading="lazy">를 낸다', () => {
    const wrap = portraitFor('maechopung');
    const img = wrap.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.loading).toBe('lazy');
    expect(img!.src).toContain('portraits/maechopung.webp');
    expect(wrap.querySelector('svg')).toBeNull();
  });

  it('나머지 두 보스도 각자의 webp를 가리킨다', () => {
    expect(portraitFor('guchunin').querySelector('img')!.src).toContain('guchunin.webp');
    expect(portraitFor('guyangbong').querySelector('img')!.src).toContain('guyangbong.webp');
  });

  it('portrait 필드가 없는 일반 적은 fallbackFace(svg)를 받는다', () => {
    const wrap = portraitFor('deulgae');
    expect(wrap.querySelector('img')).toBeNull();
    expect(wrap.querySelector('svg')).not.toBeNull();
  });

  it('알 수 없는 defId라도 죽지 않고 fallbackFace로 대신한다', () => {
    const wrap = portraitFor('없는-적-id');
    expect(wrap.querySelector('svg')).not.toBeNull();
  });

  it('장식이라 스크린리더에서 숨는다', () => {
    expect(portraitFor('deulgae').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('fallbackFace', () => {
  it('viewBox가 0 0 64 64다', () => {
    expect(fallbackFace('deulgae').getAttribute('viewBox')).toBe('0 0 64 64');
  });

  it('같은 defId는 항상 같은 얼굴을 낸다(결정적)', () => {
    const a = fallbackFace('sanjeok');
    const b = fallbackFace('sanjeok');
    expect(a.outerHTML).toBe(b.outerHTML);
  });

  it('다른 defId는 (대개) 다른 얼굴을 낸다', () => {
    const ids = ['deulgae', 'sanjeok', 'geolbang_baesin', 'dokchung', 'heukpung_jol', 'jeonjin_doin'];
    const faces = new Set(ids.map((id) => fallbackFace(id).outerHTML));
    // 4종x3종x4종x3종 = 144가지 조합에 6개를 뽑았으니 전부 겹칠 확률은 무시할 만하다.
    expect(faces.size).toBeGreaterThan(1);
  });
});
