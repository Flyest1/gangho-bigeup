import { matchup as computeMatchup, stanceMultiplier } from './stance';
import { consumeStatus, getStatus } from './status';
import type { Line, Matchup, Stance, StatusMap } from './types';

export interface DamageContext {
  base: number;
  /** 외공 연계 보너스처럼 기본값에 더해지는 값. */
  comboBonus?: number;
  attackerLine: Line;
  attackerStatus: StatusMap;
  defenderStance: Stance | null;
  defenderStatus: StatusMap;
  defenderBlock: number;
  /** 중독처럼 호신강기를 통과하는 피해. */
  ignoreBlock?: boolean;
}

export interface DamageResult {
  /** 모든 보정을 마친 피해량. 표시용. */
  amount: number;
  hpLoss: number;
  blockLoss: number;
  matchup: Matchup;
  broke: boolean;
  dodged: boolean;
  /** 잔상 소모가 반영된 방어자 상태. */
  defenderStatus: StatusMap;
}

/** 설계서 §2.5 순서: 기본+연계 → 기세 → 쇠약 → 취약 → 상성 → 잔상 → 호신강기 → 체력. */
export function computeDamage(ctx: DamageContext): DamageResult {
  const match = computeMatchup(ctx.attackerLine, ctx.defenderStance);
  const broke = match === 'break';

  let amount = ctx.base + (ctx.comboBonus ?? 0);
  amount += getStatus(ctx.attackerStatus, 'momentum');
  if (getStatus(ctx.attackerStatus, 'weak') > 0) amount = Math.floor(amount * 0.75);
  if (getStatus(ctx.defenderStatus, 'vulnerable') > 0) amount = Math.floor(amount * 1.5);
  amount = Math.floor(amount * stanceMultiplier(match));
  amount = Math.max(0, amount);

  if (getStatus(ctx.defenderStatus, 'afterimage') > 0) {
    return {
      amount,
      hpLoss: 0,
      blockLoss: 0,
      matchup: match,
      broke,
      dodged: true,
      defenderStatus: consumeStatus(ctx.defenderStatus, 'afterimage', 1),
    };
  }

  const bypassBlock = broke || ctx.ignoreBlock === true;
  const blockLoss = bypassBlock ? 0 : Math.min(ctx.defenderBlock, amount);

  return {
    amount,
    hpLoss: amount - blockLoss,
    blockLoss,
    matchup: match,
    broke,
    dodged: false,
    defenderStatus: { ...ctx.defenderStatus },
  };
}
