# PopChart Compare

PopChart Compare 是一个欧美流行单曲榜单走势对比器。当前主线是 Billboard Hot 100，同时保留 Spotify Global / US Top 200 的官方 CSV 数据扩展能力。

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Recharts
- dayjs
- fuse.js
- 本地 JSON / CSV 静态数据，不接数据库

## Run Locally

```bash
npm install
npm.cmd run dev
```

打开：

```text
http://localhost:3000
```

生产构建：

```bash
npm.cmd run build
```

## Billboard Data

下载 Billboard Hot 100 原始数据：

```text
https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/all.json
```

保存到：

```text
data/raw/billboard/all.json
```

生成 Billboard catalog 和公开数据：

```bash
python scripts/build_billboard_catalog.py
python scripts/build_all.py
```

Billboard 相对时间默认基于 chart debut。如果歌曲没有明确发行日，`Week 1` 表示第一次进入 Hot 100 的榜周。

## Spotify Data

Spotify 是并行扩展数据源。当前使用 Spotify Charts 官方 CSV / Charts API 抓取后的本地文件，不接 Spotify Web API。

批量下载一段时间：

```bash
npm.cmd run spotify:download:range -- --start 2024-04-01 --end 2024-04-30 --regions global,us --chunk-days 7 --login-first
```

清洗并生成公开数据：

```bash
python scripts/build_spotify_catalog.py
python scripts/build_all.py
```

注意：不要把终端 sniff 输出里的 `Authorization: Bearer ...` 发给别人，那是临时登录凭证。

## Daily Spotify Update

每日自动更新采用“稳定快照”方案：

```text
定时任务下载最新 Spotify CSV
→ 重新生成 processed/public 数据
→ npm run build 校验
→ 成功后提交 public/data
→ Vercel 部署新版本
```

线上用户始终读取上一版已经部署好的静态数据。即使后台下载很慢、429、登录失效或构建失败，线上网站也不会崩，只是继续显示旧数据。

本地手动更新最新缺失日期：

```bash
npm.cmd run spotify:update:latest -- --regions global,us --lag-days 2 --login-first --verify-build
```

之后日常可以使用已保存的登录态：

```bash
npm.cmd run spotify:update:latest -- --regions global,us --lag-days 2 --headless --verify-build
```

如果要从指定日期补数据：

```bash
npm.cmd run spotify:update:latest -- --start 2025-09-24 --end 2025-09-30 --regions global,us --login-first --verify-build
```

`scripts/build_all.py` 会生成：

```text
public/data/manifest.json
```

里面记录数据生成时间和各平台最新日期，方便前端展示“数据更新至哪天”。

## GitHub Actions Automation

项目已包含：

```text
.github/workflows/update-spotify.yml
```

它每天运行一次，也可以手动触发。因为 Spotify Charts 需要登录态，需要先把本地 `.spotify-charts-profile` 导出为 GitHub Secret：

1. 先在本地成功运行一次带登录的下载命令。
2. 确认项目根目录存在 `.spotify-charts-profile/`。
3. 压缩这个文件夹为 zip。
4. 把 zip 的 base64 内容保存为 GitHub Secret：

```text
SPOTIFY_CHARTS_PROFILE_ZIP_B64
```

PowerShell 示例：

```powershell
Compress-Archive -Path .spotify-charts-profile -DestinationPath spotify-profile.zip -Force
[Convert]::ToBase64String([IO.File]::ReadAllBytes("spotify-profile.zip")) | Set-Clipboard
```

然后到 GitHub 仓库：

```text
Settings → Secrets and variables → Actions → New repository secret
```

粘贴剪贴板内容即可。

## Deploy

推荐部署方式：

1. 把项目推到 GitHub。
2. 用 Vercel 连接 GitHub 仓库。
3. Vercel Build Command 使用：

```bash
npm run build
```

4. 每次 GitHub Actions 成功提交新的 `public/data` 后，Vercel 会自动部署新版本。

这个流程的稳定性来自两点：

- 网站只读静态快照，不在用户访问时抓数据。
- 新数据只有在下载、清洗、构建全部成功后才会进入下一次部署。

## Covers

封面优先级：

1. `cover_url`
2. 本地 `public/covers/{work_id}.jpg`
3. 渐变占位封面

批量用 iTunes Search 补封面：

```bash
python scripts/fetch_covers_itunes.py --source catalog --sort popular --limit 200 --sleep 0.2 --save-every 25
python scripts/build_all.py
```

也可以手动维护：

```text
data/manual/covers.csv
```

字段：

```text
work_id,cover_url,album_name,spotify_id,spotify_url,release_date,release_date_source
```

## AI Chart Analyst

页面支持 AI 走势点评：

- 谁开局强
- 谁后劲强
- 谁更像 viral
- 谁更像粉丝盘
- 一句网感总结

复制示例配置：

```bash
copy .env.local.example .env.local
```

API key 只放在 `.env.local` 或部署平台的环境变量里，不要写进前端代码。没有配置 key 时，页面会退回本地规则分析，不会崩溃。

## Current Limits

- 当前版本聚焦单曲，不支持专辑走势。
- 不支持完整跨平台流媒体分布。
- Spotify 覆盖范围取决于本地下载了哪些官方 CSV。
- Billboard catalog 的 `release_date` 暂时使用 `first_chart_date` 兜底。
- 封面抓取可能有少量匹配误差，可在 `data/manual/covers.csv` 手动修正。

## Roadmap

- Artist Compare
- Billboard #1 Explorer
- Spotify Streaming Distribution
- Album trajectory comparison
