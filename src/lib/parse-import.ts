import type { Playlist, Song } from "@/lib/playlist";

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

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function songFromParts(
  name: string,
  artist: string,
  album = ""
): Song | null {
  const cleanName = name.trim();
  const cleanArtist = artist.trim();
  if (!cleanName || !cleanArtist) return null;
  return {
    name: cleanName,
    artist: cleanArtist,
    album: album.trim(),
    searchName: cleanSearchName(cleanName),
    searchArtist: cleanSearchArtist(cleanArtist),
    durationMs: 0,
  };
}

function parseArtistTitleLine(line: string): Song | null {
  const cleaned = line.trim();
  if (!cleaned) return null;
  const separators = [" — ", " – ", " - ", "｜", "|"];
  for (const separator of separators) {
    const index = cleaned.indexOf(separator);
    if (index > 0) {
      return songFromParts(
        cleaned.slice(index + separator.length),
        cleaned.slice(0, index)
      );
    }
  }
  return null;
}

export function parseImportedPlaylistText(
  text: string,
  options?: { title?: string; source?: string }
): Playlist {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("请粘贴歌曲列表或 CSV 内容");
  }

  const songs: Song[] = [];
  const headerCells = splitCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const looksLikeCsv =
    lines[0].includes(",") &&
    (headerCells.includes("name") ||
      headerCells.includes("title") ||
      headerCells.includes("track name") ||
      headerCells.includes("song") ||
      headerCells.includes("artist") ||
      headerCells.includes("artist name"));

  if (looksLikeCsv) {
    const nameIdx = headerCells.findIndex((cell) =>
      ["name", "title", "track name", "song", "track"].includes(cell)
    );
    const artistIdx = headerCells.findIndex((cell) =>
      ["artist", "artist name", "artists"].includes(cell)
    );
    const albumIdx = headerCells.findIndex((cell) =>
      ["album", "album name"].includes(cell)
    );

    for (const line of lines.slice(1)) {
      const cells = splitCsvLine(line);
      const name = nameIdx >= 0 ? cells[nameIdx] : cells[0];
      const artist = artistIdx >= 0 ? cells[artistIdx] : cells[1];
      const album = albumIdx >= 0 ? cells[albumIdx] : cells[2] || "";
      const song = songFromParts(name || "", artist || "", album || "");
      if (song) songs.push(song);
    }
  } else {
    for (const line of lines) {
      const song = parseArtistTitleLine(line);
      if (song) songs.push(song);
    }
  }

  if (songs.length === 0) {
    throw new Error(
      "没有识别到歌曲。请使用「歌手 - 歌名」或带 Name/Artist 表头的 CSV"
    );
  }

  const source = options?.source || "Imported Text";
  const title = options?.title || `${source} Playlist`;
  return {
    source,
    playlistId: `import-${Date.now()}`,
    sourceUrl: "",
    title,
    author: "",
    songCount: songs.length,
    songs,
  };
}
