"use client";

import { motion } from "framer-motion";

interface NeonBarProps {
  label: string;
  value: number;  // 0〜100
  delay?: number;
  color?: "cyan-purple" | "green" | "gold" | "orange";
}

const gradients = {
  "cyan-purple": "linear-gradient(90deg, #0dccf2, #a60df2)",
  green:         "linear-gradient(90deg, #22c55e, #4ade80)",
  gold:          "linear-gradient(90deg, #d4930a, #f5b942)",
  orange:        "linear-gradient(90deg, #ea580c, #f97316)",
};

const shadows = {
  "cyan-purple": "0 0 8px rgba(13,204,242,0.5)",
  green:         "0 0 8px rgba(74,222,128,0.4)",
  gold:          "0 0 8px rgba(245,185,66,0.4)",
  orange:        "0 0 8px rgba(249,115,22,0.4)",
};

export function NeonBar({ label, value, delay = 0, color = "cyan-purple" }: NeonBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const grad = gradients[color];
  const shadow = shadows[color];

  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-500 flex-shrink-0" style={{ fontSize: "0.72rem", width: "7.5rem" }}>
        {label}
      </span>

      <div className="neon-bar-track flex-1">
        <motion.div
          className="neon-bar-fill"
          style={{ background: grad, boxShadow: shadow }}
          initial={{ width: "0%" }}
          animate={{ width: `${clamped}%` }}
          transition={{ delay: delay + 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <motion.span
        className="font-bold tabular-nums flex-shrink-0"
        style={{ fontSize: "0.75rem", width: "2rem", textAlign: "right", color: "#0dccf2" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.6 }}
      >
        {clamped}
      </motion.span>
    </div>
  );
}
