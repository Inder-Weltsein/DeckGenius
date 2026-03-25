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

// ===== [2-3] ハイブリッド類似度 =====

import { hasTag, type CardTag } from "../cards";

/** 役割ベクトルに使う次元（タグ一覧） */
const ROLE_DIMS: CardTag[] = [
    "win_condition", "tank", "spell", "anti_air",
    "tank_killer", "splash", "cycle", "building",
    "support", "swarm", "bridge_spam",
];

/**
 * デッキ（カード名配列）を役割ビットベクトルに変換する
 * 各次元 = そのタグを持つカードがデッキに1枚以上あるか
 */
function deckToRoleVector(cards: string[]): number[] {
    return ROLE_DIMS.map(role =>
        cards.some(c => hasTag(c, role)) ? 1 : 0
    );
}

/**
 * コサイン類似度（0〜1）
 */
function cosineSim(a: number[], b: number[]): number {
    const dot = a.reduce((s, v, i) => s + v * b[i], 0);
    const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
}

/**
 * Jaccard係数（カード集合の重複率）
 */
export function calcJaccardSimilarity(cardsA: string[], cardsB: string[]): number {
    const setA = new Set(cardsA.map(c => c.trim().toLowerCase()));
    const setB = new Set(cardsB.map(c => c.trim().toLowerCase()));
    const intersection = [...setA].filter(c => setB.has(c)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

/**
 * 役割ベクトルのコサイン類似度（戦略的類似性）
 */
export function calcRoleVectorSimilarity(cardsA: string[], cardsB: string[]): number {
    return cosineSim(deckToRoleVector(cardsA), deckToRoleVector(cardsB));
}

/**
 * ハイブリッド類似度（Jaccard 40% + 役割ベクトル 40% + embedding 20%）
 * embeddingSim は外部から渡す（DBのコサイン類似度）
 */
export function calcHybridSimilarity(
    cardsA: string[],
    cardsB: string[],
    embeddingSim: number = 0
): number {
    const jaccard = calcJaccardSimilarity(cardsA, cardsB);
    const roleSim = calcRoleVectorSimilarity(cardsA, cardsB);
    return jaccard * 0.4 + roleSim * 0.4 + embeddingSim * 0.2;
}
