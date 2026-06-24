/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Privacy posture: do not expose the framework header.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No-store everywhere: we are an ephemeral product by design.
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // No third-party analytics/profiling permitted.
          { key: "Permissions-Policy", value: "browsing-topics=(), interest-cohort=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
