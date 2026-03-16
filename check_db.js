const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDB() {
  const tables = [
    'raw_battles',
    'player_pool',
    'trend_scores',
    'arena_meta_aggregated',
    'deck_vectors'
  ];

  console.log("=== DB Record Counts ===");
  for (const t of tables) {
    const { count, error } = await supabase
      .from(t)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`[${t}] ERROR: ${error.message}`);
    } else {
      console.log(`[${t}] ${count} rows`);
    }
  }
}

checkDB();
