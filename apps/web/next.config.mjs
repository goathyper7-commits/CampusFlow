// 1. Import library PWA di paling atas
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Menambahkan URL Cloudflare Tunnel sebagai environment variable
  env: {
    NEXT_PUBLIC_API_URL: 'https://consolidation-unfortunately-benefit-magazine.trycloudflare.com',
  },

  // Memperingankan izin akses gambar jika URL Cloudflare digunakan untuk media/assets
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'consolidation-unfortunately-benefit-magazine.trycloudflare.com',
      },
    ],
  },
};

// 2. Export config yang sudah terintegrasi PWA
export default withPWA(nextConfig);
