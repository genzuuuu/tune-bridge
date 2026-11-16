import { NextRequest, NextResponse } from "next/server";
import { fetchApplePlaylist } from "@/lib/apple-music";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("url") || "";

  try {
    const playlist = await fetchApplePlaylist(input);
    return NextResponse.json(playlist);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "无法读取 Apple Music 歌单";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
