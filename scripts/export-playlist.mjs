#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const playlistId = process.argv[2] || "9807408689";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function decodeHtml(value) {
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

function cleanSearchName(name) {
  return name
    .replace(/\|/g, " - ")
    .replace(/\s*\(Explicit\)\s*$/i, "")
    .trim();
}

function cleanSearchArtist(artist) {
  const cleaned = artist
    .replace(/\s*\([^)]*[\uac00-\ud7a3\u3040-\u30ff\u4e00-\u9fff]+[^)]*\)/g, "")
    .trim();
  return cleaned || artist;
}

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
});

if (!response.ok) {
  throw new Error(`QQ Music API failed with ${response.status}`);
}

const payload = await response.json();
const cd = payload.cdlist?.[0];
if (!cd) throw new Error("Playlist not found");

const songs = (cd.songlist || []).map((song) => {
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

const playlist = {
  source: "QQ Music",
  playlistId,
  sourceUrl: `https://y.qq.com/n/ryqq_v2/playlist/${playlistId}`,
  title: decodeHtml(cd.dissname || `QQ Playlist ${playlistId}`),
  author: decodeHtml(cd.nickname || ""),
  songCount: songs.length,
  songs,
};

const escape = (value) => `"${String(value).replace(/"/g, '""')}"`;
const csv = [
  ["Name", "Artist", "Album", "Playlist name"].map(escape).join(","),
  ...songs.map((song) =>
    [song.searchName, song.searchArtist, song.album, playlist.title]
      .map(escape)
      .join(",")
  ),
].join("\n");

const txt = songs
  .map((song) => `${song.searchArtist} - ${song.searchName}`)
  .join("\n");

const m3u = [
  "#EXTM3U",
  `#PLAYLIST:${playlist.title}`,
  ...songs.flatMap((song) => {
    const seconds = Math.max(1, Math.round(song.durationMs / 1000));
    return [
      `#EXTINF:${seconds},${song.searchArtist} - ${song.searchName}`,
      `# ${song.searchArtist} - ${song.searchName}`,
    ];
  }),
].join("\n");

mkdirSync(join(root, "src/data"), { recursive: true });
mkdirSync(join(root, "public/exports"), { recursive: true });
writeFileSync(
  join(root, "src/data/playlist.json"),
  `${JSON.stringify(playlist, null, 2)}\n`
);
writeFileSync(
  join(root, "public/exports", `qq-${playlistId}.csv`),
  `\uFEFF${csv}\n`
);
writeFileSync(join(root, "public/exports", `qq-${playlistId}.txt`), `${txt}\n`);
writeFileSync(join(root, "public/exports", `qq-${playlistId}.m3u`), `${m3u}\n`);

console.log(`Exported ${songs.length} songs from ${playlist.title}`);
