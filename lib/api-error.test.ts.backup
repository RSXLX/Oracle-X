import { errorResponse } from '@/lib/api-error';

describe('errorResponse', () => {
  it('returns standardized payload and headers', async () => {
    const response = errorResponse(400, 'INVALID_PARAMETERS', 'Invalid parameters', 'req-1', 'symbol is required');

    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('X-Request-Id')).toBe('req-1');

    const json = await response.json();
    expect(json).toEqual({
      code: 'INVALID_PARAMETERS',
      error: 'Invalid parameters',
      detail: 'symbol is required',
      requestId: 'req-1',
    });
  });

  it('omits detail when not provided', async () => {
    const response = errorResponse(500, 'INTERNAL_ERROR', 'Internal server error', 'req-2');
    const json = await response.json();

    expect(json).toEqual({
      code: 'INTERNAL_ERROR',
      error: 'Internal server error',
      requestId: 'req-2',
    });
  });
});
