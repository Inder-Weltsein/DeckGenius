// DeckGenius - アリーナ（トロフィー帯）別メタデッキデータ
// 各ティアに最大8種のトップメタデッキ＋勝率/使用率/トレンドを定義

// ===== 型定義 =====
import { supabase } from "./supabaseClient";

export interface Arena {
    id: string;
    name: string;
    nameEn: string;
    trophyMin: number;
    trophyMax: number;
    icon: string;
}

export interface ArenaDeckStats {
    deckId: string;
    deckName: string;
    archetype: string;
    cards: string[];
    winRate: number;       // このアリーナでの推定勝率(%)
    useRate: number;       // 使用率(%)
    avgElixir: number;     // 平均エリクサーコスト
    trend: "up" | "down" | "stable";
}

export interface ArenaCardStats {
    name: string;
    type: "troop" | "spell" | "building";
    rarity: "common" | "rare" | "epic" | "legendary" | "champion";
    usageRate: number;    // このアリーナでの使用率(%)
    winRate: number;      // このアリーナでの勝率(%)
    trend: "up" | "down" | "stable";
}

export interface ArenaMetaInfo {
    arena: Arena;
    topDecks: ArenaDeckStats[];
    hotCards: string[];          // 流行カードTOP5
    cardStats: ArenaCardStats[]; // 全カード使用率＋勝率
}

// ===== アリーナ定義 =====

export const ARENAS: Arena[] = [
    { id: "arena_1", name: "ゴブリンスタジアム", nameEn: "Goblin Stadium", trophyMin: 0, trophyMax: 299, icon: "🏟️" },
    { id: "arena_2", name: "ボーンピット", nameEn: "Bone Pit", trophyMin: 300, trophyMax: 599, icon: "💀" },
    { id: "arena_3", name: "バーバリアンボウル", nameEn: "Barbarian Bowl", trophyMin: 600, trophyMax: 999, icon: "⚔️" },
    { id: "arena_4", name: "P.E.K.K.Aシアター", nameEn: "P.E.K.K.A's Playhouse", trophyMin: 1000, trophyMax: 1299, icon: "🎭" },
    { id: "arena_5", name: "呪文の谷", nameEn: "Spell Valley", trophyMin: 1300, trophyMax: 1599, icon: "🧪" },
    { id: "arena_6", name: "大工の作業場", nameEn: "Builder's Workshop", trophyMin: 1600, trophyMax: 1999, icon: "🔨" },
    { id: "arena_7", name: "ロイヤルアリーナ", nameEn: "Royal Arena", trophyMin: 2000, trophyMax: 2299, icon: "👑" },
    { id: "arena_8", name: "フローズンピーク", nameEn: "Frozen Peak", trophyMin: 2300, trophyMax: 2599, icon: "❄️" },
    { id: "arena_9", name: "ジャングルアリーナ", nameEn: "Jungle Arena", trophyMin: 2600, trophyMax: 2999, icon: "🌴" },
    { id: "arena_10", name: "ホグマウンテン", nameEn: "Hog Mountain", trophyMin: 3000, trophyMax: 3399, icon: "⛰️" },
    { id: "arena_11", name: "エレクトロバレー", nameEn: "Electro Valley", trophyMin: 3400, trophyMax: 3799, icon: "⚡" },
    { id: "arena_12", name: "スプーキータウン", nameEn: "Spooky Town", trophyMin: 3800, trophyMax: 4199, icon: "👻" },
    { id: "arena_13", name: "アサシンアジト", nameEn: "Rascal's Hideout", trophyMin: 4200, trophyMax: 4599, icon: "🦹" },
    { id: "arena_14", name: "静寂の聖域", nameEn: "Serenity Peak", trophyMin: 4600, trophyMax: 4999, icon: "⛩️" },
    { id: "arena_15", name: "鉱夫の鉱山", nameEn: "Miner's Mine", trophyMin: 5000, trophyMax: 5499, icon: "⛏️" },
    { id: "arena_16", name: "処刑人の厨房", nameEn: "Executioner's Kitchen", trophyMin: 5500, trophyMax: 5999, icon: "🍳" },
    { id: "arena_17", name: "王宮の地下室", nameEn: "Royal Crypt", trophyMin: 6000, trophyMax: 6499, icon: "🪦" },
    { id: "arena_18", name: "静寂の聖域", nameEn: "Silent Sanctuary", trophyMin: 6500, trophyMax: 6999, icon: "🕊️" },
    { id: "arena_19", name: "ドラゴンパース", nameEn: "Dragon Spa", trophyMin: 7000, trophyMax: 7499, icon: "♨️" },
    { id: "arena_20", name: "アサシンアジト II", nameEn: "Boot Camp", trophyMin: 7500, trophyMax: 7999, icon: "🥾" },
    { id: "arena_21", name: "修羅の道", nameEn: "Clash Fest", trophyMin: 8000, trophyMax: 8499, icon: "🎉" },
    { id: "arena_22", name: "修羅の道 II", nameEn: "PANCAKES!", trophyMin: 8500, trophyMax: 8999, icon: "🥞" },
    { id: "arena_23", name: "伝説の道", nameEn: "Legendary Arena", trophyMin: 9000, trophyMax: 99999, icon: "🏆" }
];

/** トロフィー数から該当アリーナを返す */
export function getArenaByTrophies(trophies: number): Arena {
    return ARENAS.find(a => trophies >= a.trophyMin && trophies <= a.trophyMax)
        ?? ARENAS[ARENAS.length - 1];
}

// ===== アリーナ別 TOP メタデッキ =====
// 各ティアに8デッキを定義（アリーナごとに流行デッキが異なる）

export const BEGINNER_DECKS: ArenaDeckStats[] = [
    {
        deckId: "bg-giant-witch", deckName: "ジャイアントウィッチ", archetype: "beatdown",
        cards: ["Giant", "Witch", "Musketeer", "Fireball", "Arrows", "Skeleton Army", "Mini P.E.K.K.A", "Tombstone"],
        winRate: 58.3, useRate: 12.1, avgElixir: 3.9, trend: "stable",
    },
    {
        deckId: "bg-hog-musketeer", deckName: "ホグマスケ", archetype: "hog",
        cards: ["Hog Rider", "Musketeer", "Valkyrie", "Fireball", "Zap", "Skeleton Army", "Goblin Barrel", "Inferno Tower"],
        winRate: 56.8, useRate: 10.5, avgElixir: 3.8, trend: "up",
    },
    {
        deckId: "bg-pekka-wizard", deckName: "ペッカウィザード", archetype: "beatdown",
        cards: ["P.E.K.K.A", "Wizard", "Hog Rider", "Zap", "Fireball", "Skeleton Army", "Baby Dragon", "Tombstone"],
        winRate: 55.4, useRate: 9.2, avgElixir: 4.3, trend: "stable",
    },
    {
        deckId: "bg-balloon-freeze", deckName: "バルーンフリーズ", archetype: "lava",
        cards: ["Balloon", "Freeze", "Lumberjack", "Baby Dragon", "Tombstone", "Arrows", "Skeletons", "Bats"],
        winRate: 54.7, useRate: 7.8, avgElixir: 3.4, trend: "up",
    },
    {
        deckId: "bg-mk-bait", deckName: "メガナイト枯渇", archetype: "bait",
        cards: ["Mega Knight", "Goblin Barrel", "Skeleton Army", "Inferno Dragon", "Zap", "Bats", "Goblin Gang", "Miner"],
        winRate: 54.2, useRate: 11.3, avgElixir: 3.6, trend: "stable",
    },
    {
        deckId: "bg-golem-nw", deckName: "ゴーレムネクロ", archetype: "golem",
        cards: ["Golem", "Night Witch", "Baby Dragon", "Lumberjack", "Lightning", "Tornado", "Mega Minion", "Barbarian Barrel"],
        winRate: 53.1, useRate: 6.5, avgElixir: 4.4, trend: "down",
    },
    {
        deckId: "bg-royal-giant", deckName: "ロイジャイ入門", archetype: "cycle",
        cards: ["Royal Giant", "Musketeer", "Fireball", "The Log", "Ice Spirit", "Skeletons", "Mega Minion", "Furnace"],
        winRate: 52.5, useRate: 5.9, avgElixir: 3.6, trend: "stable",
    },
    {
        deckId: "bg-logbait", deckName: "ログ枯渇", archetype: "bait",
        cards: ["Goblin Barrel", "Princess", "Goblin Gang", "Rocket", "The Log", "Inferno Tower", "Ice Spirit", "Knight"],
        winRate: 51.8, useRate: 7.2, avgElixir: 3.3, trend: "up",
    },
];

export const CHALLENGER_DECKS: ArenaDeckStats[] = [
    {
        deckId: "ch-hog-eq", deckName: "ホグアースクエイク", archetype: "hog",
        cards: ["Hog Rider", "Earthquake", "Valkyrie", "Musketeer", "Ice Spirit", "Skeletons", "The Log", "Fireball"],
        winRate: 56.1, useRate: 11.8, avgElixir: 3.4, trend: "up",
    },
    {
        deckId: "ch-logbait", deckName: "ログ枯渇（改）", archetype: "bait",
        cards: ["Goblin Barrel", "Princess", "Goblin Gang", "Rocket", "The Log", "Inferno Tower", "Ice Spirit", "Knight"],
        winRate: 55.7, useRate: 9.4, avgElixir: 3.3, trend: "stable",
    },
    {
        deckId: "ch-lava-loon", deckName: "ラヴァバルーン", archetype: "lava",
        cards: ["Lava Hound", "Balloon", "Mega Minion", "Tombstone", "Fireball", "Arrows", "Minions", "Skeleton Army"],
        winRate: 54.9, useRate: 8.6, avgElixir: 3.9, trend: "stable",
    },
    {
        deckId: "ch-pekka-bridge", deckName: "ペッカブリッジスパム", archetype: "bridge-spam",
        cards: ["P.E.K.K.A", "Battle Ram", "Electro Wizard", "Dark Prince", "Magic Archer", "Zap", "Fireball", "The Log"],
        winRate: 54.5, useRate: 10.1, avgElixir: 3.9, trend: "up",
    },
    {
        deckId: "ch-mk-loon", deckName: "メガナイトバルーン", archetype: "beatdown",
        cards: ["Mega Knight", "Balloon", "Inferno Dragon", "Miner", "Bats", "Snowball", "Skeleton Army", "Lumberjack"],
        winRate: 53.8, useRate: 7.7, avgElixir: 3.6, trend: "down",
    },
    {
        deckId: "ch-xbow-cycle", deckName: "クロスボウサイクル", archetype: "xbow",
        cards: ["X-Bow", "Tesla", "Ice Spirit", "Skeletons", "The Log", "Fireball", "Ice Golem", "Archers"],
        winRate: 53.2, useRate: 5.4, avgElixir: 3.0, trend: "stable",
    },
    {
        deckId: "ch-graveyard-poison", deckName: "グレイブヤードポイズン", archetype: "graveyard",
        cards: ["Graveyard", "Poison", "Knight", "Ice Wizard", "Tornado", "Barbarian Barrel", "Baby Dragon", "Cannon Cart"],
        winRate: 52.8, useRate: 4.8, avgElixir: 3.5, trend: "up",
    },
    {
        deckId: "ch-mortar-cycle", deckName: "迫撃砲サイクル", archetype: "cycle",
        cards: ["Mortar", "Miner", "Bats", "Ice Spirit", "Skeletons", "Rocket", "The Log", "Knight"],
        winRate: 52.1, useRate: 3.9, avgElixir: 3.0, trend: "stable",
    },
];

export const MASTER_DECKS: ArenaDeckStats[] = [
    {
        deckId: "ms-hog-cycle", deckName: "ホグ2.6サイクル", archetype: "hog",
        cards: ["Hog Rider", "Musketeer", "Ice Golem", "Ice Spirit", "Skeletons", "Cannon", "Fireball", "The Log"],
        winRate: 55.8, useRate: 13.2, avgElixir: 2.6, trend: "stable",
    },
    {
        deckId: "ms-pekka-bs", deckName: "ペッカBS（改）", archetype: "bridge-spam",
        cards: ["P.E.K.K.A", "Battle Ram", "Bandit", "Electro Wizard", "Magic Archer", "Poison", "Zap", "Royal Ghost"],
        winRate: 55.2, useRate: 10.8, avgElixir: 3.8, trend: "up",
    },
    {
        deckId: "ms-logbait-rocket", deckName: "ログ枯渇ロケット", archetype: "bait",
        cards: ["Goblin Barrel", "Princess", "Goblin Gang", "Rocket", "The Log", "Inferno Tower", "Ice Spirit", "Knight"],
        winRate: 54.6, useRate: 8.9, avgElixir: 3.3, trend: "stable",
    },
    {
        deckId: "ms-lava-loon-mm", deckName: "ラヴァバルーン空軍", archetype: "lava",
        cards: ["Lava Hound", "Balloon", "Mega Minion", "Tombstone", "Lightning", "Arrows", "Baby Dragon", "Minions"],
        winRate: 54.1, useRate: 7.5, avgElixir: 4.0, trend: "up",
    },
    {
        deckId: "ms-golem-beat", deckName: "ゴーレムビートダウン", archetype: "golem",
        cards: ["Golem", "Night Witch", "Lumberjack", "Baby Dragon", "Lightning", "Tornado", "Mega Minion", "Barbarian Barrel"],
        winRate: 53.5, useRate: 6.1, avgElixir: 4.4, trend: "down",
    },
    {
        deckId: "ms-rg-cycle", deckName: "ロイジャイサイクル", archetype: "cycle",
        cards: ["Royal Giant", "Furnace", "Electro Dragon", "Ice Spirit", "Skeletons", "Zap", "Arrows", "The Log"],
        winRate: 53.0, useRate: 5.8, avgElixir: 3.4, trend: "stable",
    },
    {
        deckId: "ms-miner-wb", deckName: "マイナーウォールブレーカー", archetype: "cycle",
        cards: ["Miner", "Wall Breakers", "Bats", "Spear Goblins", "Snowball", "Inferno Tower", "Valkyrie", "The Log"],
        winRate: 52.4, useRate: 5.2, avgElixir: 3.0, trend: "up",
    },
    {
        deckId: "ms-xbow-30", deckName: "クロスボウ3.0", archetype: "xbow",
        cards: ["X-Bow", "Tesla", "Ice Spirit", "Skeletons", "The Log", "Fireball", "Ice Golem", "Knight"],
        winRate: 51.9, useRate: 4.5, avgElixir: 3.0, trend: "down",
    },
];

export const CHAMPION_DECKS: ArenaDeckStats[] = [
    {
        deckId: "cp-hog-eq-queen", deckName: "ホグEQアチャクイ", archetype: "hog",
        cards: ["Hog Rider", "Earthquake", "Archer Queen", "Valkyrie", "Skeletons", "Ice Spirit", "The Log", "Cannon"],
        winRate: 56.7, useRate: 14.3, avgElixir: 3.3, trend: "up",
    },
    {
        deckId: "cp-pekka-bs-gk", deckName: "ペッカBSゴールドナイト", archetype: "bridge-spam",
        cards: ["P.E.K.K.A", "Battle Ram", "Golden Knight", "Electro Wizard", "Magic Archer", "Poison", "Zap", "Dark Prince"],
        winRate: 55.3, useRate: 11.2, avgElixir: 4.0, trend: "stable",
    },
    {
        deckId: "cp-logbait-monk", deckName: "枯渇モンク", archetype: "bait",
        cards: ["Goblin Barrel", "Princess", "Monk", "Goblin Gang", "Rocket", "The Log", "Inferno Tower", "Ice Spirit"],
        winRate: 54.8, useRate: 9.5, avgElixir: 3.4, trend: "up",
    },
    {
        deckId: "cp-lava-loon-sk", deckName: "ラヴァバルスケキン", archetype: "lava",
        cards: ["Lava Hound", "Balloon", "Skeleton King", "Mega Minion", "Tombstone", "Lightning", "Arrows", "Minions"],
        winRate: 54.2, useRate: 7.8, avgElixir: 4.1, trend: "stable",
    },
    {
        deckId: "cp-graveyard-evo", deckName: "グレヤドフリーズ進化", archetype: "graveyard",
        cards: ["Graveyard", "Freeze", "Knight", "Ice Wizard", "Tornado", "Barbarian Barrel", "Baby Dragon", "Cannon Cart"],
        winRate: 53.6, useRate: 5.9, avgElixir: 3.5, trend: "up",
    },
    {
        deckId: "cp-3m-pump", deckName: "3マスケポンプ", archetype: "beatdown",
        cards: ["Three Musketeers", "Elixir Collector", "Battle Ram", "Minion Horde", "Goblin Gang", "The Log", "Miner", "Ice Golem"],
        winRate: 53.0, useRate: 4.3, avgElixir: 3.9, trend: "down",
    },
    {
        deckId: "cp-drill-aq", deckName: "ドリルアチャクイ", archetype: "drill",
        cards: ["Goblin Drill", "Archer Queen", "Valkyrie", "Bats", "Ice Spirit", "Skeletons", "Fireball", "The Log"],
        winRate: 52.5, useRate: 5.5, avgElixir: 3.1, trend: "stable",
    },
    {
        deckId: "cp-eg-lightning", deckName: "エリゴレライトニング", archetype: "beatdown",
        cards: ["Elixir Golem", "Battle Healer", "Baby Dragon", "Lightning", "Tornado", "Barbarian Barrel", "Electro Dragon", "Night Witch"],
        winRate: 51.8, useRate: 3.8, avgElixir: 3.9, trend: "down",
    },
];

export const GRANDMASTER_DECKS: ArenaDeckStats[] = [
    {
        deckId: "gm-hog-aq-eq", deckName: "ホグAQ EQ", archetype: "hog",
        cards: ["Hog Rider", "Archer Queen", "Earthquake", "Cannon", "Ice Spirit", "Skeletons", "The Log", "Fireball"],
        winRate: 57.1, useRate: 15.8, avgElixir: 3.1, trend: "up",
    },
    {
        deckId: "gm-pekka-bs-pro", deckName: "ペッカBS極", archetype: "bridge-spam",
        cards: ["P.E.K.K.A", "Battle Ram", "Bandit", "Electro Wizard", "Magic Archer", "Poison", "Zap", "Golden Knight"],
        winRate: 55.9, useRate: 12.4, avgElixir: 4.0, trend: "stable",
    },
    {
        deckId: "gm-logbait-aq", deckName: "枯渇AQ", archetype: "bait",
        cards: ["Goblin Barrel", "Princess", "Archer Queen", "Goblin Gang", "Rocket", "The Log", "Inferno Tower", "Ice Spirit"],
        winRate: 55.2, useRate: 9.1, avgElixir: 3.4, trend: "stable",
    },
    {
        deckId: "gm-lava-sk-loon", deckName: "ラヴァスケキンバルーン", archetype: "lava",
        cards: ["Lava Hound", "Balloon", "Skeleton King", "Tombstone", "Lightning", "Arrows", "Mega Minion", "Baby Dragon"],
        winRate: 54.5, useRate: 7.2, avgElixir: 4.1, trend: "up",
    },
    {
        deckId: "gm-mortar-aq", deckName: "迫撃AQサイクル", archetype: "cycle",
        cards: ["Mortar", "Archer Queen", "Miner", "Bats", "Ice Spirit", "Skeletons", "Rocket", "The Log"],
        winRate: 53.8, useRate: 5.6, avgElixir: 3.1, trend: "stable",
    },
    {
        deckId: "gm-gy-freeze-pro", deckName: "グレヤドフリーズ極", archetype: "graveyard",
        cards: ["Graveyard", "Freeze", "Monk", "Ice Wizard", "Tornado", "Barbarian Barrel", "Baby Dragon", "Cannon Cart"],
        winRate: 53.2, useRate: 4.9, avgElixir: 3.6, trend: "up",
    },
    {
        deckId: "gm-rg-aq", deckName: "ロイジャイAQ", archetype: "cycle",
        cards: ["Royal Giant", "Archer Queen", "Fisherman", "Lightning", "Ice Spirit", "Skeletons", "The Log", "Mega Minion"],
        winRate: 52.6, useRate: 5.3, avgElixir: 3.6, trend: "stable",
    },
    {
        deckId: "gm-golem-clone", deckName: "ゴーレムクローン", archetype: "golem",
        cards: ["Golem", "Clone", "Night Witch", "Lumberjack", "Baby Dragon", "Tornado", "Mega Minion", "Barbarian Barrel"],
        winRate: 52.0, useRate: 3.7, avgElixir: 4.3, trend: "down",
    },
];

export const TOP_LADDER_DECKS: ArenaDeckStats[] = [
    {
        deckId: "tl-hog-aq-evo", deckName: "ホグAQ進化", archetype: "hog",
        cards: ["Hog Rider", "Archer Queen", "Earthquake", "Cannon", "Ice Spirit", "Skeletons", "The Log", "Valkyrie"],
        winRate: 57.8, useRate: 16.5, avgElixir: 3.3, trend: "up",
    },
    {
        deckId: "tl-pekka-bs-final", deckName: "ペッカBS究極", archetype: "bridge-spam",
        cards: ["P.E.K.K.A", "Battle Ram", "Bandit", "Electro Wizard", "Magic Archer", "Poison", "Zap", "Golden Knight"],
        winRate: 56.3, useRate: 13.1, avgElixir: 4.0, trend: "stable",
    },
    {
        deckId: "tl-logbait-monk", deckName: "枯渇モンク究極", archetype: "bait",
        cards: ["Goblin Barrel", "Princess", "Monk", "Goblin Gang", "Rocket", "The Log", "Inferno Tower", "Skeleton Army"],
        winRate: 55.6, useRate: 8.7, avgElixir: 3.4, trend: "up",
    },
    {
        deckId: "tl-lava-sk-pro", deckName: "ラヴァスケキンプロ", archetype: "lava",
        cards: ["Lava Hound", "Balloon", "Skeleton King", "Mega Minion", "Tombstone", "Lightning", "Arrows", "Minions"],
        winRate: 55.0, useRate: 6.9, avgElixir: 4.1, trend: "stable",
    },
    {
        deckId: "tl-gy-monk", deckName: "グレヤドモンク", archetype: "graveyard",
        cards: ["Graveyard", "Poison", "Monk", "Ice Wizard", "Tornado", "Barbarian Barrel", "Knight", "Cannon Cart"],
        winRate: 54.3, useRate: 5.2, avgElixir: 3.5, trend: "up",
    },
    {
        deckId: "tl-rg-fisherman", deckName: "ロイジャイフィッシャーマン", archetype: "cycle",
        cards: ["Royal Giant", "Fisherman", "Archer Queen", "Lightning", "Mega Minion", "Ice Spirit", "Skeletons", "The Log"],
        winRate: 53.5, useRate: 5.8, avgElixir: 3.6, trend: "stable",
    },
    {
        deckId: "tl-3m-heal", deckName: "3マスケヒールスピ", archetype: "beatdown",
        cards: ["Three Musketeers", "Elixir Collector", "Battle Ram", "Heal Spirit", "Minion Horde", "Goblin Gang", "The Log", "Miner"],
        winRate: 52.8, useRate: 3.4, avgElixir: 3.9, trend: "down",
    },
    {
        deckId: "tl-eg-healer", deckName: "エリゴレヒーラー", archetype: "beatdown",
        cards: ["Elixir Golem", "Battle Healer", "Electro Dragon", "Baby Dragon", "Lightning", "Tornado", "Barbarian Barrel", "Night Witch"],
        winRate: 52.1, useRate: 2.9, avgElixir: 3.9, trend: "stable",
    },
];

export const ULTIMATE_DECKS: ArenaDeckStats[] = [
    {
        deckId: "ul-hog-aq-meta", deckName: "ホグAQ最終メタ", archetype: "hog",
        cards: ["Hog Rider", "Archer Queen", "Earthquake", "Cannon", "Ice Spirit", "Skeletons", "The Log", "Valkyrie"],
        winRate: 58.2, useRate: 18.1, avgElixir: 3.3, trend: "up",
    },
    {
        deckId: "ul-pekka-bs-meta", deckName: "ペッカBS最終メタ", archetype: "bridge-spam",
        cards: ["P.E.K.K.A", "Battle Ram", "Bandit", "Electro Wizard", "Magic Archer", "Poison", "Zap", "Golden Knight"],
        winRate: 56.8, useRate: 14.2, avgElixir: 4.0, trend: "stable",
    },
    {
        deckId: "ul-logbait-meta", deckName: "枯渇メタ究極", archetype: "bait",
        cards: ["Goblin Barrel", "Princess", "Monk", "Goblin Gang", "Rocket", "The Log", "Inferno Tower", "Skeleton Army"],
        winRate: 56.1, useRate: 9.3, avgElixir: 3.4, trend: "stable",
    },
    {
        deckId: "ul-lava-meta", deckName: "ラヴァバルーンメタ", archetype: "lava",
        cards: ["Lava Hound", "Balloon", "Skeleton King", "Mega Minion", "Tombstone", "Lightning", "Arrows", "Minions"],
        winRate: 55.4, useRate: 7.5, avgElixir: 4.1, trend: "up",
    },
    {
        deckId: "ul-gy-meta", deckName: "グレヤドメタ究極", archetype: "graveyard",
        cards: ["Graveyard", "Poison", "Monk", "Ice Wizard", "Tornado", "Barbarian Barrel", "Knight", "Cannon Cart"],
        winRate: 54.7, useRate: 5.8, avgElixir: 3.5, trend: "up",
    },
    {
        deckId: "ul-mortar-meta", deckName: "迫撃最終メタ", archetype: "cycle",
        cards: ["Mortar", "Archer Queen", "Miner", "Bats", "Ice Spirit", "Skeletons", "Rocket", "The Log"],
        winRate: 54.0, useRate: 4.6, avgElixir: 3.1, trend: "stable",
    },
    {
        deckId: "ul-rg-meta", deckName: "ロイジャイメタ究極", archetype: "cycle",
        cards: ["Royal Giant", "Fisherman", "Archer Queen", "Lightning", "Mega Minion", "Ice Spirit", "Skeletons", "The Log"],
        winRate: 53.5, useRate: 4.1, avgElixir: 3.6, trend: "stable",
    },
    {
        deckId: "ul-golem-meta", deckName: "ゴーレムメタ究極", archetype: "golem",
        cards: ["Golem", "Night Witch", "Lumberjack", "Baby Dragon", "Lightning", "Tornado", "Mega Minion", "Barbarian Barrel"],
        winRate: 52.8, useRate: 3.2, avgElixir: 4.4, trend: "down",
    },
];

// ===== アリーナ → デッキデータのマッピング =====

const ARENA_DECKS_MAP: Record<string, ArenaDeckStats[]> = {
    "beginner": BEGINNER_DECKS,
    "challenger": CHALLENGER_DECKS,
    "master": MASTER_DECKS,
    "champion": CHAMPION_DECKS,
    "grandmaster": GRANDMASTER_DECKS,
    "top-ladder": TOP_LADDER_DECKS,
    "ultimate": ULTIMATE_DECKS,
};

// 内部でトロフィー数から表示用のダミーデッキを取得する専用関数（アリーナのID判定用、フォールバックとして残す）
export function getFallbackDecksByArenaId(arenaId: string): ArenaDeckStats[] {
    if (arenaId === "arena_22" || arenaId === "arena_23") return ULTIMATE_DECKS;
    if (arenaId === "arena_19" || arenaId === "arena_20" || arenaId === "arena_21") return TOP_LADDER_DECKS;
    if (arenaId === "arena_17" || arenaId === "arena_18") return GRANDMASTER_DECKS;
    if (arenaId === "arena_15" || arenaId === "arena_16") return CHAMPION_DECKS;
    if (arenaId === "arena_12" || arenaId === "arena_13" || arenaId === "arena_14") return MASTER_DECKS;
    if (arenaId === "arena_9" || arenaId === "arena_10" || arenaId === "arena_11") return CHALLENGER_DECKS;
    return BEGINNER_DECKS;
}

/** アリーナカテゴリIDへのマッピングヘルパー */
function getArenaCategoryId(arenaId: string): string {
    if (arenaId === "arena_22" || arenaId === "arena_23") return "ultimate";
    if (arenaId === "arena_19" || arenaId === "arena_20" || arenaId === "arena_21") return "top-ladder";
    if (arenaId === "arena_17" || arenaId === "arena_18") return "grandmaster";
    if (arenaId === "arena_15" || arenaId === "arena_16") return "champion";
    if (arenaId === "arena_12" || arenaId === "arena_13" || arenaId === "arena_14") return "master";
    if (arenaId === "arena_9" || arenaId === "arena_10" || arenaId === "arena_11") return "challenger";
    return "beginner";
}

/** Supabaseから特定のアリーナ圏のメタデータを取得する (非同期) */
export async function fetchArenaMetaFromDB(trophiesOrArenaInput: number | string | Arena): Promise<ArenaMetaInfo> {
    let arena: Arena;
    if (typeof trophiesOrArenaInput === "number") {
        arena = getArenaByTrophies(trophiesOrArenaInput);
    } else if (typeof trophiesOrArenaInput === "string") {
        arena = ARENAS.find(a => a.id === trophiesOrArenaInput) ?? ARENAS[ARENAS.length - 1];
    } else {
        arena = trophiesOrArenaInput;
    }

    const categoryId = getArenaCategoryId(arena.id);

    try {
        const { data, error } = await supabase
            .from('arena_meta_stats')
            .select('top_decks, total_analyzed_battles')
            .eq('arena_id', categoryId)
            .single();

        if (error || !data) {
            console.error("Supabase fetch failed, falling back to static data", error);
            return calculateArenaMetaInfo(arena, getFallbackDecksByArenaId(arena.id));
        }

        return calculateArenaMetaInfo(arena, data.top_decks as ArenaDeckStats[]);
    } catch (err) {
        console.error("Unexpected DB error, falling back to static data", err);
        return calculateArenaMetaInfo(arena, getFallbackDecksByArenaId(arena.id));
    }
}

/** 内部の計算・正規化ロジック (DBデータと静的データの両方で共通利用する) */
export function calculateArenaMetaInfo(arena: Arena, topDecks: ArenaDeckStats[]): ArenaMetaInfo {

    // 全トップデッキの合計使用率（正規化の母数）
    const totalMetaUseRate = topDecks.reduce((sum, deck) => sum + deck.useRate, 0);

    // カードの出現割合と加重勝率を集計
    const cardUseRateSum: Record<string, number> = {};
    const cardWeightedWinSum: Record<string, number> = {};

    for (const deck of topDecks) {
        for (const card of deck.cards) {
            cardUseRateSum[card] = (cardUseRateSum[card] ?? 0) + deck.useRate;
            cardWeightedWinSum[card] = (cardWeightedWinSum[card] ?? 0) + (deck.winRate * deck.useRate);
        }
    }

    // 流行カードTOP5（使用率順）
    const hotCards = Object.entries(cardUseRateSum)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

    // カード別使用率＋勝率データ
    const spellNames = new Set(["Fireball", "Arrows", "Zap", "Poison", "The Log", "Lightning", "Rocket", "Tornado", "Freeze", "Snowball", "Earthquake", "Barbarian Barrel", "Rage", "Royal Delivery", "Goblin Barrel", "Graveyard", "Clone"]);
    const buildingNames = new Set(["Cannon", "Tesla", "Bomb Tower", "Inferno Tower", "Mortar", "X-Bow", "Furnace", "Tombstone", "Goblin Hut", "Barbarian Hut", "Elixir Collector", "Goblin Drill"]);
    const legendaryNames = new Set(["Princess", "Miner", "Ice Wizard", "Lava Hound", "Sparky", "Inferno Dragon", "Lumberjack", "Bandit", "Electro Wizard", "Night Witch", "Magic Archer", "Ram Rider", "Graveyard", "Royal Ghost", "Mega Knight", "Mother Witch", "Fisherman"]);
    const championNames = new Set(["Skeleton King", "Golden Knight", "Archer Queen", "Monk", "Mighty Miner", "Little Prince"]);
    const epicNames = new Set(["Baby Dragon", "Witch", "Prince", "Dark Prince", "P.E.K.K.A", "Balloon", "Giant Skeleton", "Goblin Giant", "Skeleton Army", "Guards", "Goblin Barrel", "Rage", "Goblin Drill", "Executioner", "Bowler", "Electro Dragon", "Cannon Cart", "Hunter", "Wall Breakers", "X-Bow", "Poison", "Lightning", "Tornado", "Freeze", "Barbarian Barrel", "Clone"]);
    const rareNames = new Set(["Giant", "Musketeer", "Mini P.E.K.K.A", "Valkyrie", "Hog Rider", "Battle Ram", "Wizard", "Flying Machine", "Royal Hogs", "Ice Golem", "Dart Goblin", "Three Musketeers", "Elixir Golem", "Zappies", "Heal Spirit", "Mega Minion", "Bomb Tower", "Inferno Tower", "Furnace", "Tombstone", "Goblin Hut", "Barbarian Hut", "Elixir Collector", "Fireball", "Rocket", "Earthquake"]);

    const cardStats: ArenaCardStats[] = Object.entries(cardUseRateSum)
        .map(([name, rawUseRate]) => {
            // トップメタ全体を100%とした時の相対的な採用率（正規化）
            const normalizedUsageRate = totalMetaUseRate > 0 ? (rawUseRate / totalMetaUseRate) * 100 : 0;
            const usageRate = Math.round(normalizedUsageRate * 10) / 10;

            // コスト（デッキ使用率）を重みとした加重平均勝率
            const weightedWinRate = rawUseRate > 0 ? cardWeightedWinSum[name] / rawUseRate : 0;
            const winRate = Math.round(weightedWinRate * 10) / 10;

            const type = spellNames.has(name) ? "spell" as const : buildingNames.has(name) ? "building" as const : "troop" as const;
            const rarity = championNames.has(name) ? "champion" as const
                : legendaryNames.has(name) ? "legendary" as const
                    : epicNames.has(name) ? "epic" as const
                        : rareNames.has(name) ? "rare" as const
                            : "common" as const;
            return {
                name, type, rarity, usageRate, winRate,
                trend: usageRate > 40 ? "up" as const : usageRate < 15 ? "down" as const : "stable" as const,
            };
        })
        .sort((a, b) => b.usageRate - a.usageRate);

    return { arena, topDecks, hotCards, cardStats };
}

// 内部でアリーナ勝率を取得
export function getArenaWinRate(arenaId: string, deckCards: string[]): number | null {
    let decks: ArenaDeckStats[] = [];

    if (arenaId === "arena_22" || arenaId === "arena_23") decks = ULTIMATE_DECKS;
    else if (arenaId === "arena_19" || arenaId === "arena_20" || arenaId === "arena_21") decks = TOP_LADDER_DECKS;
    else if (arenaId === "arena_17" || arenaId === "arena_18") decks = GRANDMASTER_DECKS;
    else if (arenaId === "arena_15" || arenaId === "arena_16") decks = CHAMPION_DECKS;
    else if (arenaId === "arena_12" || arenaId === "arena_13" || arenaId === "arena_14") decks = MASTER_DECKS;
    else if (arenaId === "arena_9" || arenaId === "arena_10" || arenaId === "arena_11") decks = CHALLENGER_DECKS;
    else decks = BEGINNER_DECKS;

    if (!decks || decks.length === 0) return null; // Handle case where no decks are found for the arena

    // カード構成が最も近いデッキを探す
    let bestMatch = 0;
    let bestWinRate: number | null = null;
    let bestUseRateForTie = -1;

    for (const deck of decks) {
        const overlap = deck.cards.filter(c =>
            deckCards.some(dc => dc.toLowerCase() === c.toLowerCase())
        ).length;

        // 一致数が多い、または、一致数が同じで使用率（人気）が高い実績あるメタデッキを優先
        if (overlap > bestMatch || (overlap === bestMatch && deck.useRate > bestUseRateForTie)) {
            bestMatch = overlap;
            bestWinRate = deck.winRate;
            bestUseRateForTie = deck.useRate;
        }
    }

    // 3枚以上が一致するデッキがあればその勝率を返す
    return bestMatch >= 3 ? bestWinRate : null;
}
