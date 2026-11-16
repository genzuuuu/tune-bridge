import type { Song } from "@/lib/playlist";

export type QQMatchCandidate = {
  name: string;
  artist: string;
  album: string;
  songmid: string;
  songid: number;
  songType: number;
  score: number;
  url: string;
};

export type MatchedTrack = {
  source: Song;
  status: "matched" | "uncertain" | "unmatched";
  match: QQMatchCandidate | null;
  candidates: QQMatchCandidate[];
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/【/g, "[")
    .replace(/】/g, "]")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalize(value).split(" ").filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const item of a) if (b.has(item)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function scoreCandidate(
  source: Song,
  candidate: { name: string; artist: string }
): number {
  const sourceName = normalize(source.searchName || source.name);
  const sourceArtist = normalize(source.searchArtist || source.artist);
  const candName = normalize(candidate.name);
  const candArtist = normalize(candidate.artist);

  const nameExact = sourceName === candName ? 1 : 0;
  const nameScore = nameExact
    ? 1
    : Math.max(
        jaccard(tokenSet(sourceName), tokenSet(candName)),
        sourceName.includes(candName) || candName.includes(sourceName)
          ? 0.72
          : 0
      );
  const artistExact = sourceArtist === candArtist ? 1 : 0;
  const artistScore = artistExact
    ? 1
    : Math.max(
        jaccard(tokenSet(sourceArtist), tokenSet(candArtist)),
        sourceArtist
          .split(/\s*[,/&]\s*/)
          .some((part) => part && candArtist.includes(part))
          ? 0.75
          : 0
      );

  return nameScore * 0.65 + artistScore * 0.35;
}

async function searchQQ(query: string): Promise<QQMatchCandidate[]> {
  const params = new URLSearchParams({
    w: query,
    format: "json",
    p: "1",
    n: "8",
    cr: "1",
    g_tk: "5381",
    loginUin: "0",
    hostUin: "0",
    inCharset: "utf8",
    outCharset: "utf-8",
    notice: "0",
    platform: "yqq.json",
    needNewCode: "0",
    t: "0",
    aggr: "1",
    lossless: "0",
    flag_qc: "0",
    catZhida: "1",
    remoteplace: "txt.yqq.song",
  });

  const response = await fetch(
    `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?${params}`,
    {
      headers: {
        Referer: "https://y.qq.com",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      next: { revalidate: 0 },
    }
  );

  if (!response.ok) return [];
  const payload = (await response.json()) as {
    data?: {
      song?: {
        list?: Array<{
          songname?: string;
          songmid?: string;
          songid?: number;
          albumname?: string;
          singer?: Array<{ name?: string }>;
        }>;
      };
    };
  };

  return (payload.data?.song?.list || [])
    .map((item) => {
      const songmid = item.songmid || "";
      const name = item.songname || "";
      const artist = (item.singer || [])
        .map((singer) => singer.name || "")
        .filter(Boolean)
        .join(", ");
      const raw = item as {
        type?: number;
        songtype?: number;
      };
      return {
        name,
        artist,
        album: item.albumname || "",
        songmid,
        songid: Number(item.songid || 0),
        songType: Number(raw.type ?? raw.songtype ?? 0),
        score: 0,
        url: songmid ? `https://y.qq.com/n/ryqq/songDetail/${songmid}` : "",
      };
    })
    .filter((item) => item.songmid && item.name);
}

export async function matchSongOnQQ(source: Song): Promise<MatchedTrack> {
  // Prefer one query first — extra retries are expensive for large playlists.
  const queries = [
    `${source.searchName} ${source.searchArtist}`.trim(),
    source.searchName,
  ].filter(Boolean);

  const seen = new Set<string>();
  const candidates: QQMatchCandidate[] = [];

  for (const query of queries) {
    const results = await searchQQ(query);
    for (const result of results) {
      if (seen.has(result.songmid)) continue;
      seen.add(result.songmid);
      candidates.push({
        ...result,
        score: scoreCandidate(source, result),
      });
    }
    if (candidates.some((item) => item.score >= 0.82)) break;
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0] || null;
  let status: MatchedTrack["status"] = "unmatched";
  if (top && top.score >= 0.82) status = "matched";
  else if (top && top.score >= 0.55) status = "uncertain";

  return {
    source,
    status,
    match: top,
    candidates: candidates.slice(0, 5),
  };
}

export async function matchSongsOnQQ(
  songs: Song[],
  concurrency = 6
): Promise<MatchedTrack[]> {
  const results: MatchedTrack[] = new Array(songs.length);
  let cursor = 0;

  async function worker() {
    while (cursor < songs.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await matchSongOnQQ(songs[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, songs.length) }, () => worker())
  );
  return results;
}

export function summarizeMatches(matches: MatchedTrack[]): {
  total: number;
  matched: number;
  uncertain: number;
  unmatched: number;
} {
  return {
    total: matches.length,
    matched: matches.filter((item) => item.status === "matched").length,
    uncertain: matches.filter((item) => item.status === "uncertain").length,
    unmatched: matches.filter((item) => item.status === "unmatched").length,
  };
}

export { buildQQImportScript as buildQQImportBookmarklet } from "@/lib/qq-import-script";
