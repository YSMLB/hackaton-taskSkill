import type { NextRequest } from 'next/server';
import { proxyBackend } from '@/lib/backend';

export function GET(request: NextRequest) {
  return proxyBackend(request, '/api/search');
}

export function POST(request: NextRequest) {
  return proxyBackend(request, '/api/search');
}
