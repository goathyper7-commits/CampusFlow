-- Revisi 4: kategori aktivitas sesuai blueprint, notifikasi multi-kanal per pengingat

ALTER TYPE "ActivityKategori" RENAME TO "ActivityKategori_lama";

CREATE TYPE "ActivityKategori" AS ENUM ('ORGANISASI', 'OLAHRAGA', 'KERJA_KELOMPOK', 'PRIBADI');

ALTER TABLE "Activity"
  ALTER COLUMN "kategori" DROP DEFAULT,
  ALTER COLUMN "kategori" TYPE "ActivityKategori"
    USING CASE
      WHEN "kategori" = 'EVENT' THEN 'ORGANISASI'
      WHEN "kategori" = 'PERSONAL' THEN 'PRIBADI'
      ELSE "kategori"::text
    END::"ActivityKategori";

ALTER TABLE "Activity" ALTER COLUMN "kategori" SET DEFAULT 'PRIBADI';

DROP TYPE "ActivityKategori_lama";

DROP INDEX IF EXISTS "Notification_reminderId_key";

CREATE INDEX "Notification_reminderId_idx" ON "Notification"("reminderId");
