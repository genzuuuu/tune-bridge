import type { Playlist, Song } from "@/lib/playlist";

type QQSinger = { name?: string };
type QQSong = {
  songname?: string;
  albumname?: string;
  interval?: number;
  songmid?: string;
  singer?: QQSinger[];
};

type QQCd = {
  dissname?: string;
  nickname?: string;
  songlist?: QQSong[];
};

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cleanSearchName(name: string): string {
  return name
    .replace(/\|/g, " - ")
    .replace(/\s*\(Explicit\)\s*$/i, "")
    .trim();
}

function cleanSearchArtist(artist: string): string {
  const cleaned = artist
    .replace(/\s*\([^)]*[\uac00-\ud7a3\u3040-\u30ff\u4e00-\u9fff]+[^)]*\)/g, "")
    .trim();
  return cleaned || artist;
}

function mapSongs(rawSongs: QQSong[]): Song[] {
  return rawSongs.map((song) => {
    const name = decodeHtml(song.songname || "").trim();
    const artist = (song.singer || [])
      .map((item) => decodeHtml(item.name || "").trim())
      .filter(Boolean)
      .join(", ");
    const album = decodeHtml(song.albumname || "").trim();
    return {
      name,
      artist,
      album,
      searchName: cleanSearchName(name),
      searchArtist: cleanSearchArtist(artist),
      durationMs: Math.max(0, Number(song.interval || 0) * 1000),
      qqMid: song.songmid || "",
    };
  });
}

export async function fetchQQPlaylist(playlistId: string): Promise<Playlist> {
  const url = new URL(
    "https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg"
  );
  url.searchParams.set("type", "1");
  url.searchParams.set("json", "1");
  url.searchParams.set("utf8", "1");
  url.searchParams.set("onlysong", "0");
  url.searchParams.set("disstid", playlistId);
  url.searchParams.set("format", "json");

  const response = await fetch(url, {
    headers: {
      Referer: `https://y.qq.com/n/ryqq/playlist/${playlistId}`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`QQ Music API failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    cdlist?: QQCd[];
    code?: number;
  };
  const cd = payload.cdlist?.[0];
  if (!cd) {
    throw new Error("歌单不存在或无法访问（可能是私密歌单）");
  }

  const songs = mapSongs(cd.songlist || []);
  if (songs.length === 0) {
    throw new Error("歌单里没有可导出的歌曲");
  }

  const title = decodeHtml(cd.dissname || `QQ Playlist ${playlistId}`);
  return {
    source: "QQ Music",
    playlistId,
    sourceUrl: `https://y.qq.com/n/ryqq_v2/playlist/${playlistId}`,
    title,
    author: decodeHtml(cd.nickname || ""),
    songCount: songs.length,
    songs,
  };
}
