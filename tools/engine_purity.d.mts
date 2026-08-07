// engine_purity.mjs 의 타입 선언. 검사기 본체는 Node 가 그대로 실행해야 하므로
// (CI가 tsc 없이 `node tools/check_engine_purity.mjs` 로 부른다) .mjs 로 두고,
// 테스트가 타입 안전하게 부를 수 있도록 선언만 여기 붙인다.
export declare const BANNED_GLOBALS: Set<string>;
export declare const ALLOW_MARK: string;
export declare const ALLOW_LIMIT: number;

export interface CheckPurityOptions {
  /** 문제 메시지에 붙일 경로 접두사. 기본값 `src/engine`. */
  label?: string;
  /** `purity-allow` 로 면제할 수 있는 위반의 개수. 기본값 1. */
  allowLimit?: number;
}

/** 사람이 읽을 문제 목록을 낸다. 비어 있으면 통과. */
export declare function checkPurity(dir: string, opts?: CheckPurityOptions): string[];
