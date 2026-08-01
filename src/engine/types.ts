/** 무공 계열. 술수(sul)는 계열이 없어 상성과 연계 판정에서 제외된다. */
export type Line = 'wai' | 'gyeong' | 'nae' | 'sul';

/** 자세로 취할 수 있는 계열. 술수는 자세가 되지 않는다. */
export type Stance = 'wai' | 'gyeong' | 'nae';

export type Matchup = 'break' | 'neutral' | 'resisted';

export type Rarity = 'basic' | 'common' | 'rare' | 'ultra';

export type StatusId =
  | 'poison'      // 중독
  | 'naesang'     // 내상
  | 'vulnerable'  // 취약
  | 'weak'        // 쇠약
  | 'momentum'    // 기세
  | 'afterimage'; // 잔상

export type StatusMap = Partial<Record<StatusId, number>>;

export interface Combo {
  line: Stance | null;
  count: number;
}
