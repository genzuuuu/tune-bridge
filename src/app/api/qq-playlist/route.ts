import { NextRequest, NextResponse } from "next/server";
import { extractPlaylistId } from "@/lib/playlist";
import { fetchQQPlaylist } from "@/lib/qq-music";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("url") || "";
  const playlistId = extractPlaylistId(input);

  if (!playlistId) {
    return NextResponse.json(
      { error: "请粘贴 QQ 音乐歌单链接或歌单 ID" },
      { status: 400 }
    );
  }

  try {
    const playlist = await fetchQQPlaylist(playlistId);
    return NextResponse.json(playlist);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "无法读取该歌单";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
