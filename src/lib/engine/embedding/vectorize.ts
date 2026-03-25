import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { getCardDef } from '../../cards';

/**
 * [2-2] カード名 + 役割タグを含む強化テキストを生成する
 * 例: "Hog Rider (win_condition, bridge_spam, cycle)"
 *
 * テキストembeddingに戦略的コンテキストを与え、
 * 名前が異なる同アーキタイプのカードを近いベクトルにする。
 */
function buildEnhancedDeckText(cardNames: string[]): string {
    const parts = [...cardNames].sort().map(name => {
        const def = getCardDef(name);
        if (def && def.tags.length > 0) {
            return `${name} (${def.tags.join(', ')})`;
        }
        return name;
    });
    return `Clash Royale deck: ${parts.join(', ')}`;
}

/**
 * Gemini Text Embedding を用いてデッキのカード構成から768次元ベクトルを生成する。
 * taskType: TaskType.CLUSTERING を指定し、アーキタイプ分類に特化させる。
 *
 * [2-2] カード役割タグを含めた強化テキストを使用することで、
 *       "Hog Rider" と "Battle Ram" のような戦略的類似デッキが
 *       近いベクトル空間に配置されるよう改善。
 *
 * @param cardNames ソート済みのカード名配列
 * @returns 768次元のFloatベクトル配列
 */
export async function deckToVector(cardNames: string[]): Promise<number[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'models/gemini-embedding-2-preview' });

    // [2-2] 役割タグ付き強化テキストを使用
    const text = buildEnhancedDeckText(cardNames);

    try {
        const result = await model.embedContent({
            content: { parts: [{ text }], role: 'user' },
            taskType: TaskType.CLUSTERING,
            // @ts-expect-error: outputDimensionality is supported by the API but missing in current SDK types
            outputDimensionality: 768,
        });

        return result.embedding.values;
    } catch (err: unknown) {
        console.error("[vectorize] Gemini API Error:", (err as Error).message);
        throw err;
    }
}
