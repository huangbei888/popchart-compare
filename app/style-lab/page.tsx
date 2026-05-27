type Tone = "magazine" | "terminal" | "war";

type StyleConcept = {
  id: Tone;
  name: string;
  subtitle: string;
  pitch: string;
  audience: string;
  personality: string;
  cost: string;
  risk: string;
  wrapper: string;
  panel: string;
  softPanel: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  chartLine: string;
  chartLineAlt: string;
  chartLineThird: string;
};

const concepts: StyleConcept[] = [
  {
    id: "magazine",
    name: "Chart Magazine",
    subtitle: "数据杂志风",
    pitch: "像一篇 Billboard 专题报道，强标题、版面切割和米白纸感让项目更像作品集里的 editorial product。",
    audience: "适合面试展示、PRD 汇报、内容创作者视角。",
    personality: "编辑部、观点鲜明、可截图传播。",
    cost: "中。需要重做首页排版和表格密度。",
    risk: "工具效率可能稍弱，需要保证控件不要太像文章页。",
    wrapper: "bg-[#eee8dc] text-[#1d1a16]",
    panel: "border border-[#1d1a16] bg-[#f8f1e5] shadow-[10px_10px_0_rgba(29,26,22,0.18)]",
    softPanel: "border border-[#1d1a16]/20 bg-[#fffaf1]",
    text: "text-[#171410]",
    muted: "text-[#6d6258]",
    accent: "bg-[#f2552c] text-white",
    accentText: "text-[#f2552c]",
    chartLine: "bg-[#f2552c]",
    chartLineAlt: "bg-[#171410]",
    chartLineThird: "bg-[#2d77b8]",
  },
  {
    id: "terminal",
    name: "Data Terminal",
    subtitle: "榜单实验室风",
    pitch: "把产品拉向更硬核的数据终端：网格、扫描线、状态灯、等宽数字，让人一眼知道这是分析工具。",
    audience: "适合强调数据可信度、coverage、榜单工程能力。",
    personality: "克制、精密、实验室。",
    cost: "中。表格和图表需要统一成 terminal 语言。",
    risk: "过冷会降低粉丝用户亲近感。",
    wrapper: "bg-[#070b10] text-[#d8fff4]",
    panel: "border border-cyan-300/25 bg-[#071018]/95 shadow-[0_0_0_1px_rgba(103,232,249,0.06),0_26px_90px_rgba(0,0,0,0.5)]",
    softPanel: "border border-cyan-300/15 bg-cyan-300/[0.035]",
    text: "text-cyan-50",
    muted: "text-cyan-100/55",
    accent: "bg-cyan-300 text-[#061016]",
    accentText: "text-cyan-300",
    chartLine: "bg-cyan-300",
    chartLineAlt: "bg-lime-300",
    chartLineThird: "bg-fuchsia-300",
  },
  {
    id: "war",
    name: "Fan War Room",
    subtitle: "粉丝作战室风",
    pitch: "更像社媒 battle 面板，强对比、热搜标签、AI 锐评卡片，适合把产品做得更有传播感。",
    audience: "适合粉丝社区、社媒内容、想突出 AI 点评的人群。",
    personality: "高能、直接、有梗但不失控。",
    cost: "中高。需要重写许多文案和交互状态。",
    risk: "太娱乐化会削弱数据客观性，需要保持边界说明。",
    wrapper: "bg-[#14080d] text-rose-50",
    panel: "border border-rose-300/20 bg-[#211018]/95 shadow-[0_24px_90px_rgba(111,20,45,0.35)]",
    softPanel: "border border-rose-100/10 bg-white/[0.055]",
    text: "text-white",
    muted: "text-rose-100/60",
    accent: "bg-[#ff477e] text-white",
    accentText: "text-[#ff8aa9]",
    chartLine: "bg-[#ff477e]",
    chartLineAlt: "bg-[#ffd166]",
    chartLineThird: "bg-[#58d6ff]",
  },
];

const mockSongs = [
  { title: "vampire", artist: "Olivia Rodrigo", peak: 1, status: "Out" },
  { title: "Espresso", artist: "Sabrina Carpenter", peak: 3, status: "Charting" },
  { title: "Fortnight", artist: "Taylor Swift", peak: 1, status: "Re-entry" },
];

const tableRows = [
  ["vampire", "#1", "#1", "#38", "22", "6", "+18", "Out"],
  ["Espresso", "#3", "#7", "#9", "41", "31", "+4", "Charting"],
  ["Fortnight", "#1", "#1", "#18", "15", "5", "+2", "Re-entry"],
];

function NoirCover({ index }: { index: number }) {
  const gradients = [
    "linear-gradient(135deg,#1f2937,#8d1b3d 48%,#d8b35a)",
    "linear-gradient(135deg,#14352b,#35d39a 52%,#fff2a8)",
    "linear-gradient(135deg,#1b2354,#6ea8ff 48%,#f3f4f6)",
  ];

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[1.1rem] border border-[#1ed760]/25 bg-[#0b100d] shadow-[0_18px_42px_rgba(0,0,0,0.4)]">
      <div className="absolute inset-0" style={{ background: gradients[index] }} />
      <div
        className="absolute inset-0 opacity-45"
        style={{
          background:
            "repeating-radial-gradient(circle at 50% 50%,rgba(255,255,255,0.38) 0 1px,transparent 1px 6px)",
        }}
      />
      <div className="absolute inset-5 rounded-full border border-white/50 bg-black/55" />
      <span className="absolute inset-0 grid place-items-center text-lg font-black text-white drop-shadow">
        {mockSongs[index].title.slice(0, 1).toUpperCase()}
      </span>
    </div>
  );
}

function StageNoirPreview() {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#1ed760]/20 bg-[#050806] text-[#f2fff5] shadow-[0_30px_110px_rgba(0,0,0,0.58)]">
      <div
        className="relative p-5 sm:p-8"
        style={{
          background:
            "linear-gradient(135deg,rgba(30,215,96,0.16),transparent 31%), linear-gradient(72deg,rgba(30,215,96,0.06),transparent 42%), repeating-linear-gradient(90deg,rgba(255,255,255,0.035) 0 1px,transparent 1px 82px)",
        }}
      >
        <div className="absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-[#1ed760] to-transparent" />
        <div className="mb-7 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div>
            <div className="mb-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#1ed760]/40 bg-[#1ed760]/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#9fffc0]">
                STYLE 1 / RECOMMENDED
              </span>
              <span className="rounded-full border border-[#1ed760]/35 bg-[#1ed760]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#7df2a1]">
                Stage Noir 2.0
              </span>
            </div>
            <h2 className="max-w-3xl text-5xl font-black leading-[0.92] tracking-tight text-[#f4fff7] sm:text-7xl">
              Pop data, staged like a headline act.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#a7b8ad]">
              舞台黑胶风升级版：主色回到深黑与流媒体绿，保留黑胶纹理、舞台灯感、唱片封面和更强的榜单仪表盘层次。
            </p>
            <div className="mt-7 grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                ["适合人群", "当前主站、公开版本、音乐数据用户"],
                ["产品气质", "高级、克制、像深夜榜单控制室"],
                ["替换成本", "低。最贴近现有深色主站"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[1.2rem] border border-white/10 bg-black/28 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#1ed760]">{label}</p>
                  <p className="mt-2 text-sm leading-6 text-[#d6e7dc]">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[320px] rounded-[1.6rem] border border-white/10 bg-[#0d120f]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_80px_rgba(0,0,0,0.42)]">
            <div className="absolute right-5 top-5 rounded-full border border-[#1ed760]/30 px-3 py-1 text-xs font-black text-[#7df2a1]">
              LIVE BOARD
            </div>
            <div className="mt-1 flex items-center gap-4">
              <div
                className="grid h-24 w-24 place-items-center rounded-full border border-[#1ed760]/30"
                style={{
                  background:
                    "repeating-radial-gradient(circle at center,rgba(255,255,255,0.18) 0 1px,transparent 1px 7px),linear-gradient(135deg,#12160f,#1f2d20)",
                }}
              >
                <div className="h-8 w-8 rounded-full bg-[#1ed760]" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#6f8178]">now comparing</p>
                <p className="mt-1 text-2xl font-black">vampire vs Espresso</p>
                <p className="mt-2 text-sm text-[#91a49a]">Billboard Hot 100 / Spotify Top 200</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              {mockSongs.map((song, index) => (
                <div key={song.title} className="flex items-center justify-between rounded-[1.2rem] border border-white/10 bg-white/[0.045] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <NoirCover index={index} />
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-white">{song.title}</p>
                      <p className="truncate text-sm text-[#8fa399]">{song.artist}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6f8178]">peak</p>
                    <p className="text-xl font-black text-[#1ed760]">#{song.peak}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <aside className="rounded-[1.6rem] border border-white/10 bg-[#0b100d]/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.36)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">Control Deck</h3>
              <span className="rounded-full bg-[#1ed760] px-3 py-1 text-xs font-black text-black">Rank</span>
            </div>
            <div className="rounded-[1.2rem] border border-[#1ed760]/20 bg-[#1ed760]/8 p-3">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-[#7df2a1]">Search catalog</p>
              <div className="rounded-full border border-white/10 bg-black/28 px-4 py-3 text-sm text-[#d6e7dc]">
                Sabrina / Olivia / Taylor
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {["Billboard", "Spotify", "US", "Global"].map((item, itemIndex) => (
                <button
                  key={item}
                  className={`rounded-[1rem] border px-3 py-2 text-sm font-black transition ${
                    itemIndex === 0 || itemIndex === 2
                      ? "border-[#1ed760]/40 bg-[#1ed760] text-black"
                      : "border-white/10 bg-white/[0.045] text-[#d6e7dc]"
                  }`}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-black/24 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6f8178]">coverage</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[72%] rounded-full bg-[#1ed760]" />
              </div>
              <p className="mt-2 text-xs text-[#8fa399]">Spotify US: 2023-10-21 → 2026-05-20</p>
            </div>
          </aside>

          <div className="grid gap-5">
            <div className="rounded-[1.6rem] border border-white/10 bg-[#0d120f]/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.36)]">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1ed760]">trajectory</p>
                  <h3 className="mt-1 text-2xl font-black text-white">Ranking Movement</h3>
                </div>
                <div className="flex gap-2 text-xs font-black">
                  <span className="rounded-full border border-[#7dd3fc]/40 bg-[#7dd3fc]/15 px-3 py-1 text-[#9ae6ff]">Re 2</span>
                  <span className="rounded-full border border-[#fb7185]/40 bg-[#fb7185]/15 px-3 py-1 text-[#fecdd3]">Out 1</span>
                </div>
              </div>
              <div className="relative h-72 overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#050806]">
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
                    backgroundSize: "54px 42px",
                  }}
                />
                <div className="absolute left-4 top-4 grid gap-5 text-xs font-bold text-[#6f8178]">
                  <span>#1</span>
                  <span>#10</span>
                  <span>#50</span>
                  <span>#100</span>
                </div>
                <div className="absolute right-4 top-4 flex flex-wrap gap-2 text-[10px] font-black">
                  <span className="rounded-full border border-[#1ed760]/35 bg-[#1ed760]/12 px-2 py-1 text-[#7df2a1]">vampire</span>
                  <span className="rounded-full border border-[#f8d66d]/35 bg-[#f8d66d]/12 px-2 py-1 text-[#ffe29a]">Espresso</span>
                  <span className="rounded-full border border-[#8aa7ff]/35 bg-[#8aa7ff]/12 px-2 py-1 text-[#b8c7ff]">Fortnight</span>
                </div>
                <div className="absolute inset-x-12 bottom-16 top-14">
                  <div className="absolute left-[4%] top-[12%] h-1.5 w-[76%] origin-left rotate-[7deg] rounded-full bg-[#1ed760] shadow-[0_0_20px_rgba(30,215,96,0.48)]" />
                  <div className="absolute left-[10%] top-[48%] h-1.5 w-[68%] origin-left -rotate-[15deg] rounded-full bg-[#f8d66d] shadow-[0_0_18px_rgba(248,214,109,0.34)]" />
                  <div className="absolute left-[22%] top-[30%] h-1.5 w-[58%] origin-left rotate-[22deg] rounded-full bg-[#8aa7ff] shadow-[0_0_18px_rgba(138,167,255,0.34)]" />
                  <span className="absolute left-[72%] top-[6%] rounded-full bg-[#1ed760] px-2 py-1 text-[10px] font-black text-black">Re</span>
                  <span className="absolute left-[79%] top-[66%] rounded-full bg-[#fb7185] px-2 py-1 text-[10px] font-black text-white">Out</span>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-[#6f8178]">
                  <span>2024-04</span>
                  <span>2024-08</span>
                  <span>2025-01</span>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0d120f]/95">
                <div className="grid grid-cols-8 gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase text-[#6f8178]">
                  <span className="col-span-2">Track</span>
                  <span>Peak</span>
                  <span>Debut</span>
                  <span>Latest</span>
                  <span>Entries</span>
                  <span>Rise</span>
                  <span>Status</span>
                </div>
                {tableRows.map((row, rowIndex) => (
                  <div key={row[0]} className="grid grid-cols-8 gap-2 border-b border-white/5 px-4 py-3 text-sm">
                    <span
                      className={`col-span-2 font-black ${
                        rowIndex === 0 ? "text-[#7df2a1]" : rowIndex === 1 ? "text-[#ffe29a]" : "text-[#b8c7ff]"
                      }`}
                    >
                      {row[0]}
                    </span>
                    <span className="font-black text-[#1ed760]">{row[1]}</span>
                    <span className="font-semibold text-[#f8d66d]">{row[2]}</span>
                    <span className="font-semibold text-[#8aa7ff]">{row[3]}</span>
                    <span className="text-[#8fa399]">{row[4]}</span>
                    <span className="text-[#8fa399]">{row[5]}</span>
                    <span className="font-semibold text-[#7df2a1]">{row[6]}</span>
                    <span
                      className={`w-fit rounded-full px-2 py-0.5 text-xs font-black ${
                        row[7] === "Charting"
                          ? "bg-[#1ed760]/15 text-[#7df2a1]"
                          : row[7] === "Re-entry"
                            ? "bg-[#8aa7ff]/15 text-[#b8c7ff]"
                            : "bg-[#fb7185]/15 text-[#fecdd3]"
                      }`}
                    >
                      {row[7]}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.6rem] border border-[#1ed760]/20 bg-[#0e1511]/95 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7df2a1]">ai chart analyst</p>
                <h3 className="mt-2 text-xl font-black text-white">一句网感总结</h3>
                <p className="mt-4 text-sm leading-7 text-[#a7b8ad]">
                  Espresso 是慢热爬坡型，vampire 开局够狠，Fortnight 更像首周爆发后看粉丝盘续航。
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-black">
                  <span className="rounded-[1rem] border border-white/10 bg-black/24 p-3 text-[#d6e7dc]">开局: vampire</span>
                  <span className="rounded-[1rem] border border-white/10 bg-black/24 p-3 text-[#d6e7dc]">后劲: Espresso</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 rounded-[1.2rem] border border-[#1ed760]/20 bg-[#1ed760]/8 p-4 text-sm leading-7 text-[#d6e7dc]">
          风险点：主色可以与 Spotify 方向保持一致，但绿色主要用于按钮、曲线和关键数值；背景继续保持深黑纹理，避免页面变成大面积纯绿。
        </p>
      </div>
    </section>
  );
}

function MiniCover({ concept, index }: { concept: StyleConcept; index: number }) {
  const ring =
    concept.id === "magazine"
      ? "border-[#1d1a16]"
      : concept.id === "terminal"
        ? "border-cyan-300/30"
        : "border-rose-300/30";

  return (
    <div
      className={`grid h-14 w-14 shrink-0 place-items-center border ${ring} ${
        concept.id === "magazine" ? "rounded-none" : "rounded-2xl"
      }`}
      style={{
        background:
          index === 0
            ? "linear-gradient(135deg,#222,#8d1b3d 48%,#f4d36a)"
            : index === 1
              ? "linear-gradient(135deg,#14352b,#35d39a 52%,#fff2a8)"
              : "linear-gradient(135deg,#1b2354,#6ea8ff 48%,#f3f4f6)",
      }}
    >
      <span className="text-lg font-black text-white drop-shadow">{mockSongs[index].title.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

function MockChart({ concept }: { concept: StyleConcept }) {
  const base = concept.id === "magazine" ? "border-[#1d1a16]/20" : "border-white/10";

  return (
    <div className={`relative h-64 overflow-hidden rounded-2xl border ${base} ${concept.softPanel}`}>
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: concept.id === "terminal" ? "32px 32px" : "48px 48px",
        }}
      />
      <div className="absolute left-4 top-4 grid gap-2 text-xs font-semibold opacity-70">
        <span>#1</span>
        <span>#10</span>
        <span>#50</span>
        <span>#100</span>
      </div>
      <div className="absolute inset-x-10 bottom-16 top-14">
        <div className={`absolute left-[4%] top-[8%] h-1 w-[72%] origin-left rotate-[8deg] rounded-full ${concept.chartLine}`} />
        <div className={`absolute left-[10%] top-[45%] h-1 w-[68%] origin-left -rotate-[14deg] rounded-full ${concept.chartLineAlt}`} />
        <div className={`absolute left-[22%] top-[28%] h-1 w-[58%] origin-left rotate-[22deg] rounded-full ${concept.chartLineThird}`} />
        <span className={`absolute left-[71%] top-[5%] rounded-full px-2 py-1 text-[10px] font-black ${concept.accent}`}>
          Re
        </span>
        <span className="absolute left-[78%] top-[63%] rounded-full bg-black px-2 py-1 text-[10px] font-black text-white">
          Out
        </span>
      </div>
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs opacity-75">
        <span>2024-04</span>
        <span>2024-08</span>
        <span>2025-01</span>
      </div>
    </div>
  );
}

function ConceptMeta({ concept }: { concept: StyleConcept }) {
  return (
    <div className={`grid gap-3 rounded-2xl p-4 text-sm ${concept.softPanel}`}>
      {[
        ["适合人群", concept.audience],
        ["产品气质", concept.personality],
        ["替换成本", concept.cost],
        ["风险点", concept.risk],
      ].map(([label, value]) => (
        <div key={label} className="grid gap-1">
          <span className={`text-xs font-black uppercase tracking-[0.18em] ${concept.accentText}`}>{label}</span>
          <span className={concept.muted}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function StylePreview({ concept, index }: { concept: StyleConcept; index: number }) {
  const font =
    concept.id === "magazine"
      ? { fontFamily: 'Georgia, "Times New Roman", "Microsoft YaHei", serif' }
      : concept.id === "terminal"
        ? { fontFamily: '"Cascadia Mono", "Consolas", "Microsoft YaHei", monospace' }
        : { fontFamily: '"Bahnschrift", "Microsoft YaHei", sans-serif' };

  return (
    <section className={`overflow-hidden rounded-[2rem] ${concept.wrapper}`} style={font}>
      <div
        className="p-5 sm:p-8"
        style={{
          background:
            concept.id === "terminal"
              ? "linear-gradient(135deg,rgba(103,232,249,0.08),transparent 32%), repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 72px)"
              : concept.id === "magazine"
                ? "repeating-linear-gradient(0deg,rgba(29,26,22,0.045) 0 1px,transparent 1px 18px)"
                : "linear-gradient(135deg,rgba(255,71,126,0.16),transparent 34%), repeating-linear-gradient(-8deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 42px)",
        }}
      >
        <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className={`text-xs font-black uppercase tracking-[0.28em] ${concept.accentText}`}>STYLE {index + 2}</p>
            <h2 className={`mt-3 text-4xl font-black tracking-tight sm:text-6xl ${concept.text}`}>{concept.name}</h2>
            <p className={`mt-2 text-xl font-semibold ${concept.accentText}`}>{concept.subtitle}</p>
            <p className={`mt-4 max-w-2xl text-sm leading-7 ${concept.muted}`}>{concept.pitch}</p>
          </div>
          <ConceptMeta concept={concept} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <aside className={`rounded-3xl p-4 ${concept.panel}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className={`text-lg font-black ${concept.text}`}>PopChart Compare</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${concept.accent}`}>Hot 100</span>
            </div>
            <div className={`mb-4 rounded-2xl p-3 ${concept.softPanel}`}>
              <p className={`mb-2 text-xs font-black uppercase tracking-[0.18em] ${concept.muted}`}>Search</p>
              <div className="rounded-full border border-current/15 px-4 py-3 text-sm opacity-90">Sabrina / Olivia / Taylor</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["Billboard", "Spotify", "US", "Global"].map((item, itemIndex) => (
                <button
                  key={item}
                  className={`rounded-2xl border border-current/10 px-3 py-2 text-sm font-bold ${
                    itemIndex === 0 || itemIndex === 2 ? concept.accent : concept.softPanel
                  }`}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              {mockSongs.map((song, songIndex) => (
                <div key={song.title} className={`flex items-center gap-3 rounded-2xl p-3 ${concept.softPanel}`}>
                  <MiniCover concept={concept} index={songIndex} />
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-black ${concept.text}`}>{song.title}</p>
                    <p className={`truncate text-xs ${concept.muted}`}>{song.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="grid gap-5">
            <div className={`rounded-3xl p-4 ${concept.panel}`}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className={`text-xs font-black uppercase tracking-[0.18em] ${concept.accentText}`}>trajectory</p>
                  <h3 className={`mt-1 text-2xl font-black ${concept.text}`}>Ranking Movement</h3>
                </div>
                <div className="flex gap-2 text-xs font-black">
                  <span className={`rounded-full px-3 py-1 ${concept.accent}`}>Re 2</span>
                  <span className="rounded-full bg-black px-3 py-1 text-white">Out 1</span>
                </div>
              </div>
              <MockChart concept={concept} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className={`overflow-hidden rounded-3xl ${concept.panel}`}>
                <div className="grid grid-cols-8 gap-2 border-b border-current/10 px-4 py-3 text-xs font-black uppercase opacity-70">
                  <span className="col-span-2">Track</span>
                  <span>Peak</span>
                  <span>Debut</span>
                  <span>Latest</span>
                  <span>Entries</span>
                  <span>Rise</span>
                  <span>Status</span>
                </div>
                {tableRows.map((row) => (
                  <div key={row[0]} className="grid grid-cols-8 gap-2 border-b border-current/5 px-4 py-3 text-sm">
                    <span className={`col-span-2 font-black ${concept.text}`}>{row[0]}</span>
                    {row.slice(1).map((cell, cellIndex) => (
                      <span key={`${row[0]}-${cellIndex}`} className={cellIndex === 0 ? concept.accentText : concept.muted}>
                        {cell}
                      </span>
                    ))}
                  </div>
                ))}
              </div>

              <div className={`rounded-3xl p-5 ${concept.panel}`}>
                <p className={`text-xs font-black uppercase tracking-[0.18em] ${concept.accentText}`}>ai chart analyst</p>
                <h3 className={`mt-2 text-xl font-black ${concept.text}`}>一句网感总结</h3>
                <p className={`mt-4 text-sm leading-7 ${concept.muted}`}>
                  Espresso 是慢热爬坡型，vampire 开局够狠，Fortnight 更像首周爆发后看粉丝盘续航。
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-black">
                  <span className={`rounded-2xl p-3 ${concept.softPanel}`}>开局: vampire</span>
                  <span className={`rounded-2xl p-3 ${concept.softPanel}`}>后劲: Espresso</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function StyleLabPage() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8">
        <header className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">visual direction lab</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight sm:text-6xl">PopChart Compare Style Lab</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
                这里是独立前端风格预览页，不读取真实榜单数据，不影响首页。第一套已升级为深黑绿 Stage Noir 2.0，方便你判断是否迁移到主站。
              </p>
            </div>
            <a
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-emerald-300/50 hover:text-white"
              href="/"
            >
              返回首页
            </a>
          </div>
        </header>

        <StageNoirPreview />

        {concepts.map((concept, index) => (
          <StylePreview key={concept.id} concept={concept} index={index} />
        ))}
      </div>
    </main>
  );
}

