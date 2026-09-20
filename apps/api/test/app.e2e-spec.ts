import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('CampusFlow API (e2e)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let token = '';

  const unique = `e2e${Date.now()}`;
  const EMAIL = `${unique}@cf.test`;
  const NIM = `E${unique.slice(-8)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
    server = app.getHttpServer();
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health -> status ok', async () => {
    const res = await request(server).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('menolak /api/users/me tanpa token (401)', async () => {
    await request(server).get('/api/users/me').expect(401);
  });

  it('registrasi mahasiswa baru', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({
        nim: NIM,
        nama: 'E2E Test',
        email: EMAIL,
        password: 'Passw0rd!',
        prodi: 'Ilmu Komputer',
        semester: 3,
      })
      .expect(201);
    expect(res.body.user.role).toBe('MAHASISWA');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeUndefined();
    token = res.body.accessToken;
  });

  it('GET /api/users/me memuat profil', async () => {
    const res = await request(server)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.nim).toBe(NIM);
    expect(res.body.email).toBe(EMAIL);
  });

  it('CRUD mata kuliah + tugas menjaga owner', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const course = await request(server)
      .post('/api/courses')
      .set(auth)
      .send({ kode: 'E4001', namaMatkul: 'Jaringan', sks: 3, dosen: 'Dosen E2E' })
      .expect(201);
    const courseId = course.body.id;

    const task = await request(server)
      .post('/api/tasks')
      .set(auth)
      .send({
        judul: 'Tugas e2e',
        deskripsi: 'dibuat saat test',
        deadline: new Date(Date.now() + 86400_000).toISOString(),
        prioritas: 'TINGGI',
        courseId,
      })
      .expect(201);
    expect(task.body.courseId).toBe(courseId);

    const list = await request(server).get('/api/tasks').set(auth).expect(200);
    const created = list.body.find((t: { id: string }) => t.id === task.body.id);
    expect(created).toBeDefined();
    expect(created.judul).toBe('Tugas e2e');
  });

  it('preferensi notifikasi default + patching', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const def = await request(server)
      .get('/api/notifications/preferences')
      .set(auth)
      .expect(200);
    expect(def.body.pushEnabled).toBe(true);

    await request(server)
      .patch('/api/notifications/preferences')
      .set(auth)
      .send({ pushEnabled: false })
      .expect(200);
    const after = await request(server)
      .get('/api/notifications/preferences')
      .set(auth)
      .expect(200);
    expect(after.body.pushEnabled).toBe(false);
  });

  it('admin khusus role ADMIN -> mahasiswa kena 403', async () => {
    await request(server)
      .get('/api/admin/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('komentar: buat, baca, edit, hapus', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const task = await request(server)
      .post('/api/tasks')
      .set(auth)
      .send({
        judul: 'Tugas diskusi',
        deadline: new Date(Date.now() + 86400_000).toISOString(),
        prioritas: 'SEDANG',
      })
      .expect(201);
    const taskId = task.body.id;

    const created = await request(server)
      .post('/api/comments')
      .set(auth)
      .send({ taskId, isi: 'Komentar e2e #1' })
      .expect(201);
    expect(created.body.user.nama).toBe('E2E Test');

    const list = await request(server)
      .get(`/api/comments?taskId=${taskId}`)
      .set(auth)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const updated = await request(server)
      .patch(`/api/comments/${created.body.id}`)
      .set(auth)
      .send({ isi: 'Komentar e2e #2 (edited)' })
      .expect(200);
    expect(updated.body.isi).toBe('Komentar e2e #2 (edited)');

    await request(server)
      .delete(`/api/comments/${created.body.id}`)
      .set(auth)
      .expect(200);

    const empty = await request(server)
      .get(`/api/comments?taskId=${taskId}`)
      .set(auth)
      .expect(200);
    expect(empty.body).toHaveLength(0);
  });

  it('lampiran: unggah, list, unduh, hapus', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const task = await request(server)
      .post('/api/tasks')
      .set(auth)
      .send({
        judul: 'Tugas lampiran',
        deadline: new Date(Date.now() + 86400_000).toISOString(),
        prioritas: 'SEDANG',
      })
      .expect(201);
    const taskId = task.body.id;

    const up = await request(server)
      .post(`/api/tasks/${taskId}/attachments`)
      .set(auth)
      .attach('file', Buffer.from('isi lampiran e2e'), 'catatan.txt')
      .expect(201);
    expect(up.body.fileName).toBe('catatan.txt');
    expect(up.body.fileSize).toBe(Buffer.byteLength('isi lampiran e2e'));

    const list = await request(server)
      .get(`/api/tasks/${taskId}/attachments`)
      .set(auth)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const dl = await request(server)
      .get(`/api/attachments/${up.body.id}/file`)
      .set(auth)
      .expect(200);
    expect(dl.text).toBe('isi lampiran e2e');

    await request(server)
      .delete(`/api/attachments/${up.body.id}`)
      .set(auth)
      .expect(200);

    const empty = await request(server)
      .get(`/api/tasks/${taskId}/attachments`)
      .set(auth)
      .expect(200);
    expect(empty.body).toHaveLength(0);
  });
});