import { NextRequest } from 'next/server';

export interface ApiErrorPayload {
  error: string;
  detail?: string;
  code: string;
  requestId: string;
}

export function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') || crypto.randomUUID();
}

export function errorResponse(
  status: number,
  code: string,
  error: string,
  requestId: string,
  detail?: string
): Response {
  const payload: ApiErrorPayload = {
    code,
    error,
    requestId,
    ...(detail ? { detail } : {}),
  };

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId,
    },
  });
}
