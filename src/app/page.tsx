import { PlaylistConverter } from "@/components/playlist-converter";
import type { Playlist } from "@/lib/playlist";
import playlistData from "@/data/playlist.json";

export default function HomePage() {
  const playlist = playlistData as Playlist;

  return (
    <main>
      <PlaylistConverter initialPlaylist={playlist} />
    </main>
  );
}
