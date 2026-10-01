export type OtpPurpose =
  | 'REGISTER'
  | 'LOGIN_PERANGKAT_BARU'
  | 'LUPA_SANDI'
  | 'GANTI_USERNAME'
  | 'GANTI_NOMOR';

export type ReminderSumber = 'TUGAS' | 'AKTIVITAS';

export interface TelegramStatus {
  terhubung: boolean;
  chatId: string | null;
  username: string | null;
  optedIn: boolean;
  verifiedAt: string | null;
}

export interface TelegramLinkResponse {
  url: string;
  expiresAt: string;
}

export interface OtpRequestResponse {
  terkirim: boolean;
  expiresAt: string;
  cooldownDetik: number;
  percobaanMaks: number;
}

export interface HariIniItem {
  jam: string;
  jenis: 'AKTIVITAS' | 'TUGAS';
  judul: string;
  detail: string | null;
}
