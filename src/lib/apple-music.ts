import type { Playlist, Song } from "@/lib/playlist";

type TrackLike = {
  title?: string;
  name?: string;
  artistName?: string;
  duration?: number;
  tertiaryLinks?: Array<{ title?: string }>;
};

function cleanSearchName(name: string): string {
  return name
    .replace(/\|/g, " - ")
    .replace(/\s*\(Explicit\)\s*$/i, "")
    .replace(/\s*\[Explicit\]\s*$/i, "")
    .trim();
}

function cleanSearchArtist(artist: string): string {
  return artist.replace(/\s+feat\.?\s+.+$/i, "").trim() || artist;
}

function collectTracks(node: unknown, out: TrackLike[] = []): TrackLike[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectTracks(item, out);
    return out;
  }

  const record = node as Record<string, unknown>;
  const title =
    typeof record.title === "string"
      ? record.title
      : typeof record.name === "string"
        ? record.name
        : "";
  const artistName =
    typeof record.artistName === "string" ? record.artistName : "";

  if (title && artistName) {
    out.push(record as TrackLike);
  }

  for (const value of Object.values(record)) {
    collectTracks(value, out);
  }
  return out;
}

function parseDurationMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10000 ? Math.round(value) : Math.round(value * 1000);
  }
  if (typeof value === "string") {
    const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
    if (match) {
      const hours = Number(match[1] || 0);
      const minutes = Number(match[2] || 0);
      const seconds = Number(match[3] || 0);
      return ((hours * 60 + minutes) * 60 + seconds) * 1000;
    }
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return parseDurationMs(asNumber);
  }
  return 0;
}

function extractPlaylistId(url: string): string {
  const match = url.match(/\/(pl\.[a-zA-Z0-9]+)/);
  return match?.[1] || url;
}

export function extractApplePlaylistRef(input: string): string | null {
  const trimmed = input.trim();
  // Catalog: pl.xxxx / User library: pl.u-xxxx
  if (/^pl\.(?:u-)?[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return `https://music.apple.com/us/playlist/${trimmed}`;
  }
  if (/music\.apple\.com\/[^/]+\/playlist\//i.test(trimmed)) {
    return trimmed.split("?")[0];
  }
  // Some share links omit the slug: /playlist/pl.u-xxxx
  if (/music\.apple\.com\/[^/]+\/playlist\/pl\./i.test(trimmed)) {
    return trimmed.split("?")[0];
  }
  return null;
}

export async function fetchApplePlaylist(input: string): Promise<Playlist> {
  const sourceUrl = extractApplePlaylistRef(input);
  if (!sourceUrl) {
    throw new Error("请粘贴 Apple Music 歌单链接（music.apple.com/.../playlist/...）");
  }

  const isUserLibrary = /\/playlist\/pl\.u-/i.test(sourceUrl);

  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    if (isUserLibrary || response.status === 404) {
      throw new Error(
        "无法抓取该 Apple Music 链接（个人库歌单 pl.u- 或私密歌单通常打不开）。请把歌单设为「公开」后重试，或直接把「歌手 - 歌名」列表粘贴到下方文本框。"
      );
    }
    throw new Error(`无法打开 Apple Music 歌单（HTTP ${response.status}）`);
  }

  const html = await response.text();
  const serialized = html.match(
    /<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (!serialized) {
    throw new Error("未能解析 Apple Music 页面，请确认链接可公开访问");
  }

  const payload = JSON.parse(serialized[1]) as unknown;
  const tracks = collectTracks(payload);
  const unique = new Map<string, Song>();

  for (const track of tracks) {
    const name = (track.title || track.name || "").trim();
    const artist = (track.artistName || "").trim();
    if (!name || !artist) continue;
    const album = track.tertiaryLinks?.[0]?.title?.trim() || "";
    const key = `${name.toLowerCase()}::${artist.toLowerCase()}`;
    if (unique.has(key)) continue;
    unique.set(key, {
      name,
      artist,
      album,
      searchName: cleanSearchName(name),
      searchArtist: cleanSearchArtist(artist),
      durationMs: parseDurationMs(track.duration),
    });
  }

  const songs = [...unique.values()];
  if (songs.length === 0) {
    throw new Error("歌单里没有可导出的歌曲（可能是私密歌单）");
  }

  let title = "Apple Music Playlist";
  let author = "";
  const ldMatch = html.match(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]) as {
        name?: string;
        author?: { name?: string };
      };
      if (ld.name) title = ld.name;
      if (ld.author?.name) author = ld.author.name;
    } catch {
      // ignore malformed ld+json
    }
  }

  const playlistId = extractPlaylistId(sourceUrl);
  return {
    source: "Apple Music",
    playlistId,
    sourceUrl,
    title,
    author,
    songCount: songs.length,
    songs,
  };
}
