// src/ui/components/relics.ts
//
// 보유 기물 칩 한 줄. 원래 전투 상단바 안에만 있던 코드인데, 전투 밖 화면들도
// 같은 것을 보여줘야 해서 밖으로 뺐다 — 화면마다 베껴 두면 기물 표시 규칙이
// 다섯 벌로 갈라진다. 알 수 없는 id 를 만나도 던지지 않는다: 손상된 저장이
// 낯선 기물 id 를 물고 들어와도 화면 전체가 흰 종이가 되는 것보다 "이름 모를
// 기물 하나"라고 적어 두는 쪽이 낫다.
import { CONTENT } from '../../engine/gamedata';
import { el } from '../dom';

/**
 * 기물이 없으면 `null` 을 낸다. 빈 `<div class="relics">` 를 남기면 화면마다
 * 보이지 않는 여백과 `aria-label="기물"` 만 붙은 빈 구역이 생긴다.
 */
export function renderRelicStrip(relicIds: readonly string[]): HTMLElement | null {
  if (relicIds.length === 0) return null;

  const strip = el('div', { class: 'relics' });
  strip.setAttribute('aria-label', '기물');

  for (const id of relicIds) {
    let name = id;
    let hanja = '?';
    let text = '';
    try {
      const def = CONTENT.relic(id);
      name = def.name;
      hanja = def.hanja;
      text = def.text;
    } catch {
      text = '알 수 없는 기물';
    }
    const chip = el('span', { class: 'relic', title: `${name} — ${text}` }, [
      el('span', { class: 'relic-hanja', textContent: hanja }),
      el('span', { class: 'relic-name', textContent: name }),
    ]);
    chip.setAttribute('role', 'img');
    chip.setAttribute('aria-label', `기물 ${name}, ${text}`);
    strip.append(chip);
  }

  return strip;
}
