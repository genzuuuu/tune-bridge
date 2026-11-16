import { NextRequest, NextResponse } from "next/server";
import type { Song } from "@/lib/playlist";
import { matchSongsOnQQ, summarizeMatches } from "@/lib/qq-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { songs?: Song[] };
    const songs = body.songs || [];
    if (!Array.isArray(songs) || songs.length === 0) {
      return NextResponse.json({ error: "缺少歌曲列表" }, { status: 400 });
    }
    // Keep batches small so the request finishes before proxy/browser timeouts.
    if (songs.length > 20) {
      return NextResponse.json(
        { error: "单次最多匹配 20 首，请由前端分批调用" },
        { status: 400 }
      );
    }

    const matches = await matchSongsOnQQ(songs, 6);
    return NextResponse.json({
      summary: summarizeMatches(matches),
      matches,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "匹配 QQ 曲库失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
