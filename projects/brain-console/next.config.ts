import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      {
        source: '/infinite-brain',
        destination: '/brain',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
