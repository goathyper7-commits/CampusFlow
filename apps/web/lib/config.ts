const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

/**
 * Di browser, API dipanggil same-origin lewat route handler /api/* saat
 * production supaya cookie refresh tetap bisa dipakai dan tidak kena CORS.
 * Di development, API NestJS berjalan langsung di port 3001.
 */
export const API_URL = (
  configured && configured.length > 0
    ? configured
    : process.env.NODE_ENV === 'production'
      ? '/api'
      : 'http://localhost:3001/api'
).replace(/\/+$/, '');

export const IS_API_CONFIGURED = Boolean(configured);
