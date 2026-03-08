/**
 * cards.ts — クラロワ全カード定義（役割タグ＋日本語名付き）
 * TOC（TruthOfCrown）ロジックの「役割と呪文」軸で使用する。
 */

// ========== 型定義 ==========
export type CardType = "troop" | "spell" | "building";
export type CardRarity = "common" | "rare" | "epic" | "legendary" | "champion";

export type CardTag =
    | "win_condition"   // 主軸（タワーを削る手段）
    | "spell"           // 呪文
    | "anti_air"        // 対空ユニット
    | "tank"            // 盾役（HP高い）
    | "tank_killer"     // タンク処理（単体高火力）
    | "splash"          // 範囲攻撃（群れ処理）
    | "cycle"           // 低コスト回転要員
    | "building"        // 建物
    | "support"         // 後衛支援
    | "swarm";          // 群れユニット

export interface CardDefinition {
    name: string;
    nameJa: string;
    type: CardType;
    rarity: CardRarity;
    elixir: number;
    tags: CardTag[];
}

// ========== カード名 英語→日本語 翻訳 ==========
const _cache = new Map<string, CardDefinition>();
const _jaCache = new Map<string, string>();

export function getCardDef(name: string): CardDefinition | undefined {
    if (_cache.size === 0) {
        ALL_CARDS.forEach(c => {
            _cache.set(c.name, c);
            _jaCache.set(c.name, c.nameJa);
        });
    }
    return _cache.get(name);
}

/** 英語カード名を日本語に変換。見つからない場合はそのまま返す */
export function ja(name: string): string {
    if (_jaCache.size === 0) {
        ALL_CARDS.forEach(c => _jaCache.set(c.name, c.nameJa));
    }
    return _jaCache.get(name) ?? name;
}

export function hasTag(name: string, tag: CardTag): boolean {
    return getCardDef(name)?.tags.includes(tag) ?? false;
}

/** デッキ（カード名配列）内の指定タグのカード数を返す */
export function countTag(deck: string[], tag: CardTag): number {
    return deck.filter(n => hasTag(n, tag)).length;
}

/** デッキの役割チェック結果 */
export interface RoleCheckResult {
    hasWinCondition: boolean;
    antiAirCount: number;
    spellCount: number;
    hasTankKiller: boolean;
    hasSplash: boolean;
    warnings: string[];
}

export function checkRoles(deck: string[]): RoleCheckResult {
    const wc = countTag(deck, "win_condition");
    const aa = countTag(deck, "anti_air");
    const sp = countTag(deck, "spell");
    const tk = countTag(deck, "tank_killer");
    const sl = countTag(deck, "splash");
    const warnings: string[] = [];

    if (wc === 0) warnings.push("⚠️ 主軸（Win Condition）がありません。タワーを削る手段を入れましょう。");
    if (aa < 2) warnings.push(`⚠️ 対空ユニットが${aa}枚しかありません（推奨2枚以上）。飛行ユニットに弱くなります。`);
    if (sp === 0) warnings.push("⚠️ 呪文が0枚です。最低1枚は入れましょう。");
    if (sp >= 3) warnings.push(`⚠️ 呪文が${sp}枚あり、手札事故の危険があります。2枚以下を推奨します。`);
    if (tk === 0) warnings.push("⚠️ タンク処理カードがありません。ゴーレムやジャイアントへの対応が困難です。");
    if (sl === 0) warnings.push("⚠️ 範囲攻撃カードがありません。スケルトン部隊等の群れユニットに弱くなります。");

    return {
        hasWinCondition: wc > 0,
        antiAirCount: aa,
        spellCount: sp,
        hasTankKiller: tk > 0,
        hasSplash: sl > 0,
        warnings,
    };
}

// ========== 全カード定義（主要109枚, 日本語名付き） ==========
export const ALL_CARDS: CardDefinition[] = [
    // --- ユニット: コモン ---
    { name: "Knight", nameJa: "ナイト", type: "troop", rarity: "common", elixir: 3, tags: ["tank"] },
    { name: "Archers", nameJa: "アーチャー", type: "troop", rarity: "common", elixir: 3, tags: ["anti_air", "support"] },
    { name: "Bomber", nameJa: "ボンバー", type: "troop", rarity: "common", elixir: 2, tags: ["splash"] },
    { name: "Spear Goblins", nameJa: "槍ゴブリン", type: "troop", rarity: "common", elixir: 2, tags: ["anti_air", "cycle", "swarm"] },
    { name: "Goblins", nameJa: "ゴブリン", type: "troop", rarity: "common", elixir: 2, tags: ["cycle", "swarm"] },
    { name: "Skeletons", nameJa: "スケルトン", type: "troop", rarity: "common", elixir: 1, tags: ["cycle", "swarm"] },
    { name: "Minions", nameJa: "ガーゴイル", type: "troop", rarity: "common", elixir: 3, tags: ["anti_air", "swarm"] },
    { name: "Minion Horde", nameJa: "ガーゴイルの群れ", type: "troop", rarity: "common", elixir: 5, tags: ["anti_air", "swarm"] },
    { name: "Bats", nameJa: "コウモリの群れ", type: "troop", rarity: "common", elixir: 2, tags: ["anti_air", "cycle", "swarm"] },
    { name: "Ice Spirit", nameJa: "アイススピリット", type: "troop", rarity: "common", elixir: 1, tags: ["cycle"] },
    { name: "Fire Spirit", nameJa: "ファイアスピリット", type: "troop", rarity: "common", elixir: 1, tags: ["cycle", "splash"] },
    { name: "Electro Spirit", nameJa: "エレクトロスピリット", type: "troop", rarity: "common", elixir: 1, tags: ["cycle"] },
    { name: "Royal Giant", nameJa: "ロイヤルジャイアント", type: "troop", rarity: "common", elixir: 6, tags: ["win_condition", "tank"] },
    { name: "Elite Barbarians", nameJa: "エリートバーバリアン", type: "troop", rarity: "common", elixir: 6, tags: ["tank_killer"] },
    { name: "Royal Recruits", nameJa: "ロイヤルリクルート", type: "troop", rarity: "common", elixir: 7, tags: ["tank", "swarm"] },
    { name: "Firecracker", nameJa: "ファイアクラッカー", type: "troop", rarity: "common", elixir: 3, tags: ["anti_air", "splash"] },
    { name: "Skeleton Dragons", nameJa: "スケルトンドラゴン", type: "troop", rarity: "common", elixir: 4, tags: ["anti_air", "splash"] },

    // --- ユニット: レア ---
    { name: "Giant", nameJa: "ジャイアント", type: "troop", rarity: "rare", elixir: 5, tags: ["win_condition", "tank"] },
    { name: "Musketeer", nameJa: "マスケット銃士", type: "troop", rarity: "rare", elixir: 4, tags: ["anti_air", "support", "tank_killer"] },
    { name: "Mini P.E.K.K.A", nameJa: "ミニP.E.K.K.A", type: "troop", rarity: "rare", elixir: 4, tags: ["tank_killer"] },
    { name: "Valkyrie", nameJa: "バルキリー", type: "troop", rarity: "rare", elixir: 4, tags: ["splash", "tank"] },
    { name: "Hog Rider", nameJa: "ホグライダー", type: "troop", rarity: "rare", elixir: 4, tags: ["win_condition"] },
    { name: "Battle Ram", nameJa: "攻城バーバリアン", type: "troop", rarity: "rare", elixir: 4, tags: ["win_condition"] },
    { name: "Wizard", nameJa: "ウィザード", type: "troop", rarity: "rare", elixir: 5, tags: ["anti_air", "splash", "support"] },
    { name: "Flying Machine", nameJa: "フライングマシン", type: "troop", rarity: "rare", elixir: 4, tags: ["anti_air", "support"] },
    { name: "Royal Hogs", nameJa: "ロイヤルホグ", type: "troop", rarity: "rare", elixir: 5, tags: ["win_condition", "swarm"] },
    { name: "Ice Golem", nameJa: "アイスゴーレム", type: "troop", rarity: "rare", elixir: 2, tags: ["tank", "cycle"] },
    { name: "Dart Goblin", nameJa: "ダートゴブリン", type: "troop", rarity: "rare", elixir: 3, tags: ["anti_air", "cycle"] },
    { name: "Three Musketeers", nameJa: "三銃士", type: "troop", rarity: "rare", elixir: 9, tags: ["anti_air", "support"] },
    { name: "Elixir Golem", nameJa: "エリクサーゴーレム", type: "troop", rarity: "rare", elixir: 3, tags: ["tank"] },
    { name: "Zappies", nameJa: "ザッピー", type: "troop", rarity: "rare", elixir: 4, tags: ["support"] },
    { name: "Heal Spirit", nameJa: "ヒールスピリット", type: "troop", rarity: "rare", elixir: 1, tags: ["cycle"] },

    // --- ユニット: エピック ---
    { name: "Baby Dragon", nameJa: "ベビードラゴン", type: "troop", rarity: "epic", elixir: 4, tags: ["anti_air", "splash", "tank"] },
    { name: "Witch", nameJa: "ウィッチ", type: "troop", rarity: "epic", elixir: 5, tags: ["anti_air", "splash", "support"] },
    { name: "Prince", nameJa: "プリンス", type: "troop", rarity: "epic", elixir: 5, tags: ["tank_killer"] },
    { name: "Dark Prince", nameJa: "ダークプリンス", type: "troop", rarity: "epic", elixir: 4, tags: ["splash", "tank"] },
    { name: "P.E.K.K.A", nameJa: "P.E.K.K.A", type: "troop", rarity: "epic", elixir: 7, tags: ["tank_killer", "tank"] },
    { name: "Balloon", nameJa: "エアバルーン", type: "troop", rarity: "epic", elixir: 5, tags: ["win_condition"] },
    { name: "Giant Skeleton", nameJa: "巨大スケルトン", type: "troop", rarity: "epic", elixir: 6, tags: ["tank", "splash"] },
    { name: "Goblin Giant", nameJa: "ゴブリンジャイアント", type: "troop", rarity: "epic", elixir: 6, tags: ["tank"] },
    { name: "Skeleton Army", nameJa: "スケルトン部隊", type: "troop", rarity: "epic", elixir: 3, tags: ["swarm", "tank_killer"] },
    { name: "Guards", nameJa: "ガード", type: "troop", rarity: "epic", elixir: 3, tags: ["swarm"] },
    { name: "Goblin Barrel", nameJa: "ゴブリンバレル", type: "spell", rarity: "epic", elixir: 3, tags: ["win_condition", "spell"] },
    { name: "Rage", nameJa: "レイジ", type: "spell", rarity: "epic", elixir: 2, tags: ["spell"] },
    { name: "Goblin Drill", nameJa: "ゴブリンドリル", type: "building", rarity: "epic", elixir: 4, tags: ["win_condition", "building"] },
    { name: "Executioner", nameJa: "エクスキューショナー", type: "troop", rarity: "epic", elixir: 5, tags: ["anti_air", "splash"] },
    { name: "Bowler", nameJa: "ボウラー", type: "troop", rarity: "epic", elixir: 5, tags: ["splash"] },
    { name: "Electro Dragon", nameJa: "エレクトロドラゴン", type: "troop", rarity: "epic", elixir: 5, tags: ["anti_air", "splash"] },
    { name: "Cannon Cart", nameJa: "大砲カート", type: "troop", rarity: "epic", elixir: 5, tags: ["support", "tank_killer"] },
    { name: "Hunter", nameJa: "ハンター", type: "troop", rarity: "epic", elixir: 4, tags: ["anti_air", "tank_killer"] },
    { name: "Goblin Gang", nameJa: "ゴブリンギャング", type: "troop", rarity: "common", elixir: 3, tags: ["swarm", "cycle"] },
    { name: "Wall Breakers", nameJa: "ウォールブレイカー", type: "troop", rarity: "epic", elixir: 2, tags: ["win_condition", "cycle"] },
    { name: "Mega Minion", nameJa: "メガガーゴイル", type: "troop", rarity: "rare", elixir: 3, tags: ["anti_air", "tank_killer"] },

    // --- ユニット: レジェンダリー ---
    { name: "Princess", nameJa: "プリンセス", type: "troop", rarity: "legendary", elixir: 3, tags: ["anti_air", "splash"] },
    { name: "Miner", nameJa: "ディガー", type: "troop", rarity: "legendary", elixir: 3, tags: ["win_condition", "tank"] },
    { name: "Ice Wizard", nameJa: "アイスウィザード", type: "troop", rarity: "legendary", elixir: 3, tags: ["anti_air", "splash", "support"] },
    { name: "Lava Hound", nameJa: "ラヴァハウンド", type: "troop", rarity: "legendary", elixir: 7, tags: ["win_condition", "tank"] },
    { name: "Sparky", nameJa: "スパーキー", type: "troop", rarity: "legendary", elixir: 6, tags: ["tank_killer", "splash"] },
    { name: "Inferno Dragon", nameJa: "インフェルノドラゴン", type: "troop", rarity: "legendary", elixir: 4, tags: ["anti_air", "tank_killer"] },
    { name: "Lumberjack", nameJa: "ランバージャック", type: "troop", rarity: "legendary", elixir: 4, tags: ["tank_killer"] },
    { name: "Bandit", nameJa: "バンディット", type: "troop", rarity: "legendary", elixir: 3, tags: ["tank_killer"] },
    { name: "Electro Wizard", nameJa: "エレクトロウィザード", type: "troop", rarity: "legendary", elixir: 4, tags: ["anti_air", "support"] },
    { name: "Night Witch", nameJa: "ナイトウィッチ", type: "troop", rarity: "legendary", elixir: 4, tags: ["support", "swarm"] },
    { name: "Magic Archer", nameJa: "マジックアーチャー", type: "troop", rarity: "legendary", elixir: 4, tags: ["anti_air", "splash", "support"] },
    { name: "Ram Rider", nameJa: "ラムライダー", type: "troop", rarity: "legendary", elixir: 5, tags: ["win_condition"] },
    { name: "Graveyard", nameJa: "グレイブヤード", type: "spell", rarity: "legendary", elixir: 5, tags: ["win_condition", "spell"] },
    { name: "Royal Ghost", nameJa: "ロイヤルゴースト", type: "troop", rarity: "legendary", elixir: 3, tags: ["splash"] },
    { name: "Mega Knight", nameJa: "メガナイト", type: "troop", rarity: "legendary", elixir: 7, tags: ["tank", "splash", "tank_killer"] },
    { name: "Mother Witch", nameJa: "マザーウィッチ", type: "troop", rarity: "legendary", elixir: 4, tags: ["anti_air", "support"] },
    { name: "Fisherman", nameJa: "漁師", type: "troop", rarity: "legendary", elixir: 3, tags: ["support"] },

    // --- ユニット: チャンピオン ---
    { name: "Skeleton King", nameJa: "スケルトンキング", type: "troop", rarity: "champion", elixir: 4, tags: ["tank", "splash"] },
    { name: "Golden Knight", nameJa: "ゴールドナイト", type: "troop", rarity: "champion", elixir: 4, tags: ["tank_killer"] },
    { name: "Archer Queen", nameJa: "アーチャークイーン", type: "troop", rarity: "champion", elixir: 5, tags: ["anti_air", "tank_killer", "support"] },
    { name: "Monk", nameJa: "モンク", type: "troop", rarity: "champion", elixir: 5, tags: ["tank", "tank_killer"] },
    { name: "Mighty Miner", nameJa: "マイティディガー", type: "troop", rarity: "champion", elixir: 4, tags: ["tank_killer"] },
    { name: "Little Prince", nameJa: "リトルプリンス", type: "troop", rarity: "champion", elixir: 3, tags: ["anti_air", "support"] },

    // --- 呪文 ---
    { name: "Fireball", nameJa: "ファイアボール", type: "spell", rarity: "rare", elixir: 4, tags: ["spell", "splash"] },
    { name: "Arrows", nameJa: "矢の雨", type: "spell", rarity: "common", elixir: 3, tags: ["spell", "splash"] },
    { name: "Zap", nameJa: "ザップ", type: "spell", rarity: "common", elixir: 2, tags: ["spell", "cycle"] },
    { name: "Poison", nameJa: "ポイズン", type: "spell", rarity: "epic", elixir: 4, tags: ["spell"] },
    { name: "The Log", nameJa: "ローリングウッド", type: "spell", rarity: "legendary", elixir: 2, tags: ["spell", "cycle"] },
    { name: "Lightning", nameJa: "ライトニング", type: "spell", rarity: "epic", elixir: 6, tags: ["spell", "tank_killer"] },
    { name: "Rocket", nameJa: "ロケット", type: "spell", rarity: "rare", elixir: 6, tags: ["spell", "tank_killer"] },
    { name: "Tornado", nameJa: "トルネード", type: "spell", rarity: "epic", elixir: 3, tags: ["spell"] },
    { name: "Freeze", nameJa: "フリーズ", type: "spell", rarity: "epic", elixir: 4, tags: ["spell"] },
    { name: "Snowball", nameJa: "スノーボール", type: "spell", rarity: "common", elixir: 2, tags: ["spell", "cycle"] },
    { name: "Earthquake", nameJa: "アースクエイク", type: "spell", rarity: "rare", elixir: 3, tags: ["spell"] },
    { name: "Barbarian Barrel", nameJa: "バーバリアンの小屋", type: "spell", rarity: "epic", elixir: 2, tags: ["spell", "cycle"] },
    { name: "Royal Delivery", nameJa: "ロイヤルデリバリー", type: "spell", rarity: "common", elixir: 3, tags: ["spell", "splash"] },

    // --- 建物 ---
    { name: "Cannon", nameJa: "大砲", type: "building", rarity: "common", elixir: 3, tags: ["building"] },
    { name: "Tesla", nameJa: "テスラ", type: "building", rarity: "common", elixir: 4, tags: ["building", "anti_air"] },
    { name: "Bomb Tower", nameJa: "ボムタワー", type: "building", rarity: "rare", elixir: 4, tags: ["building", "splash"] },
    { name: "Inferno Tower", nameJa: "インフェルノタワー", type: "building", rarity: "rare", elixir: 5, tags: ["building", "tank_killer"] },
    { name: "Mortar", nameJa: "迫撃砲", type: "building", rarity: "common", elixir: 4, tags: ["building", "win_condition"] },
    { name: "X-Bow", nameJa: "クロスボウ", type: "building", rarity: "epic", elixir: 6, tags: ["building", "win_condition"] },
    { name: "Furnace", nameJa: "ファーネス", type: "building", rarity: "rare", elixir: 4, tags: ["building"] },
    { name: "Tombstone", nameJa: "墓石", type: "building", rarity: "rare", elixir: 3, tags: ["building", "swarm"] },
    { name: "Goblin Hut", nameJa: "ゴブリンの小屋", type: "building", rarity: "rare", elixir: 5, tags: ["building"] },
    { name: "Barbarian Hut", nameJa: "バーバリアンの小屋", type: "building", rarity: "rare", elixir: 7, tags: ["building"] },
    { name: "Elixir Collector", nameJa: "エリクサーポンプ", type: "building", rarity: "rare", elixir: 6, tags: ["building"] },
    { name: "Battle Healer", nameJa: "バトルヒーラー", type: "troop", rarity: "rare", elixir: 4, tags: ["tank", "support"] },

    // --- 新カード等追加 ---
    { name: "Void", nameJa: "ヴォイド", type: "spell", rarity: "epic", elixir: 3, tags: ["spell", "tank_killer"] },
    { name: "Goblin Curse", nameJa: "ゴブリンの呪い", type: "spell", rarity: "epic", elixir: 2, tags: ["spell", "splash"] },
    { name: "Vines", nameJa: "ゴブリンの呪い", type: "spell", rarity: "epic", elixir: 2, tags: ["spell", "splash"] },
    { name: "Suspicious Bush", nameJa: "あやしいブッシュ", type: "troop", rarity: "rare", elixir: 2, tags: ["win_condition", "cycle"] },
    { name: "Goblin Demolisher", nameJa: "ゴブリンデモリッシャー", type: "troop", rarity: "rare", elixir: 4, tags: ["splash", "tank_killer"] },
    { name: "Goblin Machine", nameJa: "ゴブリンマシン", type: "troop", rarity: "legendary", elixir: 5, tags: ["tank", "splash"] },
    { name: "Goblinstein", nameJa: "ゴブリンシュタイン", type: "troop", rarity: "champion", elixir: 5, tags: ["tank", "anti_air"] }
];
