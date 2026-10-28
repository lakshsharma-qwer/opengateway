/** Uniform API error envelope: { error: { type, code, message, field } } */

export class ApiError extends Error {
  constructor(status, type, code, message, field = null, headers = null) {
    super(message);
    this.status = status;
    this.type = type;
    this.code = code;
    this.field = field;
    this.headers = headers;
  }
  toJSON() {
    return { error: { type: this.type, code: this.code, message: this.message, field: this.field ?? null } };
  }
}

export const badRequest = (code, message, field = null) =>
  new ApiError(400, 'invalid_request_error', code, message, field);
export const validation = (message, field = null) =>
  new ApiError(400, 'invalid_request_error', 'VALIDATION_ERROR', message, field);
export const unauthorized = (code = 'UNAUTHENTICATED', message = 'Authentication required') =>
  new ApiError(401, 'authentication_error', code, message);
export const forbidden = (code = 'FORBIDDEN', message = 'You do not have permission to perform this action') =>
  new ApiError(403, 'authentication_error', code, message);
export const notFound = (message = 'The requested resource was not found', code = 'NOT_FOUND') =>
  new ApiError(404, 'not_found_error', code, message);
export const conflict = (code, message, field = null) =>
  new ApiError(409, 'conflict_error', code, message, field);
export const rateLimited = (retryAfter) =>
  new ApiError(429, 'rate_limit_error', 'RATE_LIMITED', 'Too many requests, slow down', null, {
    'Retry-After': String(retryAfter),
  });

export function sendError(res, err) {
  if (err.headers) res.set(err.headers);
  res.status(err.status).json(err.toJSON());
}

/** Strip secrets (observer tokens etc.) from a URL before it is logged. */
export function redactUrl(url) {
  return String(url || '').replace(/([?&](?:token|key_secret|secret|password)=)[^&#]*/gi, '$1[redacted]');
}

/** Express error middleware. Never leaks stack traces or internals to the client. */
export function errorHandler(err, req, res, _next) {
  if (res.headersSent) {
    try { res.destroy(); } catch {}
    return;
  }
  if (err instanceof ApiError) return sendError(res, err);
  if (err?.type === 'entity.parse.failed') return sendError(res, validation('Request body is not valid JSON'));
  if (err?.type === 'entity.too.large') {
    return sendError(res, new ApiError(413, 'invalid_request_error', 'PAYLOAD_TOO_LARGE', 'Request body is too large'));
  }
  if (err?.code === 'ERR_SQLITE_ERROR') {
    const primary = Number(err.errcode) & 0xff;
    if (primary === 5 || primary === 6) { // SQLITE_BUSY / SQLITE_LOCKED
      return sendError(res, new ApiError(503, 'api_error', 'SERVICE_BUSY', 'The service is busy, please retry', null, { 'Retry-After': '1' }));
    }
    if (primary === 19) { // SQLITE_CONSTRAINT (e.g. a unique race)
      return sendError(res, conflict('CONFLICT', 'The request conflicts with the current state of the resource'));
    }
  }
  if (err?.status >= 400 && err?.status < 500) {
    return sendError(res, new ApiError(err.status, 'invalid_request_error', 'BAD_REQUEST', 'Bad request'));
  }
  console.error('[error]', req.method, redactUrl(req.originalUrl), err);
  sendError(res, new ApiError(500, 'api_error', 'INTERNAL_ERROR', 'Something went wrong on our side'));
}
