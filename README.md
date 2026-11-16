# 歌单渡口（Playlist Ferry）

把 QQ 音乐歌单转成 Apple Music 可导入的 **CSV / TXT / M3U**。

当前默认已转换歌单：[🎧🏝️🍹](https://y.qq.com/n/ryqq_v2/playlist/9807408689)（137 首）。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:3847](http://localhost:3847)。

## 导入 Apple Music

1. 在页面下载 **CSV**（推荐）或 TXT
2. 打开 [TuneMyMusic](https://www.tunemymusic.com/transfer)
3. 来源选 File / CSV，目标选 Apple Music，登录后开始转移

也可直接使用仓库内预生成文件：

- `public/exports/qq-9807408689.csv`
- `public/exports/qq-9807408689.txt`
- `public/exports/qq-9807408689.m3u`

## 转换其他歌单

在页面粘贴 QQ 音乐歌单链接，或调用：

```bash
curl "http://localhost:3847/api/qq-playlist?url=https://y.qq.com/n/ryqq_v2/playlist/9807408689"
```
