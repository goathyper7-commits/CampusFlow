import nextPWA from 'next-pwa';

const EXPRESS_PROXY_URL =
  process.env.VERCEL === '1'
    ? 'https://followed-into-asp-incoming.trycloudflare.com'
    : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@campusflow/shared-types'],
  reactStrictMode: true,
  async rewrites() {
    if (!EXPRESS_PROXY_URL) return [];
    return {
      beforeFiles: [
        { source: '/:path*', destination: `${EXPRESS_PROXY_URL}/:path*` },
      ],
    };
  },
};

const withPWA = nextPWA({
  dest: 'public',
  register: false, // registrasi manual di layout (App Router)
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
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
});

export default withPWA(nextConfig);
