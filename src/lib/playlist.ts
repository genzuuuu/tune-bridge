export type Song = {
  name: string;
  artist: string;
  album: string;
  searchName: string;
  searchArtist: string;
  durationMs: number;
  qqMid?: string;
};

export type Playlist = {
  source: string;
  playlistId: string;
  sourceUrl: string;
  title: string;
  author: string;
  songCount: number;
  songs: Song[];
};

export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{5,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:playlist\/|disstid=|id=)(\d{5,})/i);
  return match?.[1] ?? null;
}

export function toCsv(playlist: Playlist): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = [
    ["Name", "Artist", "Album", "Playlist name"].map(escape).join(","),
    ...playlist.songs.map((song) =>
      [song.searchName, song.searchArtist, song.album, playlist.title]
        .map(escape)
        .join(",")
    ),
  ];
  return `\uFEFF${rows.join("\n")}\n`;
}

export function toTxt(playlist: Playlist): string {
  return (
    playlist.songs
      .map((song) => `${song.searchArtist} - ${song.searchName}`)
      .join("\n") + "\n"
  );
}

export function toM3u(playlist: Playlist): string {
  const lines = ["#EXTM3U", `#PLAYLIST:${playlist.title}`];
  for (const song of playlist.songs) {
    const seconds = Math.max(1, Math.round(song.durationMs / 1000));
    lines.push(
      `#EXTINF:${seconds},${song.searchArtist} - ${song.searchName}`
    );
    lines.push(`# ${song.searchArtist} - ${song.searchName}`);
  }
  return `${lines.join("\n")}\n`;
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime: string
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function slugifyFilename(title: string, id: string) {
  const safe = title
    .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return safe || `qq-${id}`;
}
