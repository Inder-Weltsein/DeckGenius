// GET /api/arena?trophies=6240  or  GET /api/arena?id=champion
import { NextRequest, NextResponse } from "next/server";
import { fetchArenaMetaFromDB, ARENAS } from "@/lib/arenaMeta";

export async function GET(req: NextRequest) {
    const trophiesParam = req.nextUrl.searchParams.get("trophies");
    const idParam = req.nextUrl.searchParams.get("id");

    if (!trophiesParam && !idParam) {
        return NextResponse.json(
            { error: "trophies または id パラメータが必要です" },
            { status: 400 }
        );
    }

    try {
        const metaInfo = trophiesParam
            ? await fetchArenaMetaFromDB(parseInt(trophiesParam, 10))
            : await fetchArenaMetaFromDB(idParam!);

        return NextResponse.json({
            ...metaInfo,
            allArenas: ARENAS,
        });
    } catch {
        return NextResponse.json(
            { error: "アリーナ情報の取得に失敗しました" },
            { status: 500 }
        );
    }
}
