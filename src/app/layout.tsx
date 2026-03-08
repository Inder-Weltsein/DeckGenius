import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeckGenius — AIが、あなただけの最強デッキを設計する",
  description: "クラロワAPIとAI分析で、あなたのカードレベルと直近の対戦履歴から最適デッキを提案するパーソナルAIコーチ。",
  keywords: ["クラッシュロワイヤル", "クラロワ", "デッキ", "AI", "コーチ", "DeckGenius"],
  openGraph: {
    title: "DeckGenius — AIが、あなただけの最強デッキを設計する",
    description: "あなたのカードレベルと直近の対戦履歴から最適デッキを提案するパーソナルAIコーチ",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="relative min-h-screen overflow-x-hidden">
        <div className="relative z-10 min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
