/**
 * [廃止] /api/cron/update-meta
 *
 * 旧: 乱数で勝率・使用率を微変動させるシミュレーション
 * 新: /api/cron/aggregate-trends に統合済み
 *
 * このファイルは互換性のため空のレスポンスを返す。
 * 次回デプロイ後に削除可能。
 */

import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        status: "deprecated",
        message: "このエンドポイントは廃止されました。/api/cron/aggregate-trends を使用してください。",
    });
}
