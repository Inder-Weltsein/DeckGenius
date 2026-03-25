/**
 * deckKey.ts — デッキキー正規化ユーティリティ
 *
 * 実装計画書 v2.0 Sprint 0 F-1 対応
 * evolutionLevel（限界突破）およびヒーロー状態を識別してキーに反映する。
 *
 * キー命名規則:
 *   通常カード    → "knight"
 *   限界突破 lv1  → "knight_evo"
 *   ヒーロー lv2  → "knight_hero"
 */

export interface BattleCardForKey {
    name: string;
    evolutionLevel?: number;
    iconUrls?: { medium?: string; evolutionMedium?: string; heroMedium?: string };
}

/**
 * カード1枚のキー断片を生成
 */
function cardToKeyPart(card: BattleCardForKey): string {
    const base = card.name.trim().toLowerCase();
    if (card.iconUrls?.heroMedium || (card.evolutionLevel ?? 0) >= 2) return base + "_hero";
    if ((card.evolutionLevel ?? 0) === 1) return base + "_evo";
    return base;
}

/**
 * バトルログのカードオブジェクト配列からデッキキーを生成（F-1対応版）
 * evolutionLevel と heroMedium を識別する
 */
export function generateDeckKeyFromCards(cards: BattleCardForKey[]): string {
    return [...cards]
        .map(cardToKeyPart)
        .sort()
        .join("_");
}

/**
 * カード名文字列配列からデッキキーを生成（後方互換・MetaDeck用）
 * 進化状態は識別しない（メタデッキ定義は通常カード名のみ）
 */
export function generateDeckKey(cards: string[]): string {
    return [...cards]
        .map(c => c.trim().toLowerCase())
        .sort()
        .join("_");
}

/**
 * デッキキーからカード名断片配列を復元
 */
export function parseDeckKey(deckKey: string): string[] {
    return deckKey.split("_");
}
