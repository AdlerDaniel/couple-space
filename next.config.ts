import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const supabaseOrigin = "https://adyfbxbmfrdetzdxdmmh.supabase.co";

    return {
      afterFiles: [
        { source: "/supabase/rest/:path*", destination: `${supabaseOrigin}/rest/:path*` },
        { source: "/supabase/auth/:path*", destination: `${supabaseOrigin}/auth/:path*` },
        { source: "/supabase/storage/:path*", destination: `${supabaseOrigin}/storage/:path*` },
        { source: "/supabase/functions/:path*", destination: `${supabaseOrigin}/functions/:path*` },
        { source: "/supabase/graphql/:path*", destination: `${supabaseOrigin}/graphql/:path*` },
        {
          source: "/supabase/realtime/v1/api/:path*",
          destination: `${supabaseOrigin}/realtime/v1/api/:path*`,
        },
      ],
    };
  },
  images: {
    // Sites cannot optimize same-origin Supabase proxy URLs reliably.
    // Serving stored media directly keeps avatars, memories and answers portable.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
