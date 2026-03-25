/**
 * GET /api/matchup?arena=champion&deck=hog-rider_knight_...
 *
 * matchup_stats テーブルから指定デッキの
 * ・上位カウンターデッキ（このデッキが負けやすい相手）
 * ・上位被カウンターデッキ（このデッキが勝ちやすい相手）
 * を返す。サンプル数 MIN_SAMPLE=5 以上のみ採用。
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ja } from "@/lib/cards";

const MIN_SAMPLE = 5;
const TOP_N     = 5;

function deckKeyToLabel(deckKey: string): string {
    // "hog-rider_evo_knight_..." → ["Hog Rider (Evo)", "Knight", ...]
    const tokens = deckKey.split("_");
    const parts: string[] = [];
    let i = 0;
    while (i < tokens.length) {
        if (tokens[i] === "evo" || tokens[i] === "hero") {
            // 直前カードのサフィックス
            if (parts.length > 0) {
                parts[parts.length - 1] += tokens[i] === "evo" ? " ✨" : " 👑";
            }
            i++;
        } else {
            // ハイフン区切りのカード名を復元
            const cardName = tokens[i]
                .split("-")
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ");
            parts.push(ja(cardName) || cardName);
            i++;
        }
    }
    // 先頭2カード名をラベルとして使用
    return parts.slice(0, 2).join(" + ");
}

export async function GET(req: NextRequest) {
    const arenaId = req.nextUrl.searchParams.get("arena");
    const deckKey = req.nextUrl.searchParams.get("deck");

    if (!arenaId || !deckKey) {
        return NextResponse.json({ error: "arena と deck パラメータが必要です" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ counters: [], victims: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // ① このデッキが "負けやすい" 相手 = opponent が deck_key で、こちら（player）の win_rate が低い行
        const { data: counterRows } = await supabase
            .from("matchup_stats")
            .select("opponent_deck_key, wins, total, win_rate")
            .eq("arena_id", arenaId)
            .eq("deck_key", deckKey)
            .gte("total", MIN_SAMPLE)
            .order("win_rate", { ascending: true })   // 勝率低い順 = カウンターされている
            .limit(TOP_N);

        // ② このデッキが "勝ちやすい" 相手 = opponent が deck_key で、こちらの win_rate が高い行
        const { data: victimRows } = await supabase
            .from("matchup_stats")
            .select("opponent_deck_key, wins, total, win_rate")
            .eq("arena_id", arenaId)
            .eq("deck_key", deckKey)
            .gte("total", MIN_SAMPLE)
            .order("win_rate", { ascending: false })  // 勝率高い順 = 得意な相手
            .limit(TOP_N);

        const formatRows = (rows: typeof counterRows) =>
            (rows ?? []).map(r => ({
                deckKey:  r.opponent_deck_key,
                label:    deckKeyToLabel(r.opponent_deck_key),
                winRate:  Math.round((r.win_rate ?? 0) * 1000) / 10,
                total:    r.total,
            }));

        return NextResponse.json({
            counters: formatRows(counterRows),  // 苦手なデッキ（このデッキの勝率が低い）
            victims:  formatRows(victimRows),   // 得意なデッキ（このデッキの勝率が高い）
        }, {
            headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate" },
        });

    } catch (err) {
        console.error("[/api/matchup] error:", err);
        return NextResponse.json({ counters: [], victims: [] });
    }
}
