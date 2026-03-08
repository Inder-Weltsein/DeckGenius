"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, Bot, Sparkles, Copy, Check, BarChart3, ExternalLink, AlertTriangle } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyzer";
import type { CRCard } from "@/lib/clashApi";
import { ja, getCardDef } from "@/lib/cards";
type ApiResponse = AnalysisResult & { _demo?: boolean; error?: string };

export default function ResultPage() {
    const router = useRouter();
    const params = useParams<{ tag: string }>();
    const tag = params.tag;

    const [data, setData] = useState<ApiResponse | null>(null);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        if (!tag) return;
        fetch(`/api/analyze?tag=${tag}`)
            .then((r) => r.json())
            .then((d: ApiResponse) => {
                if (d.error) setError(d.error);
                else setData(d);
            })
            .catch(() => setError("データの取得に失敗しました。"));
    }, [tag]);

    const activeDeck = (() => {
        if (!data) return null;
        if (activeTab === 0) return data.recommendedDeck;
        return data.alternativeDecks?.[activeTab - 1] ?? data.recommendedDeck;
    })();

    const handleCopyDeck = () => {
        if (!activeDeck) return;
        const cardIds = activeDeck.cards.map((c) => c.id).join(",");
        window.location.href = `clashroyale://builddeck?deck=${cardIds}`;
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    // ローディング
    if (!data && !error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-6">
                <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-2 animate-spin" style={{ borderColor: "#0dccf2 transparent transparent transparent" }} />
                    <div className="absolute inset-3 rounded-full border-2 animate-spin" style={{ borderColor: "transparent #a60df2 transparent transparent", animationDirection: "reverse", animationDuration: "0.8s" }} />
                    <Bot className="absolute inset-0 m-auto w-7 h-7 text-cyan-400" />
                </div>
                <div className="text-center">
                    <p className="text-gray-300 font-medium">AIが分析中...</p>
                    <p className="text-gray-600 text-xs mt-1">対戦履歴・カードレベル・アリーナメタを解析しています</p>
                </div>
            </div>
        );
    }

    // エラー
    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
                <div className="glass-card p-8 max-w-sm w-full text-center">
                    <p className="text-red-400 text-lg mb-2">⚠️ エラー</p>
                    <p className="text-gray-400 text-sm">{error}</p>
                    <button onClick={() => router.push("/")} className="mt-6 btn-glow px-6 py-2 rounded-xl text-sm font-medium text-white">
                        トップに戻る
                    </button>
                </div>
            </div>
        );
    }

    const { playerName, trophies, arena, recommendedDeck, upgradePriority, alternativeDecks, _demo } = data!;
    const { meta: primaryMeta, compatibilityScore: primaryScore, coachMessage, scoreBreakdown } = recommendedDeck;

    const tabs = [
        { label: primaryMeta.name, score: primaryScore, tag: "Best" },
        ...(alternativeDecks ?? []).slice(0, 2).map((d, i) => ({
            label: d.meta.name,
            score: d.compatibilityScore,
            tag: `Alt${i + 1}`,
        })),
    ];

    const currentDeck = activeDeck!;

    // TOC ScoreBreakdown バー用
    const currentBreakdown = activeTab === 0 ? scoreBreakdown : (activeDeck as any)?.scoreBreakdown;
    const breakdownItems = currentBreakdown ? [
        { label: "育成", value: currentBreakdown.growthScore, color: "#0dccf2" },
        { label: "環境", value: currentBreakdown.metaScore, color: "#4ade80" },
        { label: "役割", value: currentBreakdown.roleScore, color: "#f97316" },
        { label: "シナジー", value: currentBreakdown.synergyScore, color: "#a78bfa" },
        { label: "コスト", value: currentBreakdown.costScore, color: "#fbbf24" },
    ] : [];

    return (
        <main className="min-h-screen pb-16 px-4">
            {/* ヘッダー */}
            <div className="flex items-center justify-between py-5 max-w-lg mx-auto">
                <button onClick={() => router.push("/")} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
                    <ArrowLeft className="w-4 h-4" />
                    戻る
                </button>
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{playerName}</span>
                    <span className="flex items-center gap-1 text-yellow-400 text-sm font-medium">
                        <Trophy className="w-3.5 h-3.5" />
                        {trophies.toLocaleString()}
                    </span>
                </div>
                {_demo && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(166,13,242,0.2)", color: "#d8b4fe" }}>DEMO</span>
                )}
            </div>

            <div className="max-w-lg mx-auto flex flex-col gap-5">
                {/* アリーナバッジ */}
                {arena && (
                    <motion.div
                        className="flex items-center justify-between"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4 }}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{arena.icon}</span>
                            <div>
                                <p className="text-white font-semibold text-sm">{arena.name}</p>
                                <p className="text-gray-600 text-xs">{arena.trophyMin.toLocaleString()}〜{arena.trophyMax < 99999 ? arena.trophyMax.toLocaleString() : "∞"} トロフィー</p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push(`/arena?trophies=${trophies}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            style={{ background: "rgba(13,204,242,0.08)", border: "1px solid rgba(13,204,242,0.2)", color: "#7dd3fc" }}
                        >
                            <BarChart3 className="w-3 h-3" />
                            メタトレンドを見る
                            <ExternalLink className="w-3 h-3" />
                        </button>
                    </motion.div>
                )}

                {/* AIコーチメッセージ */}
                <motion.div className="glass-card p-5" style={{ borderColor: "rgba(13,204,242,0.2)" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #0dccf2)" }}>
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">DeckGenius コーチ</span>
                                <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                    適合度 {primaryScore}%
                                </span>
                            </div>
                            <p className="text-gray-300 text-sm leading-relaxed">{coachMessage}</p>
                        </div>
                    </div>
                </motion.div>

                {/* ScoreBreakdown バー */}
                {breakdownItems.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                        <details className="glass-card p-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                            <summary className="text-xs font-semibold text-gray-500 uppercase tracking-widest cursor-pointer select-none flex items-center gap-2">
                                <BarChart3 className="w-3 h-3" />
                                TOC スコア内訳（TruthOfCrown）
                            </summary>
                            <div className="mt-3 flex flex-col gap-2">
                                {breakdownItems.map(({ label, value, color }) => (
                                    <div key={label} className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</span>
                                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                            <motion.div
                                                className="h-full rounded-full"
                                                style={{ background: color }}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${value}%` }}
                                                transition={{ delay: 0.3, duration: 0.6 }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold w-8 text-right" style={{ color }}>{Math.round(value)}</span>
                                    </div>
                                ))}
                            </div>
                        </details>
                    </motion.div>
                )}

                {/* デッキタブ */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">おすすめデッキ候補</p>
                    <div className="flex gap-2 flex-wrap">
                        {tabs.map((tab, i) => (
                            <button
                                key={tab.tag}
                                onClick={() => { setActiveTab(i); setCopied(false); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                                style={activeTab === i
                                    ? { background: "linear-gradient(135deg, #7c3aed55, #0dccf255)", border: "1px solid rgba(13,204,242,0.5)", color: "#fff" }
                                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af" }
                                }
                            >
                                {i === 0 && <Sparkles className="w-3 h-3 text-yellow-400" />}
                                {tab.label}
                                <span style={{ color: activeTab === i ? "#4ade80" : "#6b7280", fontSize: "0.65rem" }}>{tab.score}%</span>
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* カードグリッド (4×2) */}
                <AnimatePresence mode="wait">
                    <motion.div key={activeTab} className="grid grid-cols-4 gap-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                        {(currentDeck.cards.length > 0
                            ? currentDeck.cards
                            : currentDeck.meta.cards.map((name, idx) => ({ name, id: idx, level: 14, maxLevel: 14, iconUrls: { medium: "" } } as CRCard))
                        ).slice(0, 8)
                            .map((card, origIndex) => ({ card, origIndex }))
                            .sort((a, b) => {
                                const aEvo = a.card.evolutionLevel && a.card.evolutionLevel > 0 ? 1 : 0;
                                const bEvo = b.card.evolutionLevel && b.card.evolutionLevel > 0 ? 1 : 0;
                                if (aEvo !== bEvo) return bEvo - aEvo;

                                const aChamp = getCardDef(a.card.name)?.rarity === "champion" ? 1 : 0;
                                const bChamp = getCardDef(b.card.name)?.rarity === "champion" ? 1 : 0;
                                if (aChamp !== bChamp) return bChamp - aChamp;

                                return a.origIndex - b.origIndex;
                            })
                            .map(({ card }, _i) => {
                                const isChampion = getCardDef(card.name)?.rarity === "champion";
                                const isEvo = card.evolutionLevel && card.evolutionLevel > 0;
                                const iconUrl = isEvo && card.iconUrls?.evolutionMedium ? card.iconUrls.evolutionMedium : card.iconUrls?.medium;

                                return (
                                    <motion.div
                                        key={card.name}
                                        className="glass-card flex flex-col items-center gap-1 p-2 relative overflow-hidden"
                                        style={{
                                            borderColor: isEvo ? "rgba(168,85,247,0.5)" : (isChampion ? "rgba(250,204,21,0.5)" : "rgba(13,204,242,0.15)"),
                                            boxShadow: isEvo ? "0 0 10px rgba(168,85,247,0.2)" : (isChampion ? "0 0 10px rgba(250,204,21,0.15)" : "none"),
                                        }}
                                        initial={{ opacity: 0, scale: 0.85 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: _i * 0.04 }}
                                        whileHover={{ scale: 1.05 }}
                                    >
                                        {isEvo && (
                                            <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ background: "radial-gradient(circle at center, rgba(168,85,247,0.15) 0%, transparent 70%)" }} />
                                        )}
                                        {isChampion && (
                                            <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ background: "radial-gradient(circle at center, rgba(250,204,21,0.1) 0%, transparent 70%)" }} />
                                        )}

                                        {iconUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={iconUrl} alt={card.name} className="w-full aspect-square object-contain rounded-lg relative z-10"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                        ) : (
                                            <div className="w-full aspect-square rounded-lg flex items-center justify-center text-xl relative z-10" style={{ background: "rgba(255,255,255,0.05)" }}>🃏</div>
                                        )}

                                        {isEvo && (
                                            <div className="absolute top-1 left-1 z-20" title="限界突破（Evolution）">
                                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                            </div>
                                        )}

                                        {card.level > 0 && (
                                            <span className="absolute bottom-1.5 right-1.5 font-bold px-1 rounded z-20"
                                                style={{
                                                    background: isEvo ? "linear-gradient(135deg, #7e22ce, #a855f7)" : "#0b0f19",
                                                    color: isEvo ? "#fff" : (card.level >= 14 ? "#fbbf24" : "#94a3b8"),
                                                    fontSize: "0.6rem",
                                                    border: isEvo ? "none" : (card.level >= 14 ? "1px solid rgba(251,191,36,0.3)" : "none")
                                                }}>
                                                {card.level}
                                            </span>
                                        )}
                                        <p className="text-gray-400 text-center leading-tight relative z-20 mt-1" style={{ fontSize: "0.55rem" }}>
                                            {ja(card.name)}
                                        </p>
                                    </motion.div>
                                );
                            })}
                    </motion.div>
                </AnimatePresence>

                {/* エリクサーコスト表示 */}
                {currentDeck.meta?.avgElixir && (
                    <div className="flex items-center justify-center gap-4 -mt-2">
                        <span className="text-xs text-gray-600">平均エリクサー:</span>
                        <span className="text-xs font-bold text-purple-400">{currentDeck.meta.avgElixir}</span>
                        {currentDeck.meta.idealElixirRange && (
                            <span className="text-xs text-gray-600">
                                適正帯: {currentDeck.meta.idealElixirRange[0]}〜{currentDeck.meta.idealElixirRange[1]}
                            </span>
                        )}
                    </div>
                )}

                {/* デッキ修正提案 (TOC Deck Checker) */}
                {(currentDeck as any)?.deckSuggestions?.length > 0 && (
                    <motion.div
                        className="glass-card p-4"
                        style={{ borderColor: "rgba(249,115,22,0.25)" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.35 }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4 text-orange-400" />
                            <span className="text-xs font-semibold text-orange-400 uppercase tracking-widest">TOC デッキチェッカー</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            {((currentDeck as any).deckSuggestions as string[]).map((suggestion, i) => (
                                <p key={i} className="text-sm text-gray-300 leading-relaxed">{suggestion}</p>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* コピーボタン */}
                <motion.button
                    className="btn-glow w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
                    onClick={handleCopyDeck}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {copied ? (<><Check className="w-5 h-5" />ゲームアプリを起動中...</>) : (<><Copy className="w-5 h-5" />クラロワでデッキをコピー</>)}
                </motion.button>

                {/* 育成優先カード TOP3 */}
                {activeTab === 0 && upgradePriority.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">育成優先カード TOP3</p>
                        <div className="flex flex-col gap-2">
                            {upgradePriority.map((u, i) => (
                                <div key={u.name} className="glass-card flex items-center gap-3 px-4 py-3" style={{ borderColor: "rgba(166,13,242,0.15)" }}>
                                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "rgba(166,13,242,0.2)", color: "#c084fc" }}>{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{ja(u.name)}</p>
                                        <p className="text-xs text-gray-500">Lv.{u.currentLevel} → Lv.{u.targetLevel}</p>
                                    </div>
                                    <span className="text-xs font-bold flex-shrink-0" style={{ color: "#4ade80" }}>+{u.winRateBoost}%</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ローカルメタ */}
                {data!.localMeta.length > 0 && (
                    <motion.details className="glass-card p-4" style={{ borderColor: "rgba(255,255,255,0.06)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
                        <summary className="text-xs font-semibold text-gray-500 uppercase tracking-widest cursor-pointer select-none">
                            直近の対戦で多かった相手カード
                        </summary>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {data!.localMeta.map(({ cardName, count }) => (
                                <span key={cardName} className="px-2.5 py-1 rounded-full text-xs"
                                    style={{ background: "rgba(13,204,242,0.08)", border: "1px solid rgba(13,204,242,0.15)", color: "#7dd3fc" }}>
                                    {ja(cardName)} ×{count}
                                </span>
                            ))}
                        </div>
                    </motion.details>
                )}
            </div>
        </main>
    );
}
