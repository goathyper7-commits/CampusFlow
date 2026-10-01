const SLOT_MINUTES = 5;
export const DURATION_MIN_MINUTES = 30;
export const DURATION_MAX_MINUTES = 180;
export const REMINDER_OFFSETS_DEFAULT = [60, 15];
export const SNOOZE_MINUTES = 5;

const MS_PER_MINUTE = 60_000;

export function snapToSlot(date: Date): Date {
  const step = SLOT_MINUTES * MS_PER_MINUTE;
  return new Date(Math.round(date.getTime() / step) * step);
}

export function isSlotAligned(date: Date): boolean {
  return (
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0 &&
    date.getUTCMinutes() % SLOT_MINUTES === 0
  );
}

export function isOffsetValid(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes > 0 && minutes % SLOT_MINUTES === 0;
}

export function isDurationValid(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= DURATION_MIN_MINUTES &&
    minutes <= DURATION_MAX_MINUTES &&
    minutes % SLOT_MINUTES === 0
  );
}

export function durationMinutes(mulai: Date, selesai: Date): number {
  return Math.round((selesai.getTime() - mulai.getTime()) / MS_PER_MINUTE);
}

export function computeScheduledAt(target: Date, offsetMinutes: number): Date {
  return new Date(target.getTime() - offsetMinutes * MS_PER_MINUTE);
}

export function snoozeTarget(
  scheduledAt: Date,
  batas: Date | null,
  minutes: number = SNOOZE_MINUTES,
): Date {
  let berikut = new Date(scheduledAt.getTime() + minutes * MS_PER_MINUTE);
  if (batas && berikut.getTime() >= batas.getTime()) {
    return new Date(
      Math.min(
        scheduledAt.getTime(),
        batas.getTime() - SLOT_MINUTES * MS_PER_MINUTE,
      ),
    );
  }
  return snapToSlot(berikut);
}

export function minutesSinceMidnight(date: Date, timezone: string): number {
  const bagian = new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const jam = Number(bagian.find((p) => p.type === 'hour')?.value ?? '0');
  const menit = Number(bagian.find((p) => p.type === 'minute')?.value ?? '0');
  return (jam % 24) * 60 + menit;
}

export function isWithinQuietHours(
  date: Date,
  timezone: string,
  mulai: number | null | undefined,
  selesai: number | null | undefined,
): boolean {
  if (mulai == null || selesai == null) return false;
  if (mulai === selesai) return false;
  const sekarang = minutesSinceMidnight(date, timezone);
  return mulai < selesai
    ? sekarang >= mulai && sekarang < selesai
    : sekarang >= mulai || sekarang < selesai;
}

export function formatTanggalJam(date: Date, timezone = 'Asia/Jakarta'): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatJam(date: Date, timezone = 'Asia/Jakarta'): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatSisa(menit: number): string {
  const abs = Math.abs(Math.round(menit));
  if (abs < 60) return `${abs} menit`;
  const jam = Math.floor(abs / 60);
  const sisa = abs % 60;
  if (jam < 24) return sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} menit`;
  return `${Math.floor(jam / 24)} hari ${jam % 24} jam`;
}

export function minutesUntil(target: Date, now: Date = new Date()): number {
  return Math.round((target.getTime() - now.getTime()) / MS_PER_MINUTE);
}
