import type { Battle, CRCard } from "./clashApi";
import { META_DECKS, type MetaDeck } from "./metaDecks";
import { getArenaByTrophies, fetchArenaMetaFromDB, getArenaWinRate, ARENAS, type Arena, type ArenaMetaInfo } from "./arenaMeta";
import { checkRoles, countTag, ja, type RoleCheckResult } from "./cards";

// ===== ヘルパー関数: カードを絶対レベルに変換 =====
import { getCardDef } from "./cards";

function toAbsoluteCards(cards: CRCard[]): CRCard[] {
    return cards.map(c => {
        const def = getCardDef(c.name);
        let baseLevel = 1;
        if (def) {
            if (def.rarity === "common") baseLevel = 1;
            else if (def.rarity === "rare") baseLevel = 3;
            else if (def.rarity === "epic") baseLevel = 6;
            else if (def.rarity === "legendary") baseLevel = 9;
            else if (def.rarity === "champion") baseLevel = 11;
        } else {
            // Fallback 
            if (c.maxLevel === 14 || c.maxLevel === 15) baseLevel = 1;
            else if (c.maxLevel === 12 || c.maxLevel === 13) baseLevel = 3;
            else if (c.maxLevel === 9 || c.maxLevel === 10) baseLevel = 6;
            else if (c.maxLevel === 6 || c.maxLevel === 7) baseLevel = 9;
            else if (c.maxLevel === 4 || c.maxLevel === 5) baseLevel = 11;
        }

        const absLevel = Math.min(15, Math.max(1, baseLevel + c.level - 1));
        return { ...c, level: absLevel, maxLevel: 15 };
    });
}

// ===== 型定義 =====

export interface UpgradeCard {
    name: string;
    iconUrl: string;
    currentLevel: number;
    targetLevel: number;
    winRateBoost: number;
}

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

const TOC_WEIGHTS = {
    growth: 0.25,
    meta: 0.25,
    role: 0.25,
    synergy: 0.15,
    cost: 0.10,
};

// ===== ローカルメタ集計（直近25戦） =====

function analyzeLocalMeta(battles: Battle[]): { cardName: string; count: number }[] {
    const counter: Record<string, number> = {};
    for (const battle of battles.slice(0, 25)) {
        const opponent = battle.opponent?.[0];
        if (!opponent?.cards) continue;
        for (const card of opponent.cards) {
            counter[card.name] = (counter[card.name] ?? 0) + 1;
        }
    }
    return Object.entries(counter)
        .map(([cardName, count]) => ({ cardName, count }))
        .sort((a, b) => b.count - a.count);
}

function analyzeLossMeta(battles: Battle[]): Record<string, number> {
    const counter: Record<string, number> = {};
    const losses = battles.filter(
        (b) => (b.team?.[0]?.crownsEarned ?? 0) < (b.opponent?.[0]?.crownsEarned ?? 0)
    );
    for (const battle of losses.slice(0, 15)) {
        const opponent = battle.opponent?.[0];
        if (!opponent?.cards) continue;
        for (const card of opponent.cards) {
            counter[card.name] = (counter[card.name] ?? 0) + 1;
        }
    }
    return counter;
}

// ===== TOC 個別スコア計算 =====

/** ① 育成・レベル (0-100) */
function calcGrowthScore(metaDeck: MetaDeck, playerCards: CRCard[]): { score: number; resolvedCards: CRCard[] } {
    const cardMap = new Map<string, CRCard>(
        playerCards.map((c) => [c.name.toLowerCase(), c])
    );

    const resolvedCards: CRCard[] = [];
    let totalLevelRatio = 0;
    let missingCount = 0;

    for (const cardName of metaDeck.cards) {
        const owned = cardMap.get(cardName.toLowerCase());
        if (!owned) {
            missingCount++;
            continue;
        }
        resolvedCards.push(owned);
        const ratio = owned.level / 15;
        totalLevelRatio += ratio;
    }

    const avgRatio = resolvedCards.length > 0
        ? totalLevelRatio / resolvedCards.length
        : 0;

    // 欠損ペナルティ: 1枚 = -12点
    const missingPenalty = missingCount * 12;
    const score = Math.max(0, Math.round(avgRatio * 100 - missingPenalty));

    return { score, resolvedCards };
}

/** ② 環境・メタ (0-100): アリーナ勝率 + ローカルメタ対応を統合 */
function calcMetaScore(
    metaDeck: MetaDeck,
    arenaId: string,
    localMeta: { cardName: string; count: number }[],
    lossMeta: Record<string, number>
): number {
    // アリーナ別勝率（50%配分）
    const arenaWR = getArenaWinRate(arenaId, metaDeck.cards);
    const arenaScore = arenaWR !== null
        ? Math.min(100, Math.max(0, (arenaWR - 45) * 6.67))
        : Math.min(100, Math.max(0, (metaDeck.globalWinRate - 45) * 6.67));

    // ローカルメタ対応（50%配分）
    let localScore = 50;
    for (const { cardName, count } of localMeta.slice(0, 5)) {
        if (metaDeck.strongAgainst.some((s) => s.toLowerCase() === cardName.toLowerCase())) {
            localScore += count * 5;
        }
        if (metaDeck.counters.some((c) => c.toLowerCase() === cardName.toLowerCase())) {
            localScore -= count * 3;
        }
    }
    // 敗北メタ重点ペナルティ
    for (const [cardName, count] of Object.entries(lossMeta)) {
        if (metaDeck.counters.some((c) => c.toLowerCase() === cardName.toLowerCase())) {
            localScore -= count * 2;
        }
    }
    localScore = Math.min(100, Math.max(0, localScore));

    return Math.round(arenaScore * 0.5 + localScore * 0.5);
}

/** ③ 役割と呪文 (0-100) [TOC NEW] */
function calcRoleScore(metaDeck: MetaDeck): number {
    const cards = metaDeck.cards;
    const check = checkRoles(cards);

    let score = 100;

    // 主軸がない → -30
    if (!check.hasWinCondition) score -= 30;

    // 対空
    if (check.antiAirCount === 0) score -= 25;
    else if (check.antiAirCount === 1) score -= 10;

    // 呪文
    if (check.spellCount === 0) score -= 20;
    else if (check.spellCount >= 3) score -= 15;
    else if (check.spellCount >= 4) score -= 25;

    // タンク処理
    if (!check.hasTankKiller) score -= 15;

    // 範囲攻撃
    if (!check.hasSplash) score -= 10;

    return Math.max(0, score);
}

/** ④ シナジーボーナス (0-100) */
function calcSynergyScore(metaDeck: MetaDeck, playerCards: CRCard[]): number {
    if (!metaDeck.synergyPairs || metaDeck.synergyPairs.length === 0) return 50;

    const ownedSet = new Set(playerCards.map(c => c.name.toLowerCase()));
    let matchedPairs = 0;
    const totalPairs = metaDeck.synergyPairs.length;

    for (const [a, b] of metaDeck.synergyPairs) {
        if (ownedSet.has(a.toLowerCase()) && ownedSet.has(b.toLowerCase())) {
            matchedPairs++;
        }
    }

    return Math.round(30 + (matchedPairs / totalPairs) * 70);
}

/** ⑤ コスト効率 (0-100) [TOC NEW] — アーキタイプ別の適正コスト */
function calcCostScore(metaDeck: MetaDeck): number {
    const avg = metaDeck.avgElixir;
    const [idealMin, idealMax] = metaDeck.idealElixirRange;

    if (avg >= idealMin && avg <= idealMax) {
        // 適正帯内なら高得点。中心に近いほど満点
        const center = (idealMin + idealMax) / 2;
        const distFromCenter = Math.abs(avg - center);
        const range = (idealMax - idealMin) / 2;
        return Math.round(100 - (distFromCenter / range) * 15);
    }

    // 適正帯から外れた場合
    const outOfRange = avg < idealMin ? idealMin - avg : avg - idealMax;
    return Math.max(0, Math.round(80 - outOfRange * 25));
}

// ===== TOC 統合スコア =====

interface ScoredDeck {
    deck: MetaDeck;
    resolvedCards: CRCard[];
    totalScore: number;
    breakdown: ScoreBreakdown;
    roleCheck: RoleCheckResult;
}

function calcTOCScore(
    metaDeck: MetaDeck,
    playerCards: CRCard[],
    arenaId: string,
    localMeta: { cardName: string; count: number }[],
    lossMeta: Record<string, number>,
): ScoredDeck {
    const { score: growthScore, resolvedCards } = calcGrowthScore(metaDeck, playerCards);
    const metaScore = calcMetaScore(metaDeck, arenaId, localMeta, lossMeta);
    const roleScore = calcRoleScore(metaDeck);
    const synergyScore = calcSynergyScore(metaDeck, playerCards);
    const costScore = calcCostScore(metaDeck);

    const totalScore =
        growthScore * TOC_WEIGHTS.growth +
        metaScore * TOC_WEIGHTS.meta +
        roleScore * TOC_WEIGHTS.role +
        synergyScore * TOC_WEIGHTS.synergy +
        costScore * TOC_WEIGHTS.cost;

    // 先頭バイアス排除用の微小ノイズ (±1)
    const jitter = (Math.random() - 0.5) * 2;

    const roleCheck = checkRoles(metaDeck.cards);

    return {
        deck: metaDeck,
        resolvedCards,
        totalScore: totalScore + jitter,
        breakdown: { growthScore, metaScore, roleScore, synergyScore, costScore },
        roleCheck,
    };
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
        .filter((c) => c.level < 15)
        .sort((a, b) => {
            const gapA = 15 - a.level;
            const gapB = 15 - b.level;
            return gapB - gapA;
        })
        .slice(0, topN)
        .map((c) => {
            const gap = 15 - c.level;
            return {
                name: c.name,
                iconUrl: c.iconUrls?.medium ?? "",
                currentLevel: c.level,
                targetLevel: c.level + 1,
                winRateBoost: Math.round(gap * 0.5 * 10) / 10,
            };
        });
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
        (b) => (b.team?.[0]?.crownsEarned ?? 0) < (b.opponent?.[0]?.crownsEarned ?? 0)
    );
    const totalCount = Math.min(battles.length, 25);
    const winCount = totalCount - losses.length;
    const winRate = totalCount > 0 ? Math.round((winCount / totalCount) * 100) : 50;

    const arenaLabel = `${arena.icon} ${arena.name}帯`;

    const roleWarning = roleCheck && roleCheck.warnings.length > 0
        ? ` ※ ${roleCheck.warnings[0]}`
        : "";

    if (top1 && top2) {
        // デッキが実際にこれらに有利かどうかを判定
        const isStrongAgainst = deck.strongAgainst.some(c => c.toLowerCase() === top1.cardName.toLowerCase() || c.toLowerCase() === top2.cardName.toLowerCase());

        let reasonText = isStrongAgainst ? "これらに有利な" : "総合的に対応力の高い";

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

export async function analyze(
    playerName: string,
    trophies: number,
    playerCardsRaw: CRCard[],
    battles: Battle[],
    _apiArena?: { id: number; name: string }
): Promise<AnalysisResult> {
    // 0. 全カードを絶対レベル（実レベル）に統一
    const playerCards = toAbsoluteCards(playerCardsRaw);

    // 1. アリーナ判定（トロフィー優先）
    const arena = getArenaByTrophies(trophies);
    const arenaMetaInfo = await fetchArenaMetaFromDB(arena);

    // 2. ローカルメタ分析
    const localMeta = analyzeLocalMeta(battles);
    const lossMeta = analyzeLossMeta(battles);

    // 2. TOC スコアリング
    const scoredDecks = META_DECKS.map((deck) =>
        calcTOCScore(deck, playerCards, arena.id, localMeta, lossMeta)
    ).sort((a, b) => b.totalScore - a.totalScore);

    // 3. アーキタイプ重複なし上位3デッキ
    const selectedDecks: ScoredDeck[] = [];
    const usedArchetypes = new Set<string>();

    for (const candidate of scoredDecks) {
        if (selectedDecks.length >= 3) break;
        if (!usedArchetypes.has(candidate.deck.archetype)) {
            selectedDecks.push(candidate);
            usedArchetypes.add(candidate.deck.archetype);
        }
    }
    if (selectedDecks.length === 0) selectedDecks.push(scoredDecks[0]);

    const best = selectedDecks[0];
    const compatScore = Math.min(99, Math.max(30, Math.round(best.totalScore)));

    // 4. デッキ修正提案
    const deckSuggestions = generateDeckSuggestions(best.roleCheck);

    // 5. コーチメッセージ
    const coachMessage = generateCoachMessage(localMeta, best.deck, compatScore, battles, arena, best.roleCheck);

    // 6. 育成優先度
    const upgradePriority = calcUpgradePriority(best.resolvedCards);

    // 7. 代替デッキ
    const alternativeDecks = selectedDecks.slice(1).map((s) => ({
        meta: s.deck,
        cards: s.resolvedCards,
        compatibilityScore: Math.min(99, Math.max(20, Math.round(s.totalScore))),
        scoreBreakdown: s.breakdown,
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
            scoreBreakdown: best.breakdown,
            roleCheck: best.roleCheck,
            deckSuggestions,
        },
        alternativeDecks,
        localMeta: localMeta.slice(0, 5),
        upgradePriority,
    };
}
