/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/',
          destination: '/desk-duel.html',
        },
        {
          source: '/play',
          destination: '/desk-duel.html',
        },
        {
          source: '/game',
          destination: '/desk-duel.html',
        },
      ],
    };
  },
};

export default nextConfig;
