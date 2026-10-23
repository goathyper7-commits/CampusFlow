import nextPWA from '@ducanh2912/next-pwa';

// URL tunnel Cloudflare (sementara, berubah kalau tunnel di-restart)
const TUNNEL_URL = 'https://wan-take-anytime-dave.trycloudflare.com';

// Prioritas: env var EXPRESS_PROXY_URL, lalu TUNNEL_URL saat berjalan di Vercel
const EXPRESS_PROXY_URL = (
  process.env.EXPRESS_PROXY_URL ||
  (process.env.VERCEL === '1' ? TUNNEL_URL : '')
)
  .trim()
  .replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@campusflow/shared-types'],
  reactStrictMode: true,
  async rewrites() {
    if (!EXPRESS_PROXY_URL) return [];
    return [
      // Hanya proxy request API ke Express, halaman & file PWA tetap dari Next.js
      {
        source: '/api/:path*',
        destination: `${EXPRESS_PROXY_URL}/api/:path*`,
      },
    ];
  },
};

const withPWA = nextPWA({
  dest: 'public',
  register: false, // registrasi manual di layout (App Router)
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [
      {
        // Navigasi antar halaman: pakai jaringan, fallback ke cache saat offline
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'campusflow-pages',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 },
        },
      },
      {
        // Respons GET API: cache sukses (NetworkFirst) untuk mode offline
        urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'campusflow-api',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

export default withPWA(nextConfig);
