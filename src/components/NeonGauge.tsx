"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface NeonGaugeProps {
  score: number;        // 0〜100
  size?: number;        // px（デフォルト 160）
  label?: string;       // ゲージ下のラベル
  sublabel?: string;    // ゲージ内の小さいラベル
}

export function NeonGauge({ score, size = 160, label, sublabel }: NeonGaugeProps) {
  const clamped = Math.min(100, Math.max(0, score));

  // SVGパラメータ
  const radius = 54;
  const center = size / 2;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius; // ≈ 339.3

  // 上部30°を空けて270°分を使う（時計12時 → 時計3時 → 時計6時 → 時計9時 → 時計12時手前）
  const totalArc = 270; // 度数
  const arcRatio = (clamped / 100) * totalArc;
  const arcLength = (arcRatio / 360) * circumference;
  const dashOffset = circumference - arcLength;

  // スコアに応じた色
  const getColor = (s: number) => {
    if (s >= 80) return { stroke: "#0dccf2", glow: "rgba(13,204,242,0.6)" };
    if (s >= 60) return { stroke: "#4ade80", glow: "rgba(74,222,128,0.5)" };
    if (s >= 40) return { stroke: "#f5b942", glow: "rgba(245,185,66,0.5)" };
    return { stroke: "#f87171", glow: "rgba(248,113,113,0.5)" };
  };

  const { stroke, glow } = getColor(clamped);

  // 回転: -135度から始まる（270度分）
  const rotation = -135;

  const scaledRadius = (radius / 90) * (size / 2 - strokeWidth);
  const scaledCircumference = 2 * Math.PI * scaledRadius;
  const scaledDashArc = (arcRatio / 360) * scaledCircumference;
  const scaledDashOffset = scaledCircumference - scaledDashArc;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* トラック（背景リング） */}
          <circle
            cx={center}
            cy={center}
            r={scaledRadius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${(270 / 360) * scaledCircumference} ${scaledCircumference}`}
            strokeDashoffset="0"
            strokeLinecap="round"
            transform={`rotate(${rotation} ${center} ${center})`}
          />
          {/* フィルリング（ネオン） */}
          <motion.circle
            cx={center}
            cy={center}
            r={scaledRadius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${scaledCircumference}`}
            transform={`rotate(${rotation} ${center} ${center})`}
            style={{
              filter: `drop-shadow(0 0 8px ${glow})`,
            }}
            initial={{ strokeDashoffset: scaledCircumference }}
            animate={{ strokeDashoffset: scaledDashOffset }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>

        {/* 中央テキスト */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ pointerEvents: "none" }}
        >
          {sublabel && (
            <span className="text-gray-500 font-semibold uppercase tracking-widest" style={{ fontSize: "0.55rem" }}>
              {sublabel}
            </span>
          )}
          <motion.span
            className="font-black tabular-nums"
            style={{
              fontSize: size * 0.26,
              color: stroke,
              textShadow: `0 0 20px ${glow}`,
              lineHeight: 1,
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5, ease: "backOut" }}
          >
            {clamped}
          </motion.span>
          <span className="text-gray-500 font-medium" style={{ fontSize: size * 0.065 }}>
            点
          </span>
        </div>
      </div>

      {label && (
        <motion.p
          className="text-white font-bold text-center"
          style={{ fontSize: size * 0.1 }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}
