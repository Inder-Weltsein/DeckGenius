import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    BEGINNER_DECKS, CHALLENGER_DECKS, MASTER_DECKS,
    CHAMPION_DECKS, GRANDMASTER_DECKS, TOP_LADDER_DECKS, ULTIMATE_DECKS
} from '@/lib/arenaMeta';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// 挿入には管理者権限（Service Role Key）が必要
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST() {
    if (!supabaseServiceKey) {
        console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
        return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set in environment variables." }, { status: 500 });
    }
    if (!supabaseUrl) {
        console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
        return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_URL is not set." }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const seedData = [
            { arena_id: "beginner", top_decks: BEGINNER_DECKS, total_analyzed_battles: 25000 },
            { arena_id: "challenger", top_decks: CHALLENGER_DECKS, total_analyzed_battles: 25000 },
            { arena_id: "master", top_decks: MASTER_DECKS, total_analyzed_battles: 25000 },
            { arena_id: "champion", top_decks: CHAMPION_DECKS, total_analyzed_battles: 25000 },
            { arena_id: "grandmaster", top_decks: GRANDMASTER_DECKS, total_analyzed_battles: 25000 },
            { arena_id: "top-ladder", top_decks: TOP_LADDER_DECKS, total_analyzed_battles: 25000 },
            { arena_id: "ultimate", top_decks: ULTIMATE_DECKS, total_analyzed_battles: 25000 },
        ];

        for (const data of seedData) {
            const { error } = await supabaseAdmin
                .from('arena_meta_stats')
                .upsert(data, { onConflict: 'arena_id' });

            if (error) {
                console.error("Error inserting data for", data.arena_id, error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, message: "Supabase database seeded successfully!" });
    } catch (e: any) {
        console.error("Caught error in seed API:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
