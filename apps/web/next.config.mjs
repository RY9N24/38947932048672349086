const nextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  devIndicators: false,
  async rewrites() {
    const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:3001";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/socket.io/", destination: `${api}/socket.io/` },
      { source: "/socket.io", destination: `${api}/socket.io/` },
    ];
  },
};
export default nextConfig;
