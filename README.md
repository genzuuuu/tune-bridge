# 歌单渡口（Playlist Ferry / tune-bridge）

双向转换 **QQ 音乐 ⇄ Apple Music**。

## 为什么 Apple → QQ 不用 TuneMyMusic？

TuneMyMusic 的目标列表里**没有 QQ 音乐**。本项目对 Apple → QQ 走另一条路：

1. 抓取 Apple Music 歌单（或粘贴文本）
2. 用 QQ 搜索接口匹配 `songmid`
3. 生成导入脚本：在已登录的 [y.qq.com](https://y.qq.com) 控制台运行，自动新建歌单并批量加歌

QQ → Apple 仍可下载 CSV，用 TuneMyMusic 导入 Apple Music。

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3847](http://localhost:3847)。

## 用法

### QQ → Apple Music

1. 粘贴 QQ 歌单链接
2. 下载 CSV
3. [TuneMyMusic](https://www.tunemymusic.com/transfer) → 目标选 Apple Music

### Apple Music → QQ 音乐

1. 切换到 **Apple → QQ**
2. 粘贴可公开访问的 Apple Music 歌单链接
3. 等待 QQ 曲库匹配完成
4. 复制「QQ 导入脚本」
5. 打开并登录 https://y.qq.com ，F12 控制台粘贴运行

## API

```bash
# QQ 歌单
curl "http://localhost:3847/api/qq-playlist?url=https://y.qq.com/n/ryqq_v2/playlist/9807408689"

# Apple Music 歌单
curl "http://localhost:3847/api/apple-playlist?url=https://music.apple.com/us/playlist/.../pl.xxxx"

# 匹配到 QQ
curl -X POST http://localhost:3847/api/match-qq \
  -H 'content-type: application/json' \
  -d '{"songs":[{"name":"晴天","artist":"周杰伦","album":"","searchName":"晴天","searchArtist":"周杰伦","durationMs":0}]}'
```
