"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  Copy,
  Download,
  Link2,
  Loader2,
  Music2,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  detectInputKind,
  downloadTextFile,
  slugifyFilename,
  toCsv,
  toM3u,
  toTxt,
  type ConvertDirection,
  type Playlist,
} from "@/lib/playlist";
import {
  buildQQImportBookmarklet,
  type MatchedTrack,
} from "@/lib/qq-search";

type Props = {
  initialPlaylist: Playlist;
};

type MatchSummary = {
  total: number;
  matched: number;
  uncertain: number;
  unmatched: number;
};

function formatDuration(ms: number) {
  if (!ms) return "—";
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function PlaylistConverter({ initialPlaylist }: Props) {
  const [direction, setDirection] =
    useState<ConvertDirection>("qq-to-apple");
  const [url, setUrl] = useState(initialPlaylist.sourceUrl);
  const [pasteText, setPasteText] = useState("");
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [matches, setMatches] = useState<MatchedTrack[] | null>(null);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isMatching, startMatching] = useTransition();

  const filenameBase = useMemo(
    () => slugifyFilename(playlist.title, playlist.playlistId),
    [playlist.playlistId, playlist.title]
  );

  const goingToApple = direction === "qq-to-apple";
  const sourceLabel = goingToApple ? "QQ 音乐" : "Apple Music";
  const targetLabel = goingToApple ? "Apple Music" : "QQ 音乐";
  const directionBadge = `${sourceLabel} → ${targetLabel}`;

  const selectedMids = useMemo(
    () =>
      (matches || [])
        .filter((item) => item.status !== "unmatched" && item.match?.songmid)
        .map((item) => item.match!.songmid),
    [matches]
  );

  const importScript = useMemo(
    () =>
      buildQQImportBookmarklet({
        title: playlist.title || "从 Apple Music 导入",
        songmids: selectedMids,
      }),
    [playlist.title, selectedMids]
  );

  function switchDirection(next: ConvertDirection) {
    setDirection(next);
    setError(null);
    setNotice(null);
    setMatches(null);
    setSummary(null);
    if (next === "qq-to-apple") {
      setUrl(initialPlaylist.sourceUrl);
      setPlaylist(initialPlaylist);
      setPasteText("");
    } else {
      setUrl("");
      setPasteText("");
    }
  }

  function convert() {
    setError(null);
    setNotice(null);
    setMatches(null);
    setSummary(null);
    startTransition(async () => {
      try {
        const trimmedUrl = url.trim();
        const trimmedPaste = pasteText.trim();

        if (!trimmedUrl && !trimmedPaste) {
          throw new Error(
            goingToApple
              ? "请粘贴 QQ 音乐歌单链接，或粘贴歌曲列表"
              : "请粘贴 Apple Music 歌单链接，或粘贴歌曲列表"
          );
        }

        let payload: Playlist;

        if (trimmedPaste && !trimmedUrl) {
          const response = await fetch("/api/parse-playlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: trimmedPaste,
              source: goingToApple ? "QQ Music Text" : "Apple Music Text",
              title: goingToApple
                ? "导入的 QQ 歌单"
                : "导入的 Apple Music 歌单",
            }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "解析失败");
          payload = body as Playlist;
        } else {
          const kind = detectInputKind(trimmedUrl);
          if (goingToApple) {
            if (kind === "apple") {
              throw new Error(
                "当前方向是 QQ → Apple。请粘贴 QQ 音乐链接，或切换到 Apple → QQ"
              );
            }
            if (kind === "text") {
              const response = await fetch("/api/parse-playlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text: trimmedUrl,
                  source: "QQ Music Text",
                  title: "导入的 QQ 歌单",
                }),
              });
              const body = await response.json();
              if (!response.ok) throw new Error(body.error || "解析失败");
              payload = body as Playlist;
            } else if (kind === "qq") {
              const response = await fetch(
                `/api/qq-playlist?url=${encodeURIComponent(trimmedUrl)}`
              );
              const body = await response.json();
              if (!response.ok) throw new Error(body.error || "转换失败");
              payload = body as Playlist;
            } else {
              throw new Error("无法识别 QQ 音乐歌单链接");
            }
          } else if (kind === "qq") {
            throw new Error(
              "当前方向是 Apple → QQ。请粘贴 Apple Music 链接，或切换到 QQ → Apple"
            );
          } else if (kind === "apple") {
            const response = await fetch(
              `/api/apple-playlist?url=${encodeURIComponent(trimmedUrl)}`
            );
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || "转换失败");
            payload = body as Playlist;
          } else {
            const response = await fetch("/api/parse-playlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: trimmedUrl.includes("\n")
                  ? trimmedUrl
                  : trimmedPaste || trimmedUrl,
                source: "Apple Music Text",
                title: "导入的 Apple Music 歌单",
              }),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || "解析失败");
            payload = body as Playlist;
          }
        }

        setPlaylist(payload);
        if (!goingToApple) {
          await runMatch(payload);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "转换失败");
      }
    });
  }

  async function runMatch(target: Playlist = playlist) {
    setError(null);
    setNotice(null);
    startMatching(async () => {
      try {
        const response = await fetch("/api/match-qq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songs: target.songs }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "匹配失败");
        setMatches(body.matches as MatchedTrack[]);
        setSummary(body.summary as MatchSummary);
        setNotice(
          `已在 QQ 曲库匹配：成功 ${body.summary.matched}，存疑 ${body.summary.uncertain}，未匹配 ${body.summary.unmatched}`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "匹配失败");
      }
    });
  }

  async function copyImportScript() {
    if (selectedMids.length === 0) {
      setError("没有可导入的匹配歌曲，请先完成匹配");
      return;
    }
    await navigator.clipboard.writeText(importScript);
    setNotice(
      `已复制导入脚本（${selectedMids.length} 首）。打开并登录 y.qq.com 后，按 F12 粘贴到控制台运行。`
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-20 pt-8 md:px-8 md:pt-12">
      <section className="hero-panel relative overflow-hidden rounded-[2rem] px-6 py-10 md:px-12 md:py-14">
        <div className="hero-glow" aria-hidden />
        <div className="relative z-10 max-w-2xl">
          <p className="brand-mark animate-rise">歌单渡口</p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-[var(--ink)] md:text-6xl animate-rise-delay">
            {sourceLabel}
            <span className="text-[var(--accent)]"> 一键渡到 </span>
            {targetLabel}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-soft)] md:text-lg animate-rise-delay-2">
            {goingToApple
              ? "QQ → Apple 仍可下载 CSV，用 TuneMyMusic 导入。"
              : "TuneMyMusic 没有 QQ 音乐目标。Apple → QQ 会先匹配 QQ 曲库，再生成可在 y.qq.com 登录后一键建歌单的导入脚本。"}
          </p>

          <div className="mt-6 inline-flex rounded-2xl border border-[var(--line)] bg-white/70 p-1 backdrop-blur animate-rise-delay-2">
            <button
              type="button"
              onClick={() => switchDirection("qq-to-apple")}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                goingToApple
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              QQ → Apple
            </button>
            <button
              type="button"
              onClick={() => switchDirection("apple-to-qq")}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                !goingToApple
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              Apple → QQ
            </button>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row animate-rise-delay-3">
            {goingToApple ? (
              <>
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
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  className="h-12 rounded-xl bg-[var(--accent)] px-6 text-base text-white hover:bg-[var(--accent-deep)]"
                  onClick={copyImportScript}
                  disabled={selectedMids.length === 0}
                >
                  <Copy />
                  复制 QQ 导入脚本
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-xl border-[var(--line)] bg-white/70 px-6 text-base backdrop-blur"
                  onClick={() => runMatch()}
                  disabled={isMatching || playlist.songs.length === 0}
                >
                  {isMatching ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Search />
                  )}
                  重新匹配 QQ 曲库
                </Button>
              </>
            )}
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
            <span>{playlist.author || playlist.source || "未命名来源"}</span>
            <span aria-hidden>·</span>
            <Badge variant="secondary" className="rounded-md">
              {playlist.songCount} 首
            </Badge>
            <Badge variant="outline" className="rounded-md">
              {directionBadge}
            </Badge>
            {summary ? (
              <Badge variant="outline" className="rounded-md">
                可导入 {selectedMids.length}
              </Badge>
            ) : null}
          </div>

          <div className="mt-6 space-y-3">
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={
                goingToApple
                  ? "粘贴 QQ 音乐歌单链接"
                  : "粘贴 Apple Music 歌单链接（music.apple.com/.../playlist/...）"
              }
              className="h-11 rounded-xl border-[var(--line)] bg-white/80"
              onKeyDown={(event) => {
                if (event.key === "Enter") convert();
              }}
            />
            <Textarea
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder={
                "也可以粘贴歌曲列表：\n歌手 - 歌名\n或带 Name,Artist,Album 表头的 CSV"
              }
              className="min-h-[110px] rounded-xl border-[var(--line)] bg-white/80"
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={convert}
                disabled={
                  isPending ||
                  isMatching ||
                  (!url.trim() && !pasteText.trim())
                }
                className="h-11 shrink-0 rounded-xl bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90"
              >
                {isPending || isMatching ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowLeftRight />
                )}
                {goingToApple ? "开始转换" : "抓取并匹配到 QQ"}
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-xl border-[var(--line)]"
                onClick={() => {
                  setUrl(goingToApple ? initialPlaylist.sourceUrl : "");
                  setPasteText("");
                  setError(null);
                  setNotice(null);
                  setMatches(null);
                  setSummary(null);
                  if (goingToApple) setPlaylist(initialPlaylist);
                }}
              >
                <Link2 />
                重置输入
              </Button>
            </div>
          </div>
          {error ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mt-3 text-sm text-[var(--accent-deep)]" role="status">
              {notice}
            </p>
          ) : null}

          <div className="mt-6 max-h-[28rem] overflow-auto rounded-2xl border border-[var(--line)] bg-white/55">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[var(--panel-strong)] text-[var(--ink-soft)]">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">
                    {goingToApple ? "歌曲" : "原曲 / QQ 匹配"}
                  </th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    {goingToApple ? "歌手" : "状态"}
                  </th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    {goingToApple ? "时长" : "打开"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {playlist.songs.map((song, index) => {
                  const match = matches?.[index] || null;
                  return (
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
                        <div className="mt-0.5 text-xs text-[var(--ink-soft)]">
                          {song.searchArtist}
                        </div>
                        {!goingToApple && match?.match ? (
                          <div className="mt-1 text-xs text-[var(--accent-deep)]">
                            → {match.match.name} / {match.match.artist}
                          </div>
                        ) : null}
                      </td>
                      <td className="hidden px-4 py-3 text-[var(--ink-soft)] sm:table-cell">
                        {goingToApple ? (
                          song.searchArtist
                        ) : match ? (
                          <span>
                            {match.status === "matched"
                              ? "已匹配"
                              : match.status === "uncertain"
                                ? "存疑"
                                : "未匹配"}
                            {match.match
                              ? ` · ${Math.round(match.match.score * 100)}%`
                              : ""}
                          </span>
                        ) : (
                          "待匹配"
                        )}
                      </td>
                      <td className="hidden px-4 py-3 tabular-nums text-[var(--ink-soft)] md:table-cell">
                        {goingToApple ? (
                          formatDuration(song.durationMs)
                        ) : match?.match?.url ? (
                          <a
                            href={match.match.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--accent-deep)] underline underline-offset-2"
                          >
                            QQ
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {goingToApple ? (
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
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="rounded-xl border-[var(--line)]"
                onClick={copyImportScript}
                disabled={selectedMids.length === 0}
              >
                <Copy /> 复制导入脚本
              </Button>
              <Button
                variant="outline"
                className="rounded-xl border-[var(--line)]"
                onClick={() =>
                  downloadTextFile(
                    `${filenameBase}-qq-import.js`,
                    `${importScript}\n`,
                    "text/javascript;charset=utf-8"
                  )
                }
                disabled={selectedMids.length === 0}
              >
                <Download /> 下载脚本
              </Button>
            </div>
          )}
        </div>

        <aside className="panel rounded-[1.5rem] p-6 md:p-8">
          <h2 className="font-display text-2xl text-[var(--ink)]">
            {goingToApple ? "导入 Apple Music" : "导入 QQ 音乐"}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
            {goingToApple
              ? "Apple Music 不直接吃 QQ 歌单。用 TuneMyMusic：来源选 File/CSV，目标选 Apple Music。"
              : "TuneMyMusic / Soundiiz 通常没有 QQ 音乐作为目标。正确做法是：先匹配 QQ 曲库得到 songmid，再在已登录的 y.qq.com 上运行导入脚本创建歌单。"}
          </p>
          <ol className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--ink)]">
            {goingToApple ? (
              <>
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
                  <span>登录 Apple 账号后开始转移。</span>
                </li>
              </>
            ) : (
              <>
                <li className="flex gap-3">
                  <span className="step">1</span>
                  <span>粘贴 Apple Music 歌单链接，点击「抓取并匹配到 QQ」。</span>
                </li>
                <li className="flex gap-3">
                  <span className="step">2</span>
                  <span>
                    检查匹配结果。点「复制 QQ 导入脚本」（含已匹配 + 存疑曲目）。
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="step">3</span>
                  <span>
                    打开并登录{" "}
                    <a
                      className="font-medium text-[var(--accent-deep)] underline underline-offset-2"
                      href="https://y.qq.com"
                      target="_blank"
                      rel="noreferrer"
                    >
                      y.qq.com
                    </a>
                    ，按 F12 打开控制台，粘贴脚本回车。脚本会新建歌单并批量加歌。
                  </span>
                </li>
              </>
            )}
          </ol>

          <div className="mt-8 rounded-2xl border border-dashed border-[var(--line)] bg-white/50 p-4 text-sm text-[var(--ink-soft)]">
            <div className="flex items-center gap-2 font-medium text-[var(--ink)]">
              {goingToApple ? (
                <ArrowRight className="size-4 text-[var(--accent)]" />
              ) : (
                <Check className="size-4 text-[var(--accent)]" />
              )}
              {goingToApple ? "Apple 匹配提示" : "为什么不用 TuneMyMusic？"}
            </div>
            <p className="mt-2 leading-relaxed">
              {goingToApple
                ? "导出时已去掉 Explicit 标记，方便 Apple Music 自动匹配。"
                : "TuneMyMusic 目标列表里没有 QQ 音乐。本工具改为直接对接 QQ 搜索接口匹配 songmid，再用你网页端登录态写入歌单。"}
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
