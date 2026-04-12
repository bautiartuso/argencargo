/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'nhfslvixhlbiyfmedmbr.supabase.co' },
    ],
  },
};
module.exports = nextConfig;
