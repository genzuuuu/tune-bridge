import { NextRequest, NextResponse } from "next/server";
import type { Song } from "@/lib/playlist";
import { matchSongsOnQQ } from "@/lib/qq-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { songs?: Song[] };
    const songs = body.songs || [];
    if (!Array.isArray(songs) || songs.length === 0) {
      return NextResponse.json({ error: "缺少歌曲列表" }, { status: 400 });
    }
    if (songs.length > 300) {
      return NextResponse.json(
        { error: "一次最多匹配 300 首，请拆分后重试" },
        { status: 400 }
      );
    }

    const matches = await matchSongsOnQQ(songs);
    const summary = {
      total: matches.length,
      matched: matches.filter((item) => item.status === "matched").length,
      uncertain: matches.filter((item) => item.status === "uncertain").length,
      unmatched: matches.filter((item) => item.status === "unmatched").length,
    };

    return NextResponse.json({ summary, matches });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "匹配 QQ 曲库失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
