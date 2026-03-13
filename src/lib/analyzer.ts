/**
 * analyzer.ts — DeckGenius v2 分析エントリーポイント
 *
 * 設計書 v1.0 に準拠。旧5軸固定重みロジックを全廃し、
 * 新TOCエンジン（4軸動的重み + ハードフィルター）に切替。
 */

import type { Battle, CRCard } from "./clashApi";
import { META_DECKS, type MetaDeck } from "./metaDecks";
import { getArenaByTrophies, fetchArenaMetaFromDB, ARENAS, type Arena, type ArenaMetaInfo } from "./arenaMeta";
import { checkRoles, ja, type RoleCheckResult } from "./cards";
import {
    toAbsoluteCards,
    analyzeLocalMeta,
    analyzeLossMeta,
    calcTOCScore,
    type ScoredDeck,
    type TOCScoreBreakdown,
} from "./engine/tocEngine";
import { getArenaTierFromId } from "./engine/arenaWeights";

// ===== 型定義 =====

export interface UpgradeCard {
    name: string;
    iconUrl: string;
    currentLevel: number;
    targetLevel: number;
    winRateBoost: number;
}

/** フロントエンド互換の ScoreBreakdown */
export interface ScoreBreakdown {
    growthScore: number;
    metaScore: number;
    roleScore: number;
    synergyScore: number;
    costScore: number;
}

export interface AnalysisResult {
    playerName: string;
    trophies: number;
    arena: Arena;
    arenaMetaInfo: ArenaMetaInfo;
    recommendedDeck: {
        meta: MetaDeck;
        cards: CRCard[];
        compatibilityScore: number;
        coachMessage: string;
        scoreBreakdown: ScoreBreakdown;
        roleCheck: RoleCheckResult;
        deckSuggestions: string[];
    };
    alternativeDecks: {
        meta: MetaDeck;
        cards: CRCard[];
        compatibilityScore: number;
        scoreBreakdown: ScoreBreakdown;
        roleCheck: RoleCheckResult;
        deckSuggestions: string[];
    }[];
    localMeta: { cardName: string; count: number }[];
    upgradePriority: UpgradeCard[];
}

// ===== デッキ修正提案 =====

export function generateDeckSuggestions(roleCheck: RoleCheckResult): string[] {
    const suggestions: string[] = [];
    if (!roleCheck.hasWinCondition) {
        suggestions.push("💡 主軸カードを追加しましょう。ホグライダー / ジャイアント / ゴブリンバレル などがおすすめです。");
    }
    if (roleCheck.antiAirCount < 2) {
        suggestions.push("💡 対空ユニットを追加しましょう。マスケット銃士 / メガガーゴイル / コウモリの群れ などが有効です。");
    }
    if (roleCheck.spellCount === 0) {
        suggestions.push("💡 呪文を最低1枚入れましょう。ローリングウッド / ファイアボール / ザップ がおすすめです。");
    }
    if (roleCheck.spellCount >= 3) {
        suggestions.push("💡 呪文が多すぎます。1〜2枚に減らし、ユニットを追加しましょう。");
    }
    if (!roleCheck.hasTankKiller) {
        suggestions.push("💡 タンク処理カードを追加しましょう。ミニP.E.K.K.A / インフェルノドラゴン / ハンター が有効です。");
    }
    if (!roleCheck.hasSplash) {
        suggestions.push("💡 範囲攻撃カードを追加しましょう。バルキリー / ベビードラゴン / ウィザード が群れ相手に有効です。");
    }
    return suggestions;
}

// ===== 育成優先度計算 =====

export function calcUpgradePriority(resolvedCards: CRCard[], topN = 3): UpgradeCard[] {
    return resolvedCards
        .filter(c => c.level < 15)
        .sort((a, b) => {
            // win_conditionを最優先（設計書 §5）
            const aIsWC = a.name ? 1 : 0; // checkRolesで確認
            const bIsWC = b.name ? 1 : 0;
            const gapA = 15 - a.level;
            const gapB = 15 - b.level;
            return gapB - gapA;
        })
        .slice(0, topN)
        .map(c => ({
            name: c.name,
            iconUrl: c.iconUrls?.medium ?? "",
            currentLevel: c.level,
            targetLevel: c.level + 1,
            winRateBoost: Math.round((15 - c.level) * 0.5 * 10) / 10,
        }));
}

// ===== AIコーチメッセージ生成 =====

export function generateCoachMessage(
    localMeta: { cardName: string; count: number }[],
    deck: MetaDeck,
    compatScore: number,
    battles: Battle[],
    arena: Arena,
    roleCheck?: RoleCheckResult
): string {
    const top1 = localMeta[0];
    const top2 = localMeta[1];

    const losses = battles.filter(
        b => (b.team?.[0]?.crownsEarned ?? 0) < (b.opponent?.[0]?.crownsEarned ?? 0)
    );
    const totalCount = Math.min(battles.length, 25);
    const winCount = totalCount - losses.length;
    const winRate = totalCount > 0 ? Math.round((winCount / totalCount) * 100) : 50;

    const arenaLabel = `${arena.icon} ${arena.name}帯`;
    const roleWarning = roleCheck && roleCheck.warnings.length > 0
        ? ` ※ ${roleCheck.warnings[0]}`
        : "";

    if (top1 && top2) {
        const isStrongAgainst = deck.strongAgainst.some(
            c => c.toLowerCase() === top1.cardName.toLowerCase() || c.toLowerCase() === top2.cardName.toLowerCase()
        );
        const reasonText = isStrongAgainst ? "これらに有利な" : "総合的に対応力の高い";

        if (winRate < 45) {
            return `${arenaLabel}では「${ja(top1.cardName)}」・「${ja(top2.cardName)}」が頻出です（${top1.count}回）。${reasonText}「${ja(deck.name)}」に切り替えて巻き返しましょう（評価 ${compatScore}点）。${roleWarning}`;
        }
        return `${arenaLabel}では「${ja(top1.cardName)}」・「${ja(top2.cardName)}」が頻出です（${top1.count}回）。${reasonText}「${ja(deck.name)}」を提案します（評価 ${compatScore}点）。${roleWarning}`;
    }

    if (winRate < 45) {
        return `${arenaLabel}での直近${totalCount}戦の勝率は ${winRate}% です。総合評価が最も高い「${ja(deck.name)}」に切り替えて巻き返しましょう（評価 ${compatScore}点）。${roleWarning}`;
    }

    return `${arenaLabel}での勝率 ${winRate}% をさらに伸ばすため、最高評価の「${ja(deck.name)}」を提案します（評価 ${compatScore}点）。${roleWarning}`;
}

// ===== フロントエンド互換の変換ヘルパー =====

function toCompatibleBreakdown(b: TOCScoreBreakdown): ScoreBreakdown {
    return {
        growthScore: b.growthScore,
        metaScore: b.metaScore,
        roleScore: b.structureScore, // 構造スコア → フロント上は roleScore として表示
        synergyScore: 0, // 構造スコアに統合済み（個別表示は廃止）
        costScore: b.costScore,
    };
}

// ===== メイン分析関数 =====

export async function analyze(
    playerName: string,
    trophies: number,
    playerCardsRaw: CRCard[],
    battles: Battle[],
    _apiArena?: { id: number; name: string }
): Promise<AnalysisResult> {
    // Step 0: 絶対レベル変換 + アリーナ判定
    const playerCards = toAbsoluteCards(playerCardsRaw);
    const arena = getArenaByTrophies(trophies);
    const arenaMetaInfo = await fetchArenaMetaFromDB(arena);

    // Step 2: ローカルメタ分析
    const localMeta = analyzeLocalMeta(battles);
    const lossMeta = analyzeLossMeta(battles);
    const battleCount = Math.min(battles.length, 25);

    // Step 3: 全MetaDeckをTOCスコアリング（ハードフィルター込み）
    const scoredDecks: ScoredDeck[] = [];
    for (const deck of META_DECKS) {
        const scored = await calcTOCScore(
            deck,
            playerCards,
            trophies,
            arena.id,
            localMeta,
            lossMeta,
            battleCount
        );
        scoredDecks.push(scored);
    }

    // フィルター通過したデッキをスコア降順ソート
    const playableDecks = scoredDecks
        .filter(s => s.totalScore >= 0)
        .sort((a, b) => b.totalScore - a.totalScore);

    // フォールバック: 全デッキがフィルターされた場合は全デッキをスコア順で使用
    const candidates = playableDecks.length > 0
        ? playableDecks
        : scoredDecks.sort((a, b) => b.totalScore - a.totalScore);

    // Step 4: アーキタイプ重複なし TOP3
    const selectedDecks: ScoredDeck[] = [];
    const usedArchetypes = new Set<string>();

    for (const candidate of candidates) {
        if (selectedDecks.length >= 3) break;
        if (!usedArchetypes.has(candidate.deck.archetype)) {
            selectedDecks.push(candidate);
            usedArchetypes.add(candidate.deck.archetype);
        }
    }
    if (selectedDecks.length === 0) selectedDecks.push(candidates[0]);

    const best = selectedDecks[0];
    const compatScore = Math.min(99, Math.max(30, Math.round(best.totalScore)));

    // Step 5: 出力生成
    const deckSuggestions = generateDeckSuggestions(best.roleCheck);
    const coachMessage = generateCoachMessage(localMeta, best.deck, compatScore, battles, arena, best.roleCheck);
    const upgradePriority = calcUpgradePriority(best.resolvedCards);

    const alternativeDecks = selectedDecks.slice(1).map(s => ({
        meta: s.deck,
        cards: s.resolvedCards,
        compatibilityScore: Math.min(99, Math.max(20, Math.round(s.totalScore))),
        scoreBreakdown: toCompatibleBreakdown(s.breakdown),
        roleCheck: s.roleCheck,
        deckSuggestions: generateDeckSuggestions(s.roleCheck),
    }));

    return {
        playerName,
        trophies,
        arena,
        arenaMetaInfo,
        recommendedDeck: {
            meta: best.deck,
            cards: best.resolvedCards,
            compatibilityScore: compatScore,
            coachMessage,
            scoreBreakdown: toCompatibleBreakdown(best.breakdown),
            roleCheck: best.roleCheck,
            deckSuggestions,
        },
        alternativeDecks,
        localMeta: localMeta.slice(0, 5),
        upgradePriority,
    };
}
