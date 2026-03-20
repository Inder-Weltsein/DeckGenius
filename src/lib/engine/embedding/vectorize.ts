import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';

/**
 * Gemini Text Embedding 2 を用いてデッキのカード構成から768次元ベクトルを生成する。
 * taskType: TaskType.CLUSTERING を指定し、アーキタイプ分類に特化させる。
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
  // Gemini APIのEmbeddingモデル指定 (models/プレフィックス必須の場合は付与)
  const model = genAI.getGenerativeModel({ model: 'models/gemini-embedding-2-preview' });

  // プロンプトはあえて自然言語で意味付けを行う
  const text = `Clash Royale deck: ${[...cardNames].sort().join(', ')}`;

  try {
    const result = await model.embedContent({
      content: { parts: [{ text }], role: 'user' },
      taskType: TaskType.CLUSTERING,
      // @ts-expect-error: outputDimensionality is supported by the API but missing in current SDK types
      outputDimensionality: 768, // Supabase拡張のvector(768)に合わせる
    });
    
    return result.embedding.values;
  } catch (err: unknown) {
    console.error("[vectorize] Gemini API Error:", (err as Error).message);
    throw err;
  }
}
