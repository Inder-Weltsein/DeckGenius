/**
 * /api/stats — DeckGenius 利用統計
 *
 * Sprint 3: recommend_logs の集計データを返す
 * ホームページの「X回推薦済」表示に使用
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ totalRequests: 0 });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // recommend_logs の総件数（リアルのみ）
        const { count: totalRequests } = await supabase
            .from("recommend_logs")
            .select("*", { count: "exact", head: true })
            .eq("is_demo", false);

        // raw_battles の総件数（データ量の指標）
        const { count: totalBattles } = await supabase
            .from("raw_battles")
            .select("*", { count: "exact", head: true });

        // trend_scores のデッキ数
        const { count: totalDecks } = await supabase
            .from("trend_scores")
            .select("*", { count: "exact", head: true });

        return NextResponse.json({
            totalRequests: totalRequests ?? 0,
            totalBattles:  totalBattles  ?? 0,
            totalDecks:    totalDecks    ?? 0,
        }, {
            headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate" },
        });
    } catch {
        return NextResponse.json({ totalRequests: 0 });
    }
}
