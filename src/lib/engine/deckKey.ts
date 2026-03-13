/**
 * deckKey.ts — デッキキー正規化ユーティリティ
 *
 * カード名8枚をアルファベット順にソートし "_" で結合した一意キーを生成する。
 * 同じカード構成のデッキは必ず同一の deck_key を持つ。
 */

/**
 * カード名配列からデッキキーを生成
 * @param cards カード名（英語）の配列（8枚）
 * @returns ソート済みカード名を "_" で結合した正規化キー
 */
export function generateDeckKey(cards: string[]): string {
    return [...cards]
        .map(c => c.trim().toLowerCase())
        .sort()
        .join("_");
}

/**
 * デッキキーからカード名配列を復元
 */
export function parseDeckKey(deckKey: string): string[] {
    return deckKey.split("_");
}
