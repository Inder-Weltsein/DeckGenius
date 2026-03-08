"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Zap, Shield, TrendingUp } from "lucide-react";

export default function HomePage() {
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
    <main className="relative flex flex-col items-center justify-center min-h-screen px-4 overflow-hidden">
      {/* 背景グロウ */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #0dccf2 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #a60df2 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center gap-8">
        {/* ロゴ */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <Zap className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl font-bold neon-text-cyan tracking-tight">
              DeckGenius
            </h1>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
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
                background: "rgba(13, 204, 242, 0.08)",
                border: "1px solid rgba(13, 204, 242, 0.2)",
                color: "#7dd3fc",
              }}
            >
              <Icon className="w-3 h-3" />
              {label}
            </span>
          ))}
        </motion.div>

        {/* 入力フォーム */}
        <motion.div
          className="w-full glass-card p-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 tracking-wide uppercase">
                プレイヤータグ
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 font-bold select-none"
                  style={{ color: "#0dccf2" }}
                >
                  #
                </span>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="YQ08892"
                  className="pulsing-border w-full bg-transparent rounded-xl pl-8 pr-4 py-3 text-white placeholder-gray-600 outline-none transition-all text-sm font-mono tracking-widest"
                  style={{
                    border: "1px solid rgba(13, 204, 242, 0.4)",
                  }}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <motion.p
                className="text-red-400 text-xs text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                ⚠️ {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading || !tag.trim()}
              className="btn-glow w-full py-3.5 rounded-xl font-bold text-white text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
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

        {/* フッター */}
        <motion.p
          className="text-gray-600 text-xs text-center"
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
