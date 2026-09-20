const QUEUE_OP_TIMEOUT_MS = 3000;

/**
 * Menjalankan operasi BullMQ dengan batas waktu agar permintaan API tidak
 * menggantung ketika Redis tidak tersedia. Error tetap dicatat ke console.
 */
export async function queueOpWithTimeout(
  op: () => Promise<unknown>,
  label: string,
  timeoutMs = QUEUE_OP_TIMEOUT_MS,
): Promise<void> {
  const pending = Promise.resolve()
    .then(op)
    .catch((err) => {
      console.error(`[reminders] ${label} (Redis aktif?):`, err);
    });
  await Promise.race([
    pending,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}