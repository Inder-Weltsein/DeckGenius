"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Flame, Crown, BarChart3, Filter, Sparkles, Swords } from "lucide-react";
import type { Arena, ArenaDeckStats, ArenaCardStats } from "@/lib/arenaMeta";
import { ja, getCardDef } from "@/lib/cards";

type ApiResponse = {
    arena: Arena;
    topDecks: ArenaDeckStats[];
    hotCards: string[];
    cardStats: ArenaCardStats[];
    allArenas: Arena[];
};

type MatchupRow = { deckKey: string; label: string; winRate: number; total: number };
type MatchupData = { counters: MatchupRow[]; victims: MatchupRow[] };

type ViewMode = "decks" | "cards";
type CardTypeFilter = "all" | "troop" | "spell" | "building";

// ===== デッキキーから evo/hero カードを解析するヘルパー =====
// deck_key 形式: "archers_goblin-barrel_evo_hog-rider_..." （_区切り、_evo/_heroはサフィックス）
function parseEvoInfoFromDeckId(deckId: string, cards: string[]): { evoCards: Set<string>; heroCards: Set<string> } {
    const evoCards = new Set<string>();
    const heroCards = new Set<string>();
    const tokens = deckId.split("_");
    for (let i = 1; i < tokens.length; i++) {
        if (tokens[i] === "evo" || tokens[i] === "hero") {
            const baseToken = tokens[i - 1];
            for (const card of cards) {
                // cardToKeyPart と同じ正規化: trim().toLowerCase() のみ（ハイフン変換なし）
                const normalized = card.trim().toLowerCase();
                if (normalized === baseToken) {
                    if (tokens[i] === "evo") evoCards.add(card);
                    else heroCards.add(card);
                    break;
                }
            }
        }
    }
    return { evoCards, heroCards };
}
type RarityFilter = "all" | "common" | "rare" | "epic" | "legendary" | "champion";
type TierFilter = "all" | "top" | "middle";

// アリーナIDをDBカテゴリIDへ変換（matchup_stats の arena_id と対応）
function arenaIdToDbCategory(arenaId: string): string {
    if (arenaId === "arena_22" || arenaId === "arena_23") return "ultimate";
    if (arenaId === "arena_19" || arenaId === "arena_20" || arenaId === "arena_21") return "top-ladder";
    if (arenaId === "arena_17" || arenaId === "arena_18") return "grandmaster";
    if (arenaId === "arena_15" || arenaId === "arena_16") return "champion";
    if (arenaId === "arena_12" || arenaId === "arena_13" || arenaId === "arena_14") return "master";
    if (arenaId === "arena_9"  || arenaId === "arena_10" || arenaId === "arena_11") return "challenger";
    return "beginner";
}

// アリーナIDをTierに分類
const ARENA_TIER_MAP: Record<string, TierFilter> = {
    "arena_22": "top", "arena_23": "top",
    "arena_19": "top", "arena_20": "top", "arena_21": "top",
    "arena_17": "top", "arena_18": "top",
    "arena_15": "middle", "arena_16": "middle",
    "arena_12": "middle", "arena_13": "middle", "arena_14": "middle",
    "arena_9":  "middle", "arena_10": "middle", "arena_11": "middle",
};

function ArenaPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTrophies = searchParams.get("trophies");
    const initialArenaId = searchParams.get("id");
    const initialView = (searchParams.get("view") as ViewMode) || "decks";

    const [data, setData] = useState<ApiResponse | null>(null);
    const [selectedArenaId, setSelectedArenaId] = useState<string>(initialArenaId ?? "");
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>(initialView);
    const [cardTypeFilter, setCardTypeFilter] = useState<CardTypeFilter>("all");
    const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");
    const [expandedDeckId, setExpandedDeckId] = useState<string | null>(null);
    const [tierFilter, setTierFilter] = useState<TierFilter>("all");
    const [matchupData, setMatchupData] = useState<Record<string, MatchupData>>({});
    const [matchupLoading, setMatchupLoading] = useState<string | null>(null);

    useEffect(() => {
        const params = initialTrophies
            ? `trophies=${initialTrophies}`
            : initialArenaId
                ? `id=${initialArenaId}`
                : `id=champion`;
        fetchArenaData(params);
    }, [initialTrophies, initialArenaId]);

    async function fetchArenaData(params: string) {
        setLoading(true);
        try {
            const res = await fetch(`/api/arena?${params}`);
            const d = await res.json();
            setData(d);
            setSelectedArenaId(d.arena.id);
        } catch {
            // fallback
        } finally {
            setLoading(false);
        }
    }

    function handleArenaChange(arenaId: string) {
        setSelectedArenaId(arenaId);
        fetchArenaData(`id=${arenaId}`);
        setMatchupData({});
        setExpandedDeckId(null);
    }

    async function handleDeckExpand(deckId: string, arenaId: string) {
        const next = expandedDeckId === deckId ? null : deckId;
        setExpandedDeckId(next);
        if (next && !matchupData[next]) {
            setMatchupLoading(next);
            try {
                const dbCategory = arenaIdToDbCategory(arenaId);
                const res = await fetch(`/api/matchup?arena=${dbCategory}&deck=${encodeURIComponent(next)}`);
                const d: MatchupData = await res.json();
                setMatchupData(prev => ({ ...prev, [next]: d }));
            } catch { /* fallback: empty */ }
            finally { setMatchupLoading(null); }
        }
    }

    const trendIcon = (trend: "up" | "down" | "stable") => {
        switch (trend) {
            case "up": return <TrendingUp className="w-3.5 h-3.5 text-green-400" />;
            case "down": return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
            default: return <Minus className="w-3.5 h-3.5 text-gray-500" />;
        }
    };

    const filteredCards = data?.cardStats?.filter(c => {
        if (cardTypeFilter !== "all" && c.type !== cardTypeFilter) return false;
        if (rarityFilter !== "all" && c.rarity !== rarityFilter) return false;
        return true;
    }) ?? [];

    const rarityColor = (r: string) => {
        switch (r) {
            case "champion": return "#ff6b6b";
            case "legendary": return "#fbbf24";
            case "epic": return "#c084fc";
            case "rare": return "#60a5fa";
            default: return "#94a3b8";
        }
    };

    if (loading && !data) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                    <p className="text-gray-400 text-sm">アリーナデータを読み込み中...</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <main className="min-h-screen pb-16 px-4 relative overflow-hidden">


            {/* ヘッダー */}
            <div className="flex items-center justify-between py-5 max-w-2xl mx-auto relative z-10">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    戻る
                </button>
                <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    <span className="font-semibold text-white text-sm">アリーナ メタトレンド</span>
                </div>
                <div className="w-12" />
            </div>

            <div className="max-w-2xl mx-auto flex flex-col gap-5 relative z-10">
                {/* Tier タブ */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex gap-2"
                >
                    {(["all", "top", "middle"] as TierFilter[]).map((tier) => {
                        const label = tier === "all" ? "🌐 全帯" : tier === "top" ? "👑 Top帯 (6000+)" : "⚔️ Middle帯 (4000〜6000)";
                        const isActive = tierFilter === tier;
                        return (
                            <button
                                key={tier}
                                onClick={() => setTierFilter(tier)}
                                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                style={isActive
                                    ? { background: "linear-gradient(135deg,#7c3aed88,#0dccf288)", border: "1px solid rgba(13,204,242,0.5)", color: "#fff" }
                                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af" }
                                }
                            >
                                {label}
                            </button>
                        );
                    })}
                </motion.div>

                {/* アリーナセレクター */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {data.allArenas.filter(arena => {
                            if (tierFilter === "all") return true;
                            return ARENA_TIER_MAP[arena.id] === tierFilter;
                        }).map((arena) => (
                            <button
                                key={arena.id}
                                onClick={() => handleArenaChange(arena.id)}
                                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                                style={
                                    selectedArenaId === arena.id
                                        ? {
                                            background: "linear-gradient(135deg, #7c3aed55, #0dccf255)",
                                            border: "1px solid rgba(13,204,242,0.5)",
                                            color: "#fff",
                                        }
                                        : {
                                            background: "rgba(255,255,255,0.04)",
                                            border: "1px solid rgba(255,255,255,0.08)",
                                            color: "#9ca3af",
                                        }
                                }
                            >
                                <span>{arena.icon}</span>
                                {arena.name}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* アリーナ情報ヘッダー */}
                <motion.div
                    className="glass-card p-4"
                    style={{ borderColor: "rgba(13,204,242,0.2)" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{data.arena.icon}</span>
                        <div>
                            <h2 className="text-[var(--text-main)] font-bold text-lg">{data.arena.name}</h2>
                            <p className="text-[var(--text-muted)] text-xs">
                                {data.arena.trophyMin.toLocaleString()} 〜 {data.arena.trophyMax < 99999 ? data.arena.trophyMax.toLocaleString() : "∞"} トロフィー
                            </p>
                        </div>
                    </div>

                    {/* 流行カードTOP5 */}
                    <div className="flex items-center gap-2">
                        <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                        <span className="text-xs text-[var(--text-muted)] flex-shrink-0">流行カード:</span>
                        <div className="flex gap-1.5 flex-wrap">
                            {data.hotCards.map((card) => (
                                <span
                                    key={card}
                                    className="px-2 py-0.5 rounded-full text-xs"
                                    style={{
                                        background: "rgba(251,146,60,0.1)",
                                        border: "1px solid rgba(251,146,60,0.2)",
                                        color: "#fb923c",
                                    }}
                                >
                                    {ja(card)}
                                </span>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* ビューモード切り替え: デッキ / カード使用率 */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode("decks")}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={viewMode === "decks"
                            ? { background: "linear-gradient(135deg, #7c3aed55, #0dccf255)", border: "1px solid rgba(13,204,242,0.5)", color: "#fff" }
                            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)" }
                        }
                    >
                        <Crown className="w-3 h-3" />
                        トレンドデッキ
                    </button>
                    <button
                        onClick={() => setViewMode("cards")}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={viewMode === "cards"
                            ? { background: "linear-gradient(135deg, #f9731655, #fbbf2455)", border: "1px solid rgba(249,115,22,0.5)", color: "#fff" }
                            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)" }
                        }
                    >
                        <BarChart3 className="w-3 h-3" />
                        カード使用率
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {viewMode === "decks" ? (
                        /* ===== TOP8 デッキリスト ===== */
                        <motion.div key="decks-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">
                                TOP {data.topDecks.length} デッキ
                            </p>
                            <div className="flex flex-col gap-3">
                                {data.topDecks.map((deck, idx) => (
                                    <motion.div
                                        key={deck.deckId}
                                        className="glass-card overflow-hidden"
                                        style={{ borderColor: idx === 0 ? "rgba(250,204,21,0.2)" : "rgba(255,255,255,0.06)" }}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <div
                                            className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                            onClick={() => handleDeckExpand(deck.deckId, data.arena.id)}
                                        >
                                            <div className="flex items-center justify-between mb-2 sm:mb-0">
                                                <div className="flex items-center gap-2.5">
                                                    <span
                                                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                                        style={{
                                                            background: idx === 0 ? "rgba(250,204,21,0.2)" : "rgba(255,255,255,0.06)",
                                                            color: idx === 0 ? "#fbbf24" : "#9ca3af",
                                                        }}
                                                    >
                                                        {idx + 1}
                                                    </span>
                                                    <div>
                                                        <p className="text-sm font-bold text-[var(--text-main)]">{deck.deckName}</p>
                                                        <p className="text-[10px] sm:text-xs text-[var(--text-muted)]">
                                                            {deck.archetype} • 平均{deck.avgElixir}エリクサー
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <div className="text-right">
                                                        <p className="font-bold" style={{ color: deck.winRate >= 55 ? "#4ade80" : deck.winRate >= 52 ? "#fbbf24" : "var(--text-muted)" }}>
                                                            {deck.winRate}%
                                                        </p>
                                                        <p className="text-[10px] text-[var(--text-muted)]">勝率</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-cyan-400">{deck.useRate}%</p>
                                                        <p className="text-[10px] text-[var(--text-muted)]">使用率</p>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {trendIcon(deck.trend)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Condensed cards view for mobile or when collapsed */}
                                            <AnimatePresence>
                                                {expandedDeckId !== deck.deckId && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="flex gap-1 flex-wrap mt-2 sm:ml-11"
                                                    >
                                                        {deck.cards.map((card) => (
                                                            <span
                                                                key={card}
                                                                className="px-1.5 py-0.5 rounded text-[10px]"
                                                                style={{
                                                                    background: "rgba(255,255,255,0.04)",
                                                                    border: "1px solid rgba(255,255,255,0.06)",
                                                                    color: "var(--text-muted)",
                                                                }}
                                                            >
                                                                {ja(card)}
                                                            </span>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <AnimatePresence>
                                            {expandedDeckId === deck.deckId && (() => {
                                                const { evoCards, heroCards } = parseEvoInfoFromDeckId(deck.deckId, deck.cards);
                                                return (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                                        className="border-t border-white/5 bg-[var(--glass-bg)]"
                                                    >
                                                        <div className="p-4 grid grid-cols-4 sm:grid-cols-8 gap-2">
                                                            {deck.cards.map((cardName, _i) => {
                                                                const isEvo      = evoCards.has(cardName);
                                                                const isHero     = heroCards.has(cardName);
                                                                const rarity     = getCardDef(cardName)?.rarity ?? "common";
                                                                const isChampion = rarity === "champion";
                                                                const isLegendary = rarity === "legendary";
                                                                const isEpic     = rarity === "epic";

                                                                // アイコンURL: evo はroyaleapi CDNにevo画像がないため通常アイコン使用
                                                                const slug = cardName.toLowerCase().replace(/['.]/g, "").replace(/\s+/g, "-");
                                                                const iconUrl = `https://royaleapi.github.io/cr-api-assets/cards/${slug}.png`;

                                                                // ボーダー・グロー設定
                                                                let borderColor = "rgba(255,255,255,0.06)";
                                                                let boxShadow = "none";
                                                                let bgGlow: string | null = null;

                                                                if (isEvo || isHero) {
                                                                    borderColor = "rgba(168,85,247,0.55)";
                                                                    boxShadow   = "0 0 10px rgba(168,85,247,0.25)";
                                                                    bgGlow = "radial-gradient(circle at center, rgba(168,85,247,0.12) 0%, transparent 70%)";
                                                                } else if (isChampion) {
                                                                    borderColor = "rgba(250,204,21,0.55)";
                                                                    boxShadow   = "0 0 10px rgba(250,204,21,0.18)";
                                                                    bgGlow = "radial-gradient(circle at center, rgba(250,204,21,0.08) 0%, transparent 70%)";
                                                                } else if (isLegendary) {
                                                                    borderColor = "rgba(14,165,233,0.4)";
                                                                } else if (isEpic) {
                                                                    borderColor = "rgba(192,132,252,0.35)";
                                                                }

                                                                return (
                                                                    <motion.div
                                                                        key={cardName}
                                                                        className="glass-card flex flex-col items-center gap-1 p-1 sm:p-2 relative overflow-hidden"
                                                                        style={{ borderColor, boxShadow }}
                                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                                        animate={{ opacity: 1, scale: 1 }}
                                                                        transition={{ delay: _i * 0.03 }}
                                                                    >
                                                                        {/* 背景グロー */}
                                                                        {bgGlow && (
                                                                            <div className="absolute inset-0 pointer-events-none" style={{ background: bgGlow }} />
                                                                        )}

                                                                        {/* 左上: Evoバッジ */}
                                                                        {(isEvo || isHero) && (
                                                                            <div
                                                                                className="absolute top-0.5 left-0.5 z-20 flex items-center justify-center w-3.5 h-3.5 rounded-full"
                                                                                style={{ background: "rgba(168,85,247,0.4)" }}
                                                                                title={isHero ? "ヒーロー（Hero）" : "限界突破（Evolution）"}
                                                                            >
                                                                                <Sparkles className="w-2 h-2 text-purple-300" />
                                                                            </div>
                                                                        )}

                                                                        {/* 右上: Championバッジ */}
                                                                        {isChampion && (
                                                                            <div
                                                                                className="absolute top-0.5 right-0.5 z-20 flex items-center justify-center w-3.5 h-3.5 rounded-full"
                                                                                style={{ background: "rgba(250,204,21,0.3)" }}
                                                                                title="チャンピオン"
                                                                            >
                                                                                <Crown className="w-2 h-2 text-yellow-400" />
                                                                            </div>
                                                                        )}

                                                                        <img
                                                                            src={iconUrl}
                                                                            alt={cardName}
                                                                            className="w-full aspect-square object-contain rounded-lg relative z-10"
                                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                                        />
                                                                        <p className="text-[var(--text-muted)] text-center leading-none mt-1 relative z-10" style={{ fontSize: "0.55rem" }}>
                                                                            {ja(cardName)}
                                                                        </p>
                                                                    </motion.div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* ===== マッチアップ（カウンター）セクション ===== */}
                                                        {(() => {
                                                            const mu = matchupData[deck.deckId];
                                                            const isLoading = matchupLoading === deck.deckId;
                                                            const hasData = mu && (mu.counters.length > 0 || mu.victims.length > 0);

                                                            if (isLoading) {
                                                                return (
                                                                    <div className="px-4 pb-4 flex items-center gap-2 text-xs text-gray-500">
                                                                        <div className="w-3 h-3 rounded-full border border-cyan-400 border-t-transparent animate-spin" />
                                                                        マッチアップデータを取得中...
                                                                    </div>
                                                                );
                                                            }
                                                            if (!hasData) {
                                                                return (
                                                                    <div className="px-4 pb-3 text-xs text-gray-600 italic">
                                                                        マッチアップデータなし（収集中）
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
                                                                    {/* 苦手なデッキ */}
                                                                    <div>
                                                                        <div className="flex items-center gap-1 mb-2">
                                                                            <Swords className="w-3 h-3 text-red-400" />
                                                                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">苦手な相手</span>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1">
                                                                            {mu.counters.map(r => (
                                                                                <div key={r.deckKey} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg" style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.12)" }}>
                                                                                    <span className="text-[10px] text-gray-300 truncate">{r.label}</span>
                                                                                    <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "#f87171" }}>{r.winRate}%</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    {/* 得意なデッキ */}
                                                                    <div>
                                                                        <div className="flex items-center gap-1 mb-2">
                                                                            <TrendingUp className="w-3 h-3 text-green-400" />
                                                                            <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">得意な相手</span>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1">
                                                                            {mu.victims.map(r => (
                                                                                <div key={r.deckKey} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg" style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.12)" }}>
                                                                                    <span className="text-[10px] text-gray-300 truncate">{r.label}</span>
                                                                                    <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "#4ade80" }}>{r.winRate}%</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </motion.div>
                                                );
                                            })()}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        /* ===== カード使用率ランキング ===== */
                        <motion.div key="cards-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                            {/* フィルター */}
                            <div className="flex flex-col gap-3 mb-4">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                    <span className="text-xs text-[var(--text-muted)]">タイプ:</span>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {([
                                            ["all", "すべて"],
                                            ["troop", "ユニット"],
                                            ["spell", "呪文"],
                                            ["building", "建物"],
                                        ] as [CardTypeFilter, string][]).map(([val, label]) => (
                                            <button
                                                key={val}
                                                onClick={() => setCardTypeFilter(val)}
                                                className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                                style={cardTypeFilter === val
                                                    ? { background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.4)", color: "#fb923c" }
                                                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)" }
                                                }
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                    <span className="text-xs text-[var(--text-muted)]">レア度:</span>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {([
                                            ["all", "すべて"],
                                            ["champion", "チャンピオン"],
                                            ["legendary", "UR"],
                                            ["epic", "SR"],
                                            ["rare", "レア"],
                                            ["common", "ノーマル"],
                                        ] as [RarityFilter, string][]).map(([val, label]) => (
                                            <button
                                                key={val}
                                                onClick={() => setRarityFilter(val)}
                                                className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                                style={rarityFilter === val
                                                    ? { background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa" }
                                                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)" }
                                                }
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">
                                カード使用率ランキング（{filteredCards.length}件）
                            </p>

                            <div className="flex flex-col gap-2">
                                {filteredCards.map((card, idx) => (
                                    <motion.div
                                        key={card.name}
                                        className="glass-card flex items-center gap-3 px-4 py-3"
                                        style={{ borderColor: "rgba(255,255,255,0.06)" }}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                    >
                                        {/* ランク */}
                                        <span
                                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                            style={{ background: "rgba(255,255,255,0.06)", color: idx < 3 ? "#fbbf24" : "#6b7280" }}
                                        >
                                            {idx + 1}
                                        </span>

                                        {/* カード名 + レア度バッジ */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-[var(--text-main)] truncate">{ja(card.name)}</p>
                                                <span
                                                    className="px-1.5 py-0.5 rounded text-xs flex-shrink-0"
                                                    style={{ fontSize: "0.6rem", background: `${rarityColor(card.rarity)}15`, color: rarityColor(card.rarity), border: `1px solid ${rarityColor(card.rarity)}30` }}
                                                >
                                                    {card.rarity === "champion" ? "C" : card.rarity === "legendary" ? "UR" : card.rarity === "epic" ? "SR" : card.rarity === "rare" ? "R" : "N"}
                                                </span>
                                                <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                                                    {card.type === "spell" ? "呪文" : card.type === "building" ? "建物" : "ユニット"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* 使用率バー */}
                                        <div className="w-28 flex-shrink-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-[var(--text-muted)]">使用率</span>
                                                <span className="text-xs font-bold text-cyan-400">{card.usageRate}%</span>
                                            </div>
                                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{ width: `${Math.min(100, card.usageRate)}%`, background: "#0dccf2" }}
                                                />
                                            </div>
                                        </div>

                                        {/* 勝率 */}
                                        <div className="w-14 text-right flex-shrink-0">
                                            <p className="text-xs font-bold" style={{ color: card.winRate >= 55 ? "#4ade80" : card.winRate >= 52 ? "#fbbf24" : "var(--text-muted)" }}>
                                                {card.winRate}%
                                            </p>
                                            <p className="text-[var(--text-muted)]" style={{ fontSize: "0.6rem" }}>勝率</p>
                                        </div>

                                        {/* トレンド */}
                                        {trendIcon(card.trend)}
                                    </motion.div>
                                ))}
                                {filteredCards.length === 0 && (
                                    <p className="text-[var(--text-muted)] text-sm text-center py-8">該当するカードが見つかりません</p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}

export default function ArenaPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            </div>
        }>
            <ArenaPageInner />
        </Suspense>
    );
}
