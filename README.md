# 歌单渡口（Playlist Ferry / tune-bridge）

双向转换 **QQ 音乐 ⇄ Apple Music** 歌单，导出可导入的 **CSV / TXT / M3U**。

默认示例歌单：[🎧🏝️🍹](https://y.qq.com/n/ryqq_v2/playlist/9807408689)（137 首，QQ → Apple）。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:3847](http://localhost:3847)。

## 用法

### QQ → Apple Music

1. 粘贴 QQ 音乐歌单链接，或粘贴「歌手 - 歌名」列表 / CSV
2. 下载 CSV（推荐）或 TXT
3. 打开 [TuneMyMusic](https://www.tunemymusic.com/transfer)，来源选 File / CSV，目标选 Apple Music

### Apple Music → QQ

1. 粘贴可公开访问的 Apple Music 歌单链接（`music.apple.com/.../playlist/...`）
2. 若链接无法抓取，可粘贴歌曲列表或 CSV
3. 下载 CSV / TXT，在 TuneMyMusic 目标选 QQ 音乐

## API

```bash
# QQ 歌单
curl "http://localhost:3847/api/qq-playlist?url=https://y.qq.com/n/ryqq_v2/playlist/9807408689"

# Apple Music 歌单
curl "http://localhost:3847/api/apple-playlist?url=https://music.apple.com/us/playlist/.../pl.xxxx"

# 粘贴文本 / CSV
curl -X POST http://localhost:3847/api/parse-playlist \
  -H 'content-type: application/json' \
  -d '{"text":"Taylor Swift - Cruel Summer\n陈奕迅 - 富士山下","source":"Apple Music Text"}'
```

预生成导出文件：

- `public/exports/qq-9807408689.csv`
- `public/exports/qq-9807408689.txt`
- `public/exports/qq-9807408689.m3u`
