import { buildMessage } from '../../src/reminders/reminders.processor';
import {
  REMINDER_SWEEP_JOB_ID,
  reminderJobId,
} from '../../src/reminders/reminders.constants';

describe('reminders.constants', () => {
  it('custom jobId BullMQ tidak boleh memakai karakter ":"', () => {
    expect(reminderJobId('abc')).not.toContain(':');
    expect(REMINDER_SWEEP_JOB_ID).not.toContain(':');
  });
});

describe('reminders.processor.buildMessage', () => {
  const task = { judul: 'Laporan PBO' };

  it('menyebut "sudah lewat deadline" ketika deadline <= sekarang', () => {
    const deadline = new Date(Date.now() - 60_000);
    const msg = buildMessage({ ...task, deadline });
    expect(msg).toContain('Laporan PBO');
    expect(msg).toContain('sudah lewat deadline');
    expect(msg).toContain('Segera selesaikan!');
  });

  it('menyebut "akan deadline" ketika deadline di masa depan', () => {
    const deadline = new Date(Date.now() + 24 * 3600_000);
    const msg = buildMessage({ ...task, deadline });
    expect(msg).toContain('Laporan PBO');
    expect(msg).toContain('akan deadline');
    expect(msg).toContain('Jangan sampai terlambat!');
  });

  it('memuat tanggal human-readable (id-ID)', () => {
    const deadline = new Date('2026-12-01T08:00:00');
    const weekday = deadline.toLocaleString('id-ID', { weekday: 'long' });
    const msg = buildMessage({ ...task, deadline });
    expect(msg).toContain(weekday);
  });
});