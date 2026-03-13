/**
 * wilsonStats.ts — Wilson補正勝率 / EMA / Composite Score
 *
 * 設計書 v1.0 §3 に準拠
 * ② 勝率計算・トレンド分析エンジンの中核ロジック。
 */

// ===== Wilson Score Lower Bound =====

/**
 * Wilson補正勝率を計算する
 * サンプルが少ないデッキは信頼区間が広がり、自動的に保守的な評価になる。
 *
 * @param wins 勝利数
 * @param total 総試合数
 * @param z z値（デフォルト 1.96 = 95%信頼水準）
 * @returns Wilson Score Lower Bound (0〜1)
 */
export function wilsonWinRate(wins: number, total: number, z: number = 1.96): number {
    if (total === 0) return 0;

    const p = wins / total;
    const z2 = z * z;
    const n = total;

    const numerator = p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
    const denominator = 1 + z2 / n;

    return Math.max(0, numerator / denominator);
}

// ===== EMAフィルタ =====

/**
 * 指数移動平均（EMA）を更新する
 * α=0.3: 実効窓 ≈ 3日
 *
 * @param alpha 平滑化係数（0〜1、大きいほど直近重視）
 * @param currentValue 今日の値
 * @param previousEma 前回のEMA値
 * @returns 新しいEMA値
 */
export function updateEma(alpha: number, currentValue: number, previousEma: number): number {
    return alpha * currentValue + (1 - alpha) * previousEma;
}

// ===== WR Delta =====

/**
 * 勝率変化量を計算する
 * 正規化: アリーナ全体の平均WR変化を差し引く
 *
 * @param wr7d 直近7日の勝率
 * @param wr14d 直近14日の勝率
 * @param arenaMeanDelta アリーナ全体の平均WR変動（パッチ影響の除去用）
 * @returns 正規化されたWR Delta
 */
export function calcWrDelta(wr7d: number, wr14d: number, arenaMeanDelta: number = 0): number {
    return (wr7d - wr14d) - arenaMeanDelta;
}

// ===== Popularity Velocity =====

/**
 * 使用率速度を計算する
 *
 * @param usageRate7d 直近7日の使用率
 * @param usageRate14d 直近14日の使用率
 * @returns velocity
 */
export function calcVelocity(usageRate7d: number, usageRate14d: number): number {
    return usageRate7d - usageRate14d;
}

// ===== Composite Score =====

/**
 * 3指標を統合したComposite Scoreを計算
 * デフォルトは均等型（α=β=γ=1/3）
 *
 * @param wilsonWr Wilson補正勝率（0〜1）
 * @param wrDelta 勝率変化量
 * @param velocity 使用率速度
 * @param weights 各指標の重み [wilson, delta, velocity]
 * @returns composite score (0〜100)
 */
export function calcCompositeScore(
    wilsonWr: number,
    wrDelta: number,
    velocity: number,
    weights: [number, number, number] = [1 / 3, 1 / 3, 1 / 3]
): number {
    // Wilson WRを0〜100にスケール
    const wrNorm = wilsonWr * 100;

    // WR Deltaを-10〜+10の範囲を0〜100に正規化
    const deltaNorm = Math.min(100, Math.max(0, 50 + wrDelta * 500));

    // Velocityを-0.1〜+0.1の範囲を0〜100に正規化
    const velNorm = Math.min(100, Math.max(0, 50 + velocity * 500));

    const [wWr, wDelta, wVel] = weights;
    return wWr * wrNorm + wDelta * deltaNorm + wVel * velNorm;
}

// ===== サンプル数チェック =====

/** 表示可能な最低バトル数 */
export const MIN_DISPLAY_BATTLES = 170;

/** WR Deltaの比較判定に必要な最低数 */
export const MIN_DELTA_BATTLES = 50;

/** 統計的に有意な勝率と表示するための最低数 */
export const MIN_SIGNIFICANT_BATTLES = 1700;

/**
 * サンプル品質を判定する
 */
export function getSampleQuality(sampleCount: number): "insufficient" | "beta" | "standard" | "high" {
    if (sampleCount < MIN_DISPLAY_BATTLES) return "insufficient";
    if (sampleCount < 1000) return "beta";
    if (sampleCount < MIN_SIGNIFICANT_BATTLES) return "standard";
    return "high";
}
