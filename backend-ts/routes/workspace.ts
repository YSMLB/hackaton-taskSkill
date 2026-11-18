import { NextRequest, NextResponse } from 'next/server';
import { changeWorkspace, readWorkspace, sessionCookie, sessionLifetime, WorkspaceError } from '@backend/workspace';

const privateHeaders = { 'Cache-Control': 'private, no-store' };
const maxBodyBytes = 1024 * 1024;

function failure(error: unknown) {
  if (error instanceof WorkspaceError) return NextResponse.json({ message: error.message }, { status: error.status, headers: privateHeaders });
  console.error('StepFlow workspace request failed', error);
  return NextResponse.json({ message: 'Сервер не смог обработать запрос.' }, { status: 500, headers: privateHeaders });
}

export async function GET(request: NextRequest) {
  try { return NextResponse.json(readWorkspace(request.cookies.get(sessionCookie)?.value), { headers: privateHeaders }); }
  catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const site = request.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin' && site !== 'none') throw new WorkspaceError('Запрос должен быть отправлен из StepFlow.', 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new WorkspaceError('Ожидается JSON.', 415);
    if (Number(request.headers.get('content-length')) > maxBodyBytes) throw new WorkspaceError('Слишком большой запрос.', 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) throw new WorkspaceError('Слишком большой запрос.', 413);
    let payload: unknown;
    try { payload = JSON.parse(raw); }
    catch { throw new WorkspaceError('Некорректный JSON.'); }
    const { result, nextToken } = changeWorkspace(request.cookies.get(sessionCookie)?.value, payload);
    const response = NextResponse.json(result, { headers: privateHeaders });
    if (nextToken !== undefined) response.cookies.set(sessionCookie, nextToken || '', {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: nextToken ? sessionLifetime : 0,
      secure: request.nextUrl.protocol === 'https:',
    });
    return response;
  } catch (error) { return failure(error); }
}
