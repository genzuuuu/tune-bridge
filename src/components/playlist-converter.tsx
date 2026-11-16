"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRight, Download, Link2, Loader2, Music2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  downloadTextFile,
  slugifyFilename,
  toCsv,
  toM3u,
  toTxt,
  type Playlist,
} from "@/lib/playlist";

type Props = {
  initialPlaylist: Playlist;
};

function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function PlaylistConverter({ initialPlaylist }: Props) {
  const [url, setUrl] = useState(initialPlaylist.sourceUrl);
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filenameBase = useMemo(
    () => slugifyFilename(playlist.title, playlist.playlistId),
    [playlist.playlistId, playlist.title]
  );

  function convert() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/qq-playlist?url=${encodeURIComponent(url.trim())}`
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "转换失败");
        }
        setPlaylist(payload as Playlist);
      } catch (err) {
        setError(err instanceof Error ? err.message : "转换失败");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-20 pt-8 md:px-8 md:pt-12">
      <section className="hero-panel relative overflow-hidden rounded-[2rem] px-6 py-10 md:px-12 md:py-14">
        <div className="hero-glow" aria-hidden />
        <div className="relative z-10 max-w-2xl">
          <p className="brand-mark animate-rise">歌单渡口</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-[var(--ink)] md:text-6xl animate-rise-delay">
            QQ 音乐歌单，
            <span className="text-[var(--accent)]">一键渡到</span>
            Apple Music
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-soft)] md:text-lg animate-rise-delay-2">
            已为你准备好「{initialPlaylist.title}」的可导入文件。下载
            CSV / TXT，用 TuneMyMusic 导入 Apple Music 即可。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row animate-rise-delay-3">
            <Button
              size="lg"
              className="h-12 rounded-xl bg-[var(--accent)] px-6 text-base text-white hover:bg-[var(--accent-deep)]"
              onClick={() =>
                downloadTextFile(
                  `${filenameBase}.csv`,
                  toCsv(playlist),
                  "text/csv;charset=utf-8"
                )
              }
            >
              <Download />
              下载 CSV（推荐）
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-xl border-[var(--line)] bg-white/70 px-6 text-base backdrop-blur"
              onClick={() =>
                downloadTextFile(
                  `${filenameBase}.txt`,
                  toTxt(playlist),
                  "text/plain;charset=utf-8"
                )
              }
            >
              下载 TXT
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel rounded-[1.5rem] p-6 md:p-8">
          <div className="flex items-center gap-2">
            <Music2 className="size-5 text-[var(--accent)]" />
            <h2 className="font-display text-2xl text-[var(--ink)]">
              {playlist.title}
            </h2>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--ink-soft)]">
            <span>{playlist.author || "未知创建者"}</span>
            <span aria-hidden>·</span>
            <Badge variant="secondary" className="rounded-md">
              {playlist.songCount} 首
            </Badge>
            <Badge variant="outline" className="rounded-md">
              QQ Music → Apple Music
            </Badge>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="粘贴其他 QQ 音乐歌单链接"
              className="h-11 rounded-xl border-[var(--line)] bg-white/80"
              onKeyDown={(event) => {
                if (event.key === "Enter") convert();
              }}
            />
            <Button
              onClick={convert}
              disabled={isPending || !url.trim()}
              className="h-11 shrink-0 rounded-xl bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90"
            >
              {isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
              重新转换
            </Button>
          </div>
          {error ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 max-h-[28rem] overflow-auto rounded-2xl border border-[var(--line)] bg-white/55">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[var(--panel-strong)] text-[var(--ink-soft)]">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">歌曲</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    歌手
                  </th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    时长
                  </th>
                </tr>
              </thead>
              <tbody>
                {playlist.songs.map((song, index) => (
                  <tr
                    key={`${song.qqMid || song.name}-${index}`}
                    className="border-t border-[var(--line)]/70"
                  >
                    <td className="px-4 py-3 tabular-nums text-[var(--ink-soft)]">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--ink)]">
                        {song.searchName}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--ink-soft)] sm:hidden">
                        {song.searchArtist}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--ink-soft)] sm:table-cell">
                      {song.searchArtist}
                    </td>
                    <td className="hidden px-4 py-3 tabular-nums text-[var(--ink-soft)] md:table-cell">
                      {formatDuration(song.durationMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="rounded-xl border-[var(--line)]"
              onClick={() =>
                downloadTextFile(
                  `${filenameBase}.csv`,
                  toCsv(playlist),
                  "text/csv;charset=utf-8"
                )
              }
            >
              <Download /> CSV
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-[var(--line)]"
              onClick={() =>
                downloadTextFile(
                  `${filenameBase}.txt`,
                  toTxt(playlist),
                  "text/plain;charset=utf-8"
                )
              }
            >
              <Download /> TXT
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-[var(--line)]"
              onClick={() =>
                downloadTextFile(
                  `${filenameBase}.m3u`,
                  toM3u(playlist),
                  "audio/x-mpegurl"
                )
              }
            >
              <Download /> M3U
            </Button>
          </div>
        </div>

        <aside className="panel rounded-[1.5rem] p-6 md:p-8">
          <h2 className="font-display text-2xl text-[var(--ink)]">
            导入 Apple Music
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
            Apple Music 本身不直接吃 QQ 歌单。最快路径是用
            TuneMyMusic 把下面的文件转进去。
          </p>
          <ol className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--ink)]">
            <li className="flex gap-3">
              <span className="step">1</span>
              <span>
                下载本页的 <strong>CSV</strong>（推荐）或 TXT。
              </span>
            </li>
            <li className="flex gap-3">
              <span className="step">2</span>
              <span>
                打开{" "}
                <a
                  className="font-medium text-[var(--accent-deep)] underline underline-offset-2"
                  href="https://www.tunemymusic.com/transfer"
                  target="_blank"
                  rel="noreferrer"
                >
                  TuneMyMusic
                </a>
                ，来源选 File / CSV，目标选 Apple Music。
              </span>
            </li>
            <li className="flex gap-3">
              <span className="step">3</span>
              <span>
                登录 Apple 账号后开始转移。曲库覆盖不到的歌会跳过，可稍后手动搜索补齐。
              </span>
            </li>
          </ol>

          <div className="mt-8 rounded-2xl border border-dashed border-[var(--line)] bg-white/50 p-4 text-sm text-[var(--ink-soft)]">
            <div className="flex items-center gap-2 font-medium text-[var(--ink)]">
              <ArrowRight className="size-4 text-[var(--accent)]" />
              匹配提示
            </div>
            <p className="mt-2 leading-relaxed">
              导出时已去掉 Explicit 标记，并尽量保留歌手原名，方便 Apple Music
              自动匹配。中文歌、现场版、原声带偶发对不上时，用歌名手动搜一次即可。
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
