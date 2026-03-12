"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Flame, Crown, BarChart3, Filter } from "lucide-react";
import type { Arena, ArenaDeckStats, ArenaCardStats } from "@/lib/arenaMeta";
import { ja } from "@/lib/cards";

type ApiResponse = {
    arena: Arena;
    topDecks: ArenaDeckStats[];
    hotCards: string[];
    cardStats: ArenaCardStats[];
    allArenas: Arena[];
};

type ViewMode = "decks" | "cards";
type CardTypeFilter = "all" | "troop" | "spell" | "building";
type RarityFilter = "all" | "common" | "rare" | "epic" | "legendary" | "champion";

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
                {/* アリーナセレクター */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {data.allArenas.map((arena) => (
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
                                            onClick={() => setExpandedDeckId(prev => prev === deck.deckId ? null : deck.deckId)}
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
                                            {expandedDeckId === deck.deckId && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                                    className="border-t border-white/5 bg-[var(--glass-bg)]"
                                                >
                                                    <div className="p-4 grid grid-cols-4 sm:grid-cols-8 gap-2">
                                                        {deck.cards.map((cardName, _i) => {
                                                            const slug = cardName.toLowerCase().replace(/['.]/g, '').replace(/\s+/g, '-');
                                                            const iconUrl = `https://royaleapi.github.io/cr-api-assets/cards/${slug}.png`;
                                                            return (
                                                                <motion.div
                                                                    key={cardName}
                                                                    className="glass-card flex flex-col items-center gap-1 p-1 sm:p-2 relative overflow-hidden"
                                                                    style={{ borderColor: "rgba(255,255,255,0.06)" }}
                                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                                    animate={{ opacity: 1, scale: 1 }}
                                                                    transition={{ delay: _i * 0.03 }}
                                                                >
                                                                    <img
                                                                        src={iconUrl}
                                                                        alt={cardName}
                                                                        className="w-full aspect-square object-contain rounded-lg relative z-10"
                                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                                    />
                                                                    <p className="text-[var(--text-muted)] text-center leading-none mt-1" style={{ fontSize: "0.55rem" }}>
                                                                        {ja(cardName)}
                                                                    </p>
                                                                </motion.div>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
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
