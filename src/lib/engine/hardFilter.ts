/**
 * hardFilter.ts — ハードフィルター（isPlayable）
 *
 * 設計書 v1.0 §4.2 Step 1 に準拠
 * スコアリング前に使用不可デッキを除外する。
 *
 * 除外条件:
 *   1. 未所持カードが1枚でも存在する
 *   2. win_conditionタグのカードが「推奨レベル−2」未満
 */

import type { CRCard } from "../clashApi";
import type { MetaDeck } from "../metaDecks";
import { getRecommendedLevel } from "./arenaWeights";
import { hasTag } from "../cards";

export interface PlayableResult {
    isPlayable: boolean;
    reason?: string;
}

/**
 * デッキがこのプレイヤーに使用可能かどうかを判定
 * @param metaDeck 評価対象のメタデッキ
 * @param playerCards プレイヤーの所持カード（絶対レベル変換済み）
 * @param trophies プレイヤーの現在トロフィー
 */
export function isPlayable(
    metaDeck: MetaDeck,
    playerCards: CRCard[],
    trophies: number
): PlayableResult {
    const cardMap = new Map<string, CRCard>(
        playerCards.map(c => [c.name.toLowerCase(), c])
    );

    const recommendedLevel = getRecommendedLevel(trophies);
    const minAllowedLevel = Math.max(1, recommendedLevel - 2);

    for (const cardName of metaDeck.cards) {
        const owned = cardMap.get(cardName.toLowerCase());

        // 条件1: 未所持カードが存在
        if (!owned) {
            return {
                isPlayable: false,
                reason: `未所持カード: ${cardName}`,
            };
        }

        // 条件2: win_conditionのレベルが推奨-2未満
        if (hasTag(cardName, "win_condition") && owned.level < minAllowedLevel) {
            return {
                isPlayable: false,
                reason: `${cardName} のレベルが不足 (Lv${owned.level} < 推奨Lv${minAllowedLevel})`,
            };
        }
    }

    return { isPlayable: true };
}
