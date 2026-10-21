import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TARGET = (process.env.API_URL ?? process.env.API_PROXY_TARGET ?? '')
  .trim()
  .replace(/\/+$/, '');

async function proxy(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  if (!TARGET) {
    return NextResponse.json(
      {
        message:
          'Server API belum dikonfigurasi. Set environment API_URL di Vercel ke URL backend CampusFlow.',
      },
      { status: 503 },
    );
  }

  const target = `${TARGET}/${params.path.join('/')}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      {
        message:
          'Tidak dapat terhubung ke server API CampusFlow. Periksa nilai API_URL.',
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.delete('transfer-encoding');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
  proxy as HEAD,
};
