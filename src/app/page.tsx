"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Zap, Shield, TrendingUp } from "lucide-react";

export default function HomePage() {
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [animStyle, setAnimStyle] = useState<"cyber" | "pop">("pop");
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("deckgenius_theme") as "cyber" | "pop" | null;
    if (saved) {
      setAnimStyle(saved);
    }
  }, []);

  const changeTheme = (theme: "cyber" | "pop") => {
    setAnimStyle(theme);
    localStorage.setItem("deckgenius_theme", theme);
    if (theme === "pop") {
      document.body.classList.add("theme-pop");
    } else {
      document.body.classList.remove("theme-pop");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = tag.trim().replace(/^#/, "").toUpperCase();
    if (!cleanTag) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/analyze?tag=${encodeURIComponent(cleanTag)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "分析に失敗しました");
      }
      router.push(`/result/${cleanTag}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "不明なエラーが発生しました");
      setLoading(false);
    }
  };

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen px-4 md:px-8 overflow-hidden">
      {/* UI Mode Toggle */}
      <div
        className="absolute top-4 right-4 z-50 flex items-center gap-1 backdrop-blur-md px-2 py-1.5 rounded-full border"
        style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }}
      >
        <button
          onClick={() => changeTheme("cyber")}
          className={`text-xs px-3 py-1 rounded-full transition-colors ${animStyle === "cyber" ? "bg-cyan-500/20 text-cyan-500 border border-cyan-500/50" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}
        >
          Cyber
        </button>
        <button
          onClick={() => changeTheme("pop")}
          className={`text-xs px-3 py-1 rounded-full transition-colors ${animStyle === "pop" ? "bg-yellow-500/20 text-yellow-600 border border-yellow-500/50 dark:text-yellow-400" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}
        >
          Pop
        </button>
      </div>

      {/* 背景グロウ */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-10 transition-colors duration-500"
          style={{ background: "radial-gradient(circle, var(--accent-cyan) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full opacity-10 transition-colors duration-500"
          style={{ background: "radial-gradient(circle, var(--accent-purple) 0%, transparent 70%)" }}
        />

      </div>


      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center gap-8 py-10 md:py-16">
        {/* ロゴ */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <h1 className="text-4xl font-extrabold tracking-tight flex items-center">
              <span className="text-[var(--text-main)]">Deck</span>
              <span className="bg-yellow-400 text-slate-900 px-3 py-0.5 rounded-full ml-1">Genius</span>
            </h1>
          </div>
          <p className="text-[var(--text-muted)] text-sm leading-relaxed font-medium">
            AIが、あなただけの最強デッキを設計する
          </p>
        </motion.div>

        {/* 特徴バッジ */}
        <motion.div
          className="flex gap-3 flex-wrap justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          {[
            { icon: Shield, label: "レベル補正済み" },
            { icon: TrendingUp, label: "ローカルメタ分析" },
            { icon: Zap, label: "AI最適化" },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                color: "var(--accent-cyan)",
              }}
            >
              <Icon className="w-3 h-3" />
              {label}
            </span>
          ))}
        </motion.div>

        {/* キャラクター画像 */}
        <AnimatePresence mode="wait">
          {animStyle === "pop" && (
            <motion.div
              key={error ? "sad" : "happy"}
              className="w-64 h-64 mx-auto -mb-12 relative z-20 pointer-events-none"
              initial={{ scale: 0, y: 50, rotate: -10 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0, y: 50, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.6 }}
            >
              <img
                src={error ? "/king_sad.png" : "/king_happy.png"}
                alt="King Emotion"
                className="w-full h-full object-contain drop-shadow-2xl"
              />
            </motion.div>
          )}
          {animStyle === "cyber" && (
            <motion.div
              key={error ? "cyber-error" : "cyber-normal"}
              className="w-72 h-72 mx-auto -mb-14 relative z-20 pointer-events-none"
              initial={{ scale: 0, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0, y: 50, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
            >
              <img
                src={error ? "/Gemini_Generated_Image_uzb6j3uzb6j3uzb6.png" : "/Gemini_Generated_Image_z8ft2bz8ft2bz8ft.png"}
                alt="PEKKA Cyber"
                className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(13,204,242,0.4)]"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 入力フォーム */}
        <motion.div
          className={`w-full glass-card p-6 relative z-10 ${animStyle === "pop" ? "border-yellow-500/30" : ""}`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-2 tracking-wide uppercase">
                プレイヤータグ
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 font-bold select-none"
                  style={{ color: "var(--accent-cyan)" }}
                >
                  #
                </span>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="YQ08892"
                  className={`w-full bg-transparent rounded-xl pl-8 pr-4 py-3 text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none transition-all text-sm font-mono tracking-widest ${animStyle === "cyber"
                    ? "pulsing-border border border-[rgba(13,204,242,0.4)]"
                    : "border border-[var(--text-muted)] focus:border-yellow-500/50 focus:shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                    }`}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <motion.p
                className="text-red-500 font-bold text-xs text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                ⚠️ {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading || !tag.trim()}
              className={`w-full py-3.5 rounded-xl font-bold text-white text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all duration-300 ${animStyle === "pop"
                ? "bg-blue-500 hover:bg-blue-400 shadow-[0_4px_20px_rgba(59,130,246,0.6)] hover:shadow-[0_6px_25px_rgba(59,130,246,0.8)] hover:-translate-y-0.5"
                : "btn-glow"
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner />
                  AIが分析中...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Search className="w-4 h-4" />
                  デッキをスキャン
                </span>
              )}
            </button>
          </form>
        </motion.div>

        {/* トレンドデッキ (Trending Decks) - Stitch提案の要素 */}
        <motion.div
          className="w-full mt-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <div className="flex justify-between items-end mb-3 px-2">
            <h3 className="text-[var(--text-main)] font-extrabold text-lg tracking-wide">Trending Decks</h3>
            <button onClick={() => router.push('/arena')} className="text-blue-500 hover:text-blue-400 text-xs font-bold transition-colors">
              View All
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 pb-4">
            {/* Mock Trending Card 1 */}
            <div
              onClick={() => router.push('/arena?view=decks')}
              className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-3xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 relative overflow-hidden group"
              style={{ background: animStyle === "pop" ? "#ffffff" : "var(--glass-bg)" }}
            >
              <div className="bg-slate-800 w-full h-20 rounded-2xl flex items-center justify-center mb-3 overflow-hidden">
                <img src="/Gemini_Generated_Image_87eqmd87eqmd87eq.png" alt="Mighty Miner" className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-500" />
              </div>
              <h4 className="font-extrabold text-[var(--text-main)] text-sm mb-1">デッキトレンド</h4>
              <p className="text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider">Top Meta Decks</p>
              <div className="absolute bottom-0 left-0 h-1 bg-orange-500 w-full rounded-b-3xl"></div>
            </div>

            {/* Mock Trending Card 2 */}
            <div
              onClick={() => router.push('/arena?view=cards')}
              className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-3xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 relative overflow-hidden group"
              style={{ background: animStyle === "pop" ? "#ffffff" : "var(--glass-bg)" }}
            >
              <div className="bg-slate-800 w-full h-20 rounded-2xl flex items-center justify-center mb-3 overflow-hidden">
                <img src="/Gemini_Generated_Image_bqgr0rbqgr0rbqgr.png" alt="Three Musketeers" className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-500" />
              </div>
              <h4 className="font-extrabold text-[var(--text-main)] text-sm mb-1">カード使用率</h4>
              <p className="text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider">Card Ranking</p>
              <div className="absolute bottom-0 left-0 h-1 bg-blue-500 w-full rounded-b-3xl"></div>
            </div>
          </div>
        </motion.div>

        {/* フッター */}
        <motion.p
          className="text-[var(--text-muted)] text-xs text-center font-medium opacity-80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Clash Royale API で安全に取得 · RoyaleAPI とは一線を画す個人最適化
        </motion.p>
      </div>
    </main>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
