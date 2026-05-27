export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-5 py-10 text-zinc-200">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">public notes</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white">隐私与数据说明</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">
          PopChart Compare 是一个音乐榜单数据可视化工具。当前版本不提供登录，不需要用户上传个人身份信息。
        </p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-6">
        <h2 className="text-xl font-semibold text-white">我们使用的数据</h2>
        <div className="mt-4 grid gap-4 text-sm leading-7 text-zinc-300">
          <p>Billboard 数据来自本地处理后的 Hot 100 历史榜单数据。</p>
          <p>Spotify 数据来自站点维护者本地导入的 Spotify Charts 官方 CSV，覆盖范围取决于已下载的数据日期和地区。</p>
          <p>封面图可能来自 Spotify 数据、iTunes Search 或手动维护的 cover_url。缺失封面时会显示本地生成的占位封面。</p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-6">
        <h2 className="text-xl font-semibold text-white">AI 走势点评</h2>
        <div className="mt-4 grid gap-4 text-sm leading-7 text-zinc-300">
          <p>
            点击 AI 走势点评时，网站只会把你当前选择歌曲的榜单摘要指标发送给服务端模型接口，例如 peak、debut、latest、
            Top 10 周数、最大升跌幅和回榜次数。
          </p>
          <p>不会发送浏览器 cookie、登录身份或你的私人歌单。当前版本也不要求用户登录。</p>
          <p>为了控制公开访问成本，AI 接口带有访问频率限制和缓存。相同请求会优先返回缓存结果。</p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-6">
        <h2 className="text-xl font-semibold text-white">当前限制</h2>
        <ul className="mt-4 grid gap-3 text-sm leading-7 text-zinc-300">
          <li>当前版本聚焦单曲走势，不支持专辑走势。</li>
          <li>Spotify 覆盖范围取决于本地 CSV 数据，不代表完整实时 Spotify 数据库。</li>
          <li>AI 点评是辅助解读，不应视为官方榜单结论。</li>
        </ul>
      </section>

      <a className="text-sm font-semibold text-emerald-200 hover:text-emerald-100" href="/">
        返回首页
      </a>
    </main>
  );
}
