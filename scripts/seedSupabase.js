const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const tsNode = require('ts-node');

// ts-node required to require typescript files
tsNode.register();

// Load environment variables directly from .env.local
const envConfig = require('dotenv').config({ path: '.env.local' }).parsed;

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing credentials in .env.local! Cannot seed DB.");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const path = require('path');
const {
    BEGINNER_DECKS, CHALLENGER_DECKS, MASTER_DECKS,
    CHAMPION_DECKS, GRANDMASTER_DECKS, TOP_LADDER_DECKS, ULTIMATE_DECKS
} = require(path.join(__dirname, '../src/lib/arenaMeta.ts'));

async function seed() {
    console.log("Starting DB Seed...");

    const seedData = [
        { arena_id: "beginner", top_decks: BEGINNER_DECKS, total_analyzed_battles: 25000 },
        { arena_id: "challenger", top_decks: CHALLENGER_DECKS, total_analyzed_battles: 25000 },
        { arena_id: "master", top_decks: MASTER_DECKS, total_analyzed_battles: 25000 },
        { arena_id: "champion", top_decks: CHAMPION_DECKS, total_analyzed_battles: 25000 },
        { arena_id: "grandmaster", top_decks: GRANDMASTER_DECKS, total_analyzed_battles: 25000 },
        { arena_id: "top-ladder", top_decks: TOP_LADDER_DECKS, total_analyzed_battles: 25000 },
        { arena_id: "ultimate", top_decks: ULTIMATE_DECKS, total_analyzed_battles: 25000 },
    ];

    let successCount = 0;
    for (const data of seedData) {
        const { error } = await supabaseAdmin
            .from('arena_meta_stats')
            .upsert(data, { onConflict: 'arena_id' });

        if (error) {
            console.error("❌ Error inserting data for", data.arena_id, error.message);
        } else {
            console.log(`✅ Successfully seeded arena ID: ${data.arena_id}`);
            successCount++;
        }
    }

    console.log(`\nSeed Complete. Successfully seeded ${successCount} entries.`);
}

seed().catch(console.error);
