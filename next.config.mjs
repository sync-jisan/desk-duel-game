/** @type {import('next').NextConfig} */
// BUILD_TARGET=app builds plain static files into ./out for the Android app (Capacitor).
// The normal web build (Vercel) is unchanged.
const isApp = process.env.BUILD_TARGET === 'app';

const nextConfig = {
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  ...(isApp ? { output: 'export' } : {}),
};

export default nextConfig;
