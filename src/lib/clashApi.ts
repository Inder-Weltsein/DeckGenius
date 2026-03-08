// Clash Royale 公式APIクライアント
// https://developer.clashroyale.com/

const BASE_URL = "https://api.clashroyale.com/v1";
const TOKEN = process.env.CLASH_API_TOKEN;

function encodeTag(tag: string): string {
    // "#YQ08892" → "%23YQ08892"
    return encodeURIComponent(tag.startsWith("#") ? tag : `#${tag}`);
}

async function fetchCR<T>(path: string): Promise<T> {
    if (!TOKEN) {
        throw new Error("CLASH_API_TOKEN が設定されていません。.env.local を確認してください。");
    }
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        next: { revalidate: 60 }, // Next.js キャッシュ 60秒
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`CRAPIエラー ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
}

// ===== 型定義 =====

export interface CRCard {
    name: string;
    id: number;
    level: number;
    maxLevel: number;
    starLevel?: number;
    evolutionLevel?: number;    // 限界突破
    maxEvolutionLevel?: number; // 限界突破の最大幅
    iconUrls: { medium: string; evolutionMedium?: string; };
}

export interface CRPlayer {
    tag: string;
    name: string;
    expLevel: number;
    trophies: number;
    bestTrophies: number;
    wins: number;
    losses: number;
    arena?: {
        id: number;
        name: string;
    };
    cards: CRCard[];
    currentDeck: CRCard[];
}

export interface BattleCard {
    name: string;
    id: number;
    level: number;
    maxLevel: number;
    evolutionLevel?: number;
    iconUrls: { medium: string; evolutionMedium?: string; };
}

export interface BattleTeam {
    tag: string;
    name: string;
    crownsEarned: number;
    cards: BattleCard[];
}

export interface Battle {
    type: string;
    battleTime: string;
    team: BattleTeam[];
    opponent: BattleTeam[];
}

// ===== APIメソッド =====

/** プレイヤー情報（所持カード含む）を取得 */
export async function getPlayer(tag: string): Promise<CRPlayer> {
    return fetchCR<CRPlayer>(`/players/${encodeTag(tag)}`);
}

/** 直近のバトルログを取得（最大25件） */
export async function getBattleLog(tag: string): Promise<Battle[]> {
    return fetchCR<Battle[]>(`/players/${encodeTag(tag)}/battlelog`);
}
