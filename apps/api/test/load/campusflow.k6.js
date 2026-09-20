import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.API_URL || 'http://localhost:3001/api';
const PASSWORD = 'Load1234!';

export const options = {
  scenarios: {
    smoke: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 20 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const users = [];
  for (let i = 1; i <= 60; i++) {
    const email = `load${i}@cf.test`;
    const nim = `L${String(i).padStart(8, '0')}`;
    const reg = http.post(
      `${BASE}/auth/register`,
      JSON.stringify({
        nim,
        nama: `Load User ${i}`,
        email,
        password: PASSWORD,
        prodi: 'Informatika',
        semester: 3,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    // 201 baru atau 409 sudah ada — kredensial tetap valid
    users.push({ email, nim, nama: `Load User ${i}` });
  }
  return users;
}

export default function (users) {
  const u = users[__VU - 1];
  const login = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: u.email, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, {
    'login 200': (r) => r.status === 200,
  });
  const token = login.json('accessToken');
  if (!token) return;

  const auth = { Authorization: `Bearer ${token}` };

  const health = http.get(`${BASE}/health`);
  check(health, { 'health ok': (r) => r.status === 200 });

  const me = http.get(`${BASE}/users/me`, { headers: auth });
  check(me, { 'me 200': (r) => r.status === 200 });

  const tasks = http.get(`${BASE}/tasks`, { headers: auth });
  check(tasks, { 'tasks 200': (r) => r.status === 200 });

  if (__ITER % 5 === 0) {
    const create = http.post(
      `${BASE}/tasks`,
      JSON.stringify({
        judul: `Tugas ${u.nim} iter ${__ITER}`,
        deadline: new Date(Date.now() + 7 * 86400_000).toISOString(),
        prioritas: 'SEDANG',
      }),
      { headers: { 'Content-Type': 'application/json', ...auth } },
    );
    check(create, { 'create task 201': (r) => r.status === 201 });
  }

  sleep(0.3);
}