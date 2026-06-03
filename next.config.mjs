/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/data/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
