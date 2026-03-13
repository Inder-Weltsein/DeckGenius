/**
 * arenaWeights.ts — アリーナ別動的重み＆推奨レベルテーブル
 *
 * 設計書 v1.0 §4.3 / Table 12, 13 に準拠
 * 低アリーナでは育成が支配的、高アリーナではメタが支配的。
 */

// ===== アリーナ帯分類 =====

export type ArenaTier = "low" | "mid" | "high" | "champion";

/**
 * トロフィーからアリーナ帯（重み選択用）を判定
 */
export function getArenaTier(trophies: number): ArenaTier {
    if (trophies >= 15000) return "champion";
    if (trophies >= 10000) return "high";
    if (trophies >= 5000) return "mid";
    return "low";
}

/**
 * アリーナID文字列からアリーナ帯を判定
 */
export function getArenaTierFromId(arenaId: string): ArenaTier {
    // ultimate, top-ladder → champion
    if (["ultimate", "top-ladder", "arena_22", "arena_23"].includes(arenaId)) return "champion";
    // grandmaster, champion → high
    if (["grandmaster", "champion", "arena_17", "arena_18", "arena_19", "arena_20", "arena_21"].includes(arenaId)) return "high";
    // master, challenger → mid
    if (["master", "challenger", "arena_12", "arena_13", "arena_14", "arena_15", "arena_16"].includes(arenaId)) return "mid";
    // beginner → low
    return "low";
}

// ===== 4軸動的重み =====

export interface TOCWeights {
    growth: number;    // 育成スコア
    meta: number;      // メタスコア
    structure: number; // 構造スコア
    cost: number;      // コストスコア
}

/**
 * アリーナ帯別の4軸重みテーブル
 * 設計書 Table 13 準拠
 */
const WEIGHT_TABLE: Record<ArenaTier, TOCWeights> = {
    low:      { growth: 0.40, meta: 0.20, structure: 0.30, cost: 0.10 },
    mid:      { growth: 0.28, meta: 0.28, structure: 0.30, cost: 0.14 },
    high:     { growth: 0.15, meta: 0.38, structure: 0.32, cost: 0.15 },
    champion: { growth: 0.10, meta: 0.40, structure: 0.38, cost: 0.12 },
};

export function getTOCWeights(tier: ArenaTier): TOCWeights {
    return WEIGHT_TABLE[tier];
}

// ===== アリーナ別推奨レベル =====

/**
 * 設計書 Table 12 準拠
 * ハードフィルターで使用: win_conditionが推奨Lv-2未満なら除外
 */
const RECOMMENDED_LEVEL_TABLE: { maxTrophies: number; recommendedLevel: number }[] = [
    { maxTrophies: 3000,  recommendedLevel: 7 },
    { maxTrophies: 5000,  recommendedLevel: 9 },
    { maxTrophies: 10000, recommendedLevel: 11 },
    { maxTrophies: 15000, recommendedLevel: 13 },
    { maxTrophies: Infinity, recommendedLevel: 14 },
];

export function getRecommendedLevel(trophies: number): number {
    for (const entry of RECOMMENDED_LEVEL_TABLE) {
        if (trophies <= entry.maxTrophies) return entry.recommendedLevel;
    }
    return 14;
}
