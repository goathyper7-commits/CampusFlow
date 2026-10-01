import {
  buildEventMessage,
  buildTaskMessage,
} from '../../src/reminders/reminders.processor';
import {
  REMINDER_SWEEP_JOB_ID,
  reminderJobId,
} from '../../src/reminders/reminders.constants';
import {
  computeScheduledAt,
  durationMinutes,
  isDurationValid,
  isOffsetValid,
  isSlotAligned,
  snapToSlot,
  snoozeTarget,
} from '../../src/common/waktu.util';

describe('reminders.constants', () => {
  it('custom jobId BullMQ tidak boleh memakai karakter ":"', () => {
    expect(reminderJobId('abc')).not.toContain(':');
    expect(REMINDER_SWEEP_JOB_ID).not.toContain(':');
  });
});

describe('reminders.processor.buildTaskMessage', () => {
  const task = { judul: 'Laporan PBO' };

  it('menyebut "sudah lewat deadline" ketika deadline <= sekarang', () => {
    const deadline = new Date(Date.now() - 60_000);
    const msg = buildTaskMessage({ ...task, deadline });
    expect(msg).toContain('Laporan PBO');
    expect(msg).toContain('sudah lewat deadline');
    expect(msg).toContain('Segera selesaikan!');
  });

  it('menyebut "akan deadline" ketika deadline di masa depan', () => {
    const deadline = new Date(Date.now() + 24 * 3600_000);
    const msg = buildTaskMessage({ ...task, deadline });
    expect(msg).toContain('Laporan PBO');
    expect(msg).toContain('akan deadline');
    expect(msg).toContain('Jangan sampai terlambat!');
  });

  it('memuat tanggal human-readable (id-ID)', () => {
    const deadline = new Date('2026-12-01T08:00:00');
    const weekday = deadline.toLocaleString('id-ID', { weekday: 'long' });
    const msg = buildTaskMessage({ ...task, deadline });
    expect(msg).toContain(weekday);
  });
});

describe('reminders.processor.buildEventMessage', () => {
  it('menyebut aktivitas yang sudah mulai', () => {
    const msg = buildEventMessage({
      judul: 'Latihan Basket',
      waktuMulai: new Date(Date.now() - 5 * 60_000),
    });
    expect(msg).toContain('Latihan Basket');
    expect(msg).toContain('sudah dimulai');
  });

  it('menyebut aktivitas yang akan mulai', () => {
    const msg = buildEventMessage({
      judul: 'Rapat-demo',
      waktuMulai: new Date(Date.now() + 30 * 60_000),
    });
    expect(msg).toContain('Rapat-demo');
    expect(msg).toContain('mulai');
  });
});

describe('waktu.util', () => {
  it('snapToSlot membulatkan ke kelipatan 5 menit terdekat', () => {
    const naik = snapToSlot(new Date('2026-10-01T08:07:33.000Z'));
    expect(isSlotAligned(naik)).toBe(true);
    expect(naik.getTime()).toBe(new Date('2026-10-01T08:10:00.000Z').getTime());

    const turun = snapToSlot(new Date('2026-10-01T08:03:20.000Z'));
    expect(turun.getTime()).toBe(new Date('2026-10-01T08:05:00.000Z').getTime());
  });

  it('isOffsetValid hanya menerima kelipatan 5 menit positif', () => {
    expect(isOffsetValid(60)).toBe(true);
    expect(isOffsetValid(0)).toBe(false);
    expect(isOffsetValid(-30)).toBe(false);
    expect(isOffsetValid(23)).toBe(false);
  });

  it('computeScheduledAt mengurangi offset dari target', () => {
    const target = new Date('2026-10-02T10:00:00.000Z');
    expect(computeScheduledAt(target, 60).toISOString()).toBe('2026-10-02T09:00:00.000Z');
  });

  it('snoozeTarget tidak melewati batas tenggat', () => {
    const jadwal = new Date('2026-10-02T10:00:00.000Z');
    const batas = new Date('2026-10-02T10:03:00.000Z');
    expect(snoozeTarget(jadwal, batas, 5).getTime()).toBeLessThanOrEqual(batas.getTime());
  });

  it('durationMinimal 30 menit dan maksimal 3 jam', () => {
    const mulai = new Date('2026-10-01T08:00:00.000Z');
    expect(durationMinutes(mulai, new Date('2026-10-01T08:30:00.000Z'))).toBe(30);
    expect(isDurationValid(30)).toBe(true);
    expect(isDurationValid(25)).toBe(false);
    expect(isDurationValid(200)).toBe(false);
    expect(isDurationValid(180)).toBe(true);
  });
});
