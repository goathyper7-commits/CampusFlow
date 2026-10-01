import { createHash, randomBytes } from 'node:crypto';

const PEJALAN_KODEC = '0123456789';
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_SEND_LIMIT = 3;
export const OTP_SEND_WINDOW_MS = 10 * 60_000;

export function generateOtpCode(): string {
  const bytes = randomBytes(OTP_LENGTH);
  let kode = '';
  for (const byte of bytes) {
    kode += PEJALAN_KODEC[byte % PEJALAN_KODEC.length];
  }
  return kode;
}

export function hashOtpCode(kode: string): string {
  return createHash('sha256').update(kode).digest('hex');
}

export function otpExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + OTP_TTL_MS);
}

export function isOtpUsable(
  otp: { expiresAt: Date; usedAt: Date | null; attempts: number; maxAttempts: number },
  now: Date = new Date(),
): boolean {
  if (otp.usedAt) return false;
  if (otp.expiresAt.getTime() <= now.getTime()) return false;
  if (otp.attempts >= otp.maxAttempts) return false;
  return true;
}

export function sendWindowBlocked(
  codes: { sendCount: number; lastSentAt: Date | null }[],
  now: Date = new Date(),
): boolean {
  const dalamJendela = codes.filter(
    (c) => c.lastSentAt && now.getTime() - c.lastSentAt.getTime() < OTP_SEND_WINDOW_MS,
  );
  return dalamJendela.length >= OTP_SEND_LIMIT;
}
