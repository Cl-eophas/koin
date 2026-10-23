/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Proxies /api/* to the existing YPPEOPLE Express backend during dev,
    // so cookies/JWT auth continues to work same-origin.
    const API = process.env.API_PROXY_TARGET || "http://localhost:5000";
    return [
      { source: "/api/:path*", destination: `${API}/api/:path*` },
      { source: "/uploads/:path*", destination: `${API}/uploads/:path*` },
    ];
  },
};
module.exports = nextConfig;
