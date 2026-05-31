import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PopChart Compare",
  description: "欧美流行单曲榜单走势对比器，支持 Billboard Hot 100 与 Spotify Top 200 本地数据对比。",
  metadataBase: new URL("https://popchart-compare.local"),
  openGraph: {
    title: "PopChart Compare",
    description: "Compare pop song chart trajectories across Billboard and Spotify datasets.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
