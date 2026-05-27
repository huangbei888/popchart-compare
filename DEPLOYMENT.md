# Public Deployment Guide

这份文档用于把 PopChart Compare 从本地 MVP 推到公开可访问的网站。

## 1. 不要提交这些内容

不要提交：

- `.env.local`
- `.spotify-charts-profile/`
- `node_modules/`
- `.next/`
- 任何包含临时 token、API key、浏览器登录态的文件

项目已经提供 `.gitignore`，但提交前仍建议检查：

```bash
git status --short
```

## 2. 可以公开部署的数据

公开站点能读取的是 `public/data/` 里的处理后 JSON。用户访问网站时会下载这些静态 JSON，所以这些数据本质上是公开可见的。

适合公开：

- `public/data/works.json`
- `public/data/billboard_catalog.json`
- `public/data/spotify_catalog.json`
- `public/data/work_entries_index.json`
- `public/data/work_entries/*.json`
- `public/data/chart_entries_index.json`

谨慎公开：

- 大型原始 CSV / JSON
- 需要登录下载的数据源
- 你不想让别人直接拿走的中间文件

## 3. 环境变量

公开部署时在平台后台配置环境变量，不要写进代码。

```env
AI_ANALYST_ENABLED=true
AI_ANALYST_DAILY_LIMIT=20
AI_ANALYST_MIN_INTERVAL_SECONDS=15
AI_ANALYST_CACHE_TTL_SECONDS=86400

AI_PROVIDER=qwen
QWEN_API_KEY=your_qwen_or_dashscope_api_key
QWEN_MODEL=qwen-plus
```

如果额度紧张，可以先关掉 AI：

```env
AI_ANALYST_ENABLED=false
```

## 4. Vercel 部署建议

推荐流程：

1. 把项目推到 GitHub。
2. 在 Vercel 导入 GitHub 仓库。
3. 在 Vercel Project Settings 里添加环境变量。
4. Build Command 使用：

```bash
npm.cmd run build
```

如果 Vercel Linux 环境不识别 `npm.cmd`，改成：

```bash
npm run build
```

5. 部署后打开 `/privacy`，确认数据和 AI 说明页面可访问。

## 5. 后续正式化建议

当前 AI 限流和缓存是内存版，适合 MVP 和小流量试运行。公开访问量变大后建议升级：

- Upstash Redis / Vercel KV 做共享限流
- 数据 JSON 按需分页或压缩
- 接入 Plausible / Umami / Vercel Analytics 统计访问量
- 给 AI 分析加用户反馈按钮，用来收集哪些点评更像你的风格
