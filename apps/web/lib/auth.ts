'use client';

const ACCESS_KEY = 'cf_access_token';
const USER_KEY = 'cf_user';

export interface StoredUser {
  id: string;
  nim: string;
  nama: string;
  email: string;
  prodi?: string | null;
  semester?: number | null;
  role?: string;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function saveAuth(payload: {
  accessToken: string;
  user?: StoredUser;
}) {
  window.localStorage.setItem(ACCESS_KEY, payload.accessToken);
  if (payload.user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  }
}

export function clearAuth() {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/auth/refresh-token`,
      {
        method: 'POST',
        credentials: 'include',
      },
    );
    if (!res.ok) return false;
    const data = await res.json();
    saveAuth({ accessToken: data.accessToken, user: data.user });
    return true;
  } catch {
    return false;
  }
}