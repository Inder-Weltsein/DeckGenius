// バックエンドAPIルート: GET /api/analyze?tag=YQ08892
import { NextRequest, NextResponse } from "next/server";
import { getPlayer, getBattleLog } from "@/lib/clashApi";
import { analyze } from "@/lib/analyzer";
import { getArenaByTrophies, fetchArenaMetaFromDB } from "@/lib/arenaMeta";

// APIトークンが有効かチェック
function isValidToken(token: string | undefined): boolean {
    return !!token && token !== "your_token_here" && token.length > 10;
}

// Upstash Redisキャッシュ（環境変数が設定されていない場合はスキップ）
async function getCachedOrFetch(tag: string) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const cacheKey = `deckgenius:${tag.replace("#", "")}`;

    if (redisUrl && redisToken) {
        try {
            const { Redis } = await import("@upstash/redis");
            const redis = new Redis({ url: redisUrl, token: redisToken });

            const cached = await redis.get<string>(cacheKey);
            if (cached) {
                return JSON.parse(typeof cached === "string" ? cached : JSON.stringify(cached));
            }

            const result = await fetchAndAnalyze(tag);
            await redis.set(cacheKey, JSON.stringify(result), { ex: 60 });
            return result;
        } catch (err) {
            console.warn("Redis接続に失敗、キャッシュなしで続行:", err);
        }
    }

    return fetchAndAnalyze(tag);
}

async function fetchAndAnalyze(tag: string) {
    const [player, battles] = await Promise.all([
        getPlayer(tag),
        getBattleLog(tag),
    ]);

    return await analyze(player.name, player.trophies, player.cards, battles, player.arena);
}

export async function GET(req: NextRequest) {
    const tag = req.nextUrl.searchParams.get("tag");
    if (!tag) {
        return NextResponse.json({ error: "tagパラメータが必要です" }, { status: 400 });
    }

    // APIトークンが未設定またはプレースホルダーの場合はデモデータを返す
    if (!isValidToken(process.env.CLASH_API_TOKEN)) {
        console.log("[DeckGenius] APIトークン未設定 → デモモードで動作");
        return NextResponse.json(await getDemoData(tag), { status: 200 });
    }

    try {
        const result = await getCachedOrFetch(tag);
        return NextResponse.json(result);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "";
        // どんなエラーが発生してもデモデータにフォールバック
        // （正式なタグでも架空のタグでもデモで動作確認できるように）
        console.warn("[DeckGenius] APIエラー → デモフォールバック:", message.slice(0, 100));
        return NextResponse.json(await getDemoData(tag), { status: 200 });
    }
}

// ===== デモデッキライブラリ（アーキタイプ別3種, TOC準拠） =====
const DEMO_DECKS = [
    {
        meta: {
            id: "hog-rage", name: "ホグレイジ", archetype: "hog",
            cards: ["Hog Rider", "Rage", "Mini P.E.K.K.A", "Little Prince", "The Log", "Ice Golem", "Skeletons", "Fireball"],
            avgElixir: 3.4,
            idealElixirRange: [2.6, 3.5] as [number, number],
            synergyPairs: [["Hog Rider", "Rage"], ["Ice Golem", "Hog Rider"]] as [string, string][],
            counters: ["P.E.K.K.A", "Mega Knight"], strongAgainst: ["Goblin Barrel", "Royal Hogs"], globalWinRate: 54.2,
        },
        cards: [
            { name: "Hog Rider", id: 26000036, level: 14, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/hog-rider.png" } },
            { name: "Rage", id: 28000006, level: 11, maxLevel: 11, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/rage.png" } },
            { name: "Mini P.E.K.K.A", id: 26000021, level: 13, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/mini-pekka.png" } },
            { name: "Little Prince", id: 26000093, level: 14, maxLevel: 5, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/little-prince.png" } },
            { name: "The Log", id: 28000011, level: 13, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/the-log.png" } },
            { name: "Ice Golem", id: 26000029, level: 14, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/ice-golem.png" } },
            { name: "Skeletons", id: 26000006, level: 14, maxLevel: 14, evolutionLevel: 1, iconUrls: { medium: "https://api-assets.clashroyale.com/cardevolutions/300/oO7iKMU5m0cdxhYPZA3nWQiAUh2yoGgdThLWB1rVSec.png" } },
            { name: "Fireball", id: 28000000, level: 13, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/fireball.png" } },
        ],
        compatibilityScore: 92,
        coachMessage: "（デモ）直近の対戦でメガナイトへの対策が不十分です。Lv14ホグライダーを軸にした「ホグレイジ」でカウンターしましょう！",
        scoreBreakdown: { growthScore: 88, metaScore: 82, roleScore: 90, synergyScore: 80, costScore: 95 },
        deckSuggestions: [] as string[],
        upgradePriority: [
            { name: "Mini P.E.K.K.A", iconUrl: "", currentLevel: 13, targetLevel: 14, winRateBoost: 2.1 },
            { name: "The Log", iconUrl: "", currentLevel: 13, targetLevel: 14, winRateBoost: 1.5 },
            { name: "Fireball", iconUrl: "", currentLevel: 13, targetLevel: 14, winRateBoost: 1.2 },
        ],
    },
    {
        meta: {
            id: "lava-balloon", name: "ラヴァバルーン", archetype: "lava",
            cards: ["Lava Hound", "Balloon", "Mega Minion", "Tombstone", "Lightning", "Arrows", "Baby Dragon", "Minions"],
            avgElixir: 4.0,
            idealElixirRange: [3.8, 4.4] as [number, number],
            synergyPairs: [["Lava Hound", "Balloon"], ["Baby Dragon", "Lava Hound"]] as [string, string][],
            counters: ["Inferno Dragon", "X-Bow", "Inferno Tower"], strongAgainst: ["Hog Rider", "Giant", "Golem"], globalWinRate: 52.8,
        },
        cards: [
            { name: "Lava Hound", id: 26000028, level: 13, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/lava-hound.png" } },
            { name: "Balloon", id: 26000016, level: 14, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/balloon.png" } },
            { name: "Mega Minion", id: 26000044, level: 14, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/mega-minion.png" } },
            { name: "Tombstone", id: 27000006, level: 13, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/tombstone.png" } },
            { name: "Lightning", id: 28000004, level: 12, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/lightning.png" } },
            { name: "Arrows", id: 28000001, level: 14, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/arrows.png" } },
            { name: "Baby Dragon", id: 26000015, level: 13, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/baby-dragon.png" } },
            { name: "Minions", id: 26000003, level: 14, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/minions.png" } },
        ],
        compatibilityScore: 88,
        coachMessage: "（デモ）直近の対戦でバルーンが多く見られます。「ラヴァバルーン」で制空権を制しタワーを焼き尽くしましょう！",
        scoreBreakdown: { growthScore: 82, metaScore: 75, roleScore: 85, synergyScore: 90, costScore: 88 },
        deckSuggestions: [] as string[],
        upgradePriority: [
            { name: "Lava Hound", iconUrl: "", currentLevel: 13, targetLevel: 14, winRateBoost: 1.8 },
            { name: "Lightning", iconUrl: "", currentLevel: 12, targetLevel: 13, winRateBoost: 2.5 },
            { name: "Baby Dragon", iconUrl: "", currentLevel: 13, targetLevel: 14, winRateBoost: 1.2 },
        ],
    },
    {
        meta: {
            id: "graveyard-freeze", name: "グレイブヤードフリーズ", archetype: "graveyard",
            cards: ["Graveyard", "Freeze", "Barbarian Barrel", "Ice Wizard", "Knight", "Poison", "Tornado", "Cannon Cart"],
            avgElixir: 3.5,
            idealElixirRange: [3.0, 3.8] as [number, number],
            synergyPairs: [["Graveyard", "Freeze"], ["Ice Wizard", "Tornado"]] as [string, string][],
            counters: ["Minion Horde", "Arrows", "Fireball"], strongAgainst: ["X-Bow", "Giant", "Golem"], globalWinRate: 51.5,
        },
        cards: [
            { name: "Graveyard", id: 28000008, level: 13, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/graveyard.png" } },
            { name: "Freeze", id: 28000003, level: 12, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/freeze.png" } },
            { name: "Barbarian Barrel", id: 28000015, level: 14, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/barbarian-barrel.png" } },
            { name: "Ice Wizard", id: 26000023, level: 13, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/ice-wizard.png" } },
            { name: "Knight", id: 26000000, level: 14, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/knight.png" } },
            { name: "Poison", id: 28000010, level: 13, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/poison.png" } },
            { name: "Tornado", id: 28000013, level: 13, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/tornado.png" } },
            { name: "Cannon Cart", id: 26000049, level: 12, maxLevel: 14, iconUrls: { medium: "https://cdn.royaleapi.com/static/img/cards-150/cannon-cart.png" } },
        ],
        compatibilityScore: 85,
        coachMessage: "（デモ）守りを固めながら「グレイブヤード＋フリーズ」で一気に大ダメージ。ゲームを制するトリッキーな戦術です！",
        scoreBreakdown: { growthScore: 79, metaScore: 70, roleScore: 75, synergyScore: 85, costScore: 92 },
        deckSuggestions: ["💡 対空ユニットが1枚しかありません（推奨2枚以上）。飛行ユニットに弱くなります。"] as string[],
        upgradePriority: [
            { name: "Graveyard", iconUrl: "", currentLevel: 13, targetLevel: 14, winRateBoost: 2.3 },
            { name: "Freeze", iconUrl: "", currentLevel: 12, targetLevel: 13, winRateBoost: 2.0 },
            { name: "Poison", iconUrl: "", currentLevel: 13, targetLevel: 14, winRateBoost: 1.4 },
        ],
    },
];

// APIトークン未設定時のデモデータ（タグのハッシュ値で再現性あり・3アーキタイプから選択）
async function getDemoData(tag: string) {
    const hash = tag.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const primaryIdx = hash % DEMO_DECKS.length;
    const primary = DEMO_DECKS[primaryIdx];

    const alternatives = DEMO_DECKS
        .filter((_, i) => i !== primaryIdx)
        .map(({ meta, cards, compatibilityScore, scoreBreakdown }) => ({
            meta, cards, compatibilityScore, scoreBreakdown,
        }));

    const trophies = 6240;
    const arena = getArenaByTrophies(trophies);
    const arenaMetaInfo = await fetchArenaMetaFromDB(trophies);

    return {
        playerName: "デモプレイヤー",
        trophies,
        arena,
        arenaMetaInfo,
        recommendedDeck: {
            meta: primary.meta,
            cards: primary.cards,
            compatibilityScore: primary.compatibilityScore,
            coachMessage: primary.coachMessage + "（APIトークンを設定すると実際のデータで分析できます）",
            scoreBreakdown: primary.scoreBreakdown,
        },
        alternativeDecks: alternatives,
        localMeta: [
            { cardName: "Mega Knight", count: 7 },
            { cardName: "Balloon", count: 5 },
            { cardName: "Goblin Barrel", count: 4 },
        ],
        upgradePriority: primary.upgradePriority,
        _demo: true,
        _tag: tag,
    };
}

