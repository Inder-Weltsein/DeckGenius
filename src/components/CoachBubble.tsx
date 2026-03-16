"use client";

import { Bot } from "lucide-react";
import { motion } from "framer-motion";

interface CoachBubbleProps {
  message: string;
  score: number;
  delay?: number;
}

export function CoachBubble({ message, score, delay = 0 }: CoachBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      {/* ラベル行 */}
      <div className="flex items-center gap-2 mb-2 ml-1">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #7c3aed, #0dccf2)" }}
        >
          <Bot className="w-4 h-4 text-white" />
        </div>
        <span className="text-xs font-bold text-cyan-400 tracking-wide">DeckGenius AI</span>
        <span
          className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          適合度 {score}点
        </span>
      </div>

      {/* バブル */}
      <div className="coach-bubble p-4 rounded-2xl">
        <p className="text-gray-200 text-sm leading-relaxed">{message}</p>
      </div>
    </motion.div>
  );
}
