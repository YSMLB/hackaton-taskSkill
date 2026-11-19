import 'server-only';
import type { NextRequest } from 'next/server';
import { aiDisabledCookie } from './ai-cookie';

export function backendURL(path: string) {
  return new URL(path, process.env.STEPFLOW_BACKEND_URL || 'http://127.0.0.1:8080');
}

export async function proxyBackend(request: NextRequest, path: string) {
  if ((path === '/api/search' || path.startsWith('/api/ai/')) && request.cookies.get(aiDisabledCookie)?.value === '1') {
    return Response.json({ configured: false, message: 'ИИ отключён в настройках сайта.' }, {
      status: request.method === 'GET' ? 200 : 403,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  const headers = new Headers();
  for (const key of ['content-type', 'sec-fetch-site']) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  const token = request.cookies.get('stepflow-session')?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) headers.set('cookie', 'stepflow-session=' + token);
  const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
  headers.set('x-forwarded-proto', protocol);
  const init: RequestInit & { duplex: 'half' } = {
    method: request.method, headers, body: request.body, duplex: 'half',
    cache: 'no-store', redirect: 'error', signal: request.signal,
  };
  try {
    const result = await fetch(backendURL(path), init);
    const responseHeaders = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' });
    for (const cookie of result.headers.getSetCookie()) responseHeaders.append('Set-Cookie', cookie);
    return new Response(result.body, { status: result.status, headers: responseHeaders });
  } catch {
    return Response.json({ message: 'Сервер StepFlow недоступен. Попробуй ещё раз.' }, { status: 502 });
  }
}
