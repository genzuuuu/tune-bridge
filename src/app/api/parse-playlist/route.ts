import { NextRequest, NextResponse } from "next/server";
import { parseImportedPlaylistText } from "@/lib/parse-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
      title?: string;
      source?: string;
    };
    const playlist = parseImportedPlaylistText(body.text || "", {
      title: body.title,
      source: body.source,
    });
    return NextResponse.json(playlist);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "解析失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
