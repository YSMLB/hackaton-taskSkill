import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/search`, {
      headers: request.headers,
      cache: 'no-store',
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ configured: false }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const res = await fetch(`${BACKEND_URL}/api/search`, {
      method: 'POST',
      headers: request.headers,
      body,
      cache: 'no-store',
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'Сервис ИИ-поиска сейчас недоступен. Попробуй поиск по словам.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
