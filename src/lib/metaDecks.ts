// 現環境のトップメタデッキ定義（週次更新を想定）
// Last updated: 2026-02

export interface MetaDeck {
    id: string;
    name: string;
    archetype: string;   // "hog" | "golem" | "xbow" | "cycle" etc.
    cards: string[];     // カード名（英語・公式名）
    avgElixir: number;   // 平均エリクサーコスト
    idealElixirRange: [number, number]; // アーキタイプ適正コスト範囲 [min, max]
    synergyPairs: [string, string][]; // シナジーカードペア
    counters: string[];  // このデッキが不利なカード名
    strongAgainst: string[]; // このデッキが有利なカード名
    globalWinRate: number;   // グローバル勝率（%）
}

export const META_DECKS: MetaDeck[] = [
    {
        id: "hog-rage",
        name: "ホグレイジ",
        archetype: "hog",
        cards: ["Hog Rider", "Rage", "Mini P.E.K.K.A", "Musketeer", "The Log", "Ice Golem", "Skeletons", "Fireball"],
        avgElixir: 3.4,
        idealElixirRange: [2.6, 3.5],
        synergyPairs: [["Hog Rider", "Rage"], ["Ice Golem", "Hog Rider"], ["Mini P.E.K.K.A", "Ice Golem"]],
        counters: ["P.E.K.K.A", "Mega Knight", "Balloon"],
        strongAgainst: ["Goblin Barrel", "Royal Hogs", "Miner"],
        globalWinRate: 54.2,
    },
    {
        id: "hog-cycle",
        name: "ホグサイクル",
        archetype: "hog",
        cards: ["Hog Rider", "Ice Spirit", "Skeletons", "The Log", "Cannon", "Fireball", "Musketeer", "Ice Golem"],
        avgElixir: 2.6,
        idealElixirRange: [2.4, 3.0],
        synergyPairs: [["Hog Rider", "Ice Golem"], ["Ice Spirit", "Skeletons"], ["Musketeer", "Cannon"]],
        counters: ["Inferno Dragon", "P.E.K.K.A", "Mega Knight"],
        strongAgainst: ["Goblin Barrel", "Miner", "Bridge Spam"],
        globalWinRate: 53.8,
    },
    {
        id: "xbow-cycle",
        name: "クロスボウサイクル",
        archetype: "xbow",
        cards: ["X-Bow", "Ice Spirit", "Skeletons", "The Log", "Tesla", "Fireball", "Ice Golem", "Knight"],
        avgElixir: 3.0,
        idealElixirRange: [2.8, 3.2],
        synergyPairs: [["X-Bow", "Tesla"], ["Ice Golem", "X-Bow"], ["Ice Spirit", "Skeletons"]],
        counters: ["Lava Hound", "Balloon", "Giant"],
        strongAgainst: ["Hog Rider", "Miner", "Graveyard"],
        globalWinRate: 53.5,
    },
    {
        id: "miner-poison",
        name: "マイナーポイズン枯渇",
        archetype: "cycle",
        cards: ["Miner", "Poison", "Goblin Gang", "Inferno Tower", "Bats", "Ice Spirit", "Skeletons", "The Log"],
        avgElixir: 3.0,
        idealElixirRange: [2.6, 3.2],
        synergyPairs: [["Miner", "Poison"], ["Goblin Gang", "Miner"], ["Bats", "Miner"]],
        counters: ["Rocket", "Mega Knight", "Balloon"],
        strongAgainst: ["Graveyard", "Hog Rider", "Bridge Spam"],
        globalWinRate: 53.1,
    },
    {
        id: "lava-balloon",
        name: "ラヴァバルーン",
        archetype: "lava",
        cards: ["Lava Hound", "Balloon", "Mega Minion", "Tombstone", "Lightning", "Arrows", "Baby Dragon", "Minions"],
        avgElixir: 4.0,
        idealElixirRange: [3.8, 4.4],
        synergyPairs: [["Lava Hound", "Balloon"], ["Baby Dragon", "Lava Hound"], ["Mega Minion", "Balloon"]],
        counters: ["Inferno Dragon", "X-Bow", "Inferno Tower"],
        strongAgainst: ["Hog Rider", "Giant", "Golem"],
        globalWinRate: 52.8,
    },
    {
        id: "giant-skeleton",
        name: "ジャイアント骨骸",
        archetype: "beatdown",
        cards: ["Giant Skeleton", "Mega Knight", "P.E.K.K.A", "Electro Wizard", "Zap", "Barbarians", "Fireball", "Arrows"],
        avgElixir: 4.5,
        idealElixirRange: [4.0, 4.8],
        synergyPairs: [["Giant Skeleton", "Mega Knight"], ["Electro Wizard", "P.E.K.K.A"]],
        counters: ["Inferno Dragon", "Inferno Tower", "X-Bow"],
        strongAgainst: ["Hog Rider", "Bridge Spam", "Cycle"],
        globalWinRate: 52.3,
    },
    {
        id: "pekka-bridge",
        name: "ペッカブリッジスパム",
        archetype: "bridge-spam",
        cards: ["P.E.K.K.A", "Electro Wizard", "Battle Ram", "Dark Prince", "Magic Archer", "Zap", "Fireball", "The Log"],
        avgElixir: 3.9,
        idealElixirRange: [3.5, 4.2],
        synergyPairs: [["Battle Ram", "Dark Prince"], ["P.E.K.K.A", "Electro Wizard"], ["Magic Archer", "Fireball"]],
        counters: ["Inferno Dragon", "Graveyard", "Lava Hound"],
        strongAgainst: ["Giant", "Hog Rider", "Golem"],
        globalWinRate: 52.0,
    },
    {
        id: "goblin-drill",
        name: "ゴブリンドリル",
        archetype: "drill",
        cards: ["Goblin Drill", "Valkyrie", "Archers", "Zap", "Ice Spirit", "Skeletons", "Goblin Gang", "Fireball"],
        avgElixir: 3.0,
        idealElixirRange: [2.8, 3.2],
        synergyPairs: [["Goblin Drill", "Valkyrie"], ["Goblin Gang", "Goblin Drill"]],
        counters: ["Earthquake", "Rocket", "Giant Snowball"],
        strongAgainst: ["Hog Rider", "Miner", "Cycle"],
        globalWinRate: 51.7,
    },
    {
        id: "graveyard-freeze",
        name: "グレイブヤードフリーズ",
        archetype: "graveyard",
        cards: ["Graveyard", "Freeze", "Barbarian Barrel", "Ice Wizard", "Knight", "Poison", "Tornado", "Cannon Cart"],
        avgElixir: 3.5,
        idealElixirRange: [3.0, 3.8],
        synergyPairs: [["Graveyard", "Freeze"], ["Ice Wizard", "Tornado"], ["Knight", "Graveyard"]],
        counters: ["Minion Horde", "Arrows", "Fireball"],
        strongAgainst: ["X-Bow", "Giant", "Golem"],
        globalWinRate: 51.5,
    },
    {
        id: "royal-giant-cycle",
        name: "ロイジャイサイクル",
        archetype: "cycle",
        cards: ["Royal Giant", "Furnace", "Zap", "Ice Spirit", "Skeletons", "Electro Dragon", "Arrows", "The Log"],
        avgElixir: 3.4,
        idealElixirRange: [3.0, 3.6],
        synergyPairs: [["Royal Giant", "Furnace"], ["Electro Dragon", "Royal Giant"]],
        counters: ["Inferno Dragon", "Inferno Tower", "Tesla"],
        strongAgainst: ["Hog Rider", "Cycle", "Bridge Spam"],
        globalWinRate: 51.2,
    },
];

/** カード名でメタデッキを検索 */
export function findDecksContaining(cardName: string): MetaDeck[] {
    return META_DECKS.filter(d => d.cards.includes(cardName));
}

/** アーキタイプで検索 */
export function findDecksByArchetype(archetype: string): MetaDeck[] {
    return META_DECKS.filter(d => d.archetype === archetype);
}
