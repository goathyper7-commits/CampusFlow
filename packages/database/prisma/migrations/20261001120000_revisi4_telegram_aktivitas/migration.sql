-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('TELEGRAM', 'PUSH', 'EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN_PERANGKAT_BARU', 'LUPA_SANDI', 'GANTI_USERNAME', 'GANTI_NOMOR');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SCHEDULED', 'SENT', 'CANCELLED', 'SNOOZED', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "botEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phoneE164" TEXT,
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "quietHoursEnd" INTEGER,
ADD COLUMN     "quietHoursStart" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "username" TEXT,
ADD COLUMN     "usernameChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lokasi" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "offsetMinutes" INTEGER,
ADD COLUMN     "snoozeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "ReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "taskId" DROP NOT NULL;

-- Backfill: offset jam lama menjadi menit, dan isi userId dari task
UPDATE "Reminder" SET "offsetMinutes" = COALESCE("offsetHours", 1) * 60
WHERE "offsetMinutes" IS NULL;
UPDATE "Reminder" r SET "userId" = t."userId" FROM "Task" t WHERE r."taskId" = t."id" AND r."userId" IS NULL;
DELETE FROM "Reminder" WHERE "userId" IS NULL;

ALTER TABLE "Reminder" ALTER COLUMN "offsetMinutes" SET NOT NULL,
ALTER COLUMN "userId" SET NOT NULL;

-- Backfill: reminder yang sudah terkirim become SENT, yang lewat dijadwalkan ulang
UPDATE "Reminder" SET "status" = 'SENT' WHERE "isSent" = true;
UPDATE "Reminder" SET "status" = 'CANCELLED', "cancelledAt" = CURRENT_TIMESTAMP
WHERE "isSent" = false AND "scheduledAt" < CURRENT_TIMESTAMP - INTERVAL '1 year';

ALTER TABLE "Reminder" DROP COLUMN "offsetHours";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "channel" "ChannelType" NOT NULL DEFAULT 'IN_APP',
ADD COLUMN     "error" TEXT,
ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'QUEUED';

-- Backfill: notifikasi lama dicatat sebagai terkirim via IN_APP
UPDATE "Notification" SET "status" = CASE WHEN "isSent" = true THEN 'SENT' ELSE 'QUEUED' END,
"sentAt" = CASE WHEN "isSent" = true THEN "scheduledAt" ELSE NULL END;

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "telegramEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "UsernameHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsernameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserChannel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "telegramChatId" TEXT,
    "telegramUsername" TEXT,
    "optedIn" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLinkToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "channel" "ChannelType" NOT NULL DEFAULT 'TELEGRAM',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "usedAt" TIMESTAMP(3),
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsernameHistory_userId_changedAt_idx" ON "UsernameHistory"("userId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserChannel_telegramChatId_key" ON "UserChannel"("telegramChatId");

-- CreateIndex
CREATE INDEX "UserChannel_channel_optedIn_idx" ON "UserChannel"("channel", "optedIn");

-- CreateIndex
CREATE UNIQUE INDEX "UserChannel_userId_channel_key" ON "UserChannel"("userId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkToken_tokenHash_key" ON "TelegramLinkToken"("tokenHash");

-- CreateIndex
CREATE INDEX "TelegramLinkToken_userId_expiresAt_idx" ON "TelegramLinkToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "OtpCode_userId_purpose_createdAt_idx" ON "OtpCode"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneE164_key" ON "User"("phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Activity_userId_waktuMulai_idx" ON "Activity"("userId", "waktuMulai");

-- CreateIndex
CREATE INDEX "Reminder_eventId_idx" ON "Reminder"("eventId");

-- CreateIndex
CREATE INDEX "Reminder_status_scheduledAt_idx" ON "Reminder"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_channel_status_idx" ON "Notification"("channel", "status");

-- AddForeignKey
ALTER TABLE "UsernameHistory" ADD CONSTRAINT "UsernameHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChannel" ADD CONSTRAINT "UserChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLinkToken" ADD CONSTRAINT "TelegramLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aturan Revisi 4 yang tidak dapat ditulis di Prisma schema
ALTER TABLE "Activity"
  ADD CONSTRAINT "Activity_kelipatan_5menit"
  CHECK (EXTRACT(SECOND FROM "waktuMulai")::int = 0 AND EXTRACT(MINUTE FROM "waktuMulai")::int % 5 = 0
     AND EXTRACT(SECOND FROM "waktuSelesai")::int = 0 AND EXTRACT(MINUTE FROM "waktuSelesai")::int % 5 = 0);

ALTER TABLE "Activity"
  ADD CONSTRAINT "Activity_durasi_wajar"
  CHECK ("waktuSelesai" > "waktuMulai" AND EXTRACT(EPOCH FROM ("waktuSelesai" - "waktuMulai")) / 60 BETWEEN 30 AND 180);

ALTER TABLE "Reminder"
  ADD CONSTRAINT "Reminder_satu_sumber"
  CHECK (("taskId" IS NOT NULL AND "eventId" IS NULL) OR ("taskId" IS NULL AND "eventId" IS NOT NULL));

ALTER TABLE "Reminder"
  ADD CONSTRAINT "Reminder_offset_kelipatan_5"
  CHECK ("offsetMinutes" > 0 AND "offsetMinutes" % 5 = 0);

ALTER TABLE "User"
  ADD CONSTRAINT "User_jam_tenang_wajar"
  CHECK (
    ("quietHoursStart" IS NULL OR "quietHoursStart" BETWEEN 0 AND 1439)
    AND ("quietHoursEnd" IS NULL OR "quietHoursEnd" BETWEEN 0 AND 1439)
  );
