/** Static export: `npm run build` writes a plain website to ./out that can be hosted anywhere. */
const nextConfig={
  output:'export',
  reactStrictMode:true,
  images:{unoptimized:true},
};
export default nextConfig;
