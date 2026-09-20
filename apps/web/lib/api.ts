'use client';

import { clearAuth, getAccessToken, tryRefreshToken } from './auth';
import {
  dbDrain,
  dbEnqueue,
  dbGet,
  dbSet,
  requestOutboxSync,
} from './offline';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function cacheKey(path: string) {
  return `api:${path}`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const accessToken = getAccessToken();
  const isGet = !options.method || options.method === 'GET';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const doFetch = () =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      cache: 'no-store',
    });

  let res: Response;
  try {
    res = await doFetch();
  } catch (err) {
    if (!isGet || path.startsWith('/auth/')) {
      if (!isGet && !path.startsWith('/auth/')) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        await dbEnqueue({
          id,
          method: options.method ?? 'POST',
          path,
          body: options.body ? String(options.body) : undefined,
          apiBase: API_URL,
          accessToken,
          createdAt: Date.now(),
          tries: 0,
        });
        requestOutboxSync();
        throw new ApiError(
          'Disimpan offline — akan dikirim saat koneksi pulih.',
          0,
        );
      }
      throw err;
    }
    const cached = await dbGet<T>(cacheKey(path));
    if (cached !== null) return cached;
    throw err;
  }

  if (res.status === 401 && accessToken && !path.startsWith('/auth/')) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers.Authorization = `Bearer ${getAccessToken()}`;
      res = await doFetch();
    } else {
      clearAuth();
    }
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body && (body.message as string)) ??
      `Request gagal (${res.status})`;
    throw new ApiError(message, res.status);
  }

  if (isGet && !path.startsWith('/auth/')) {
    void dbSet(cacheKey(path), body);
  }

  return body as T;
}