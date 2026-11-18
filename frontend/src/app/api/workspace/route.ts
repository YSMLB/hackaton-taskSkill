import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest) {
  try {
    const url = `${BACKEND_URL}/api/workspace`;
    const headers = new Headers(request.headers);
    const res = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    const data = await res.text();
    const response = new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        ...privateHeaders,
      },
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      response.headers.set('set-cookie', setCookie);
    }
    return response;
  } catch (error) {
    console.error('StepFlow workspace GET proxy failed', error);
    return NextResponse.json({ message: 'Сервер не смог обработать запрос.' }, { status: 500, headers: privateHeaders });
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = `${BACKEND_URL}/api/workspace`;
    const headers = new Headers(request.headers);
    const body = await request.text();
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
    });
    const data = await res.text();
    const response = new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        ...privateHeaders,
      },
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      response.headers.set('set-cookie', setCookie);
    }
    return response;
  } catch (error) {
    console.error('StepFlow workspace POST proxy failed', error);
    return NextResponse.json({ message: 'Сервер не смог обработать запрос.' }, { status: 500, headers: privateHeaders });
  }
}
