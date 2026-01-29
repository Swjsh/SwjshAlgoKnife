import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure headers for Firebase Auth compatibility
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
        ],
      },
    ];
  },
  // Redirect /dashboard to /strategies
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/strategies',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
