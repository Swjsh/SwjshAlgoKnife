/**
 * Standardized API Error Handling Utility
 *
 * Provides consistent error response formats and helpers for all Next.js API routes.
 * Ensures predictable error handling across the entire API surface.
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Types
// ============================================================================

export interface ApiError {
  error: string;
  code: string;
  details?: string;
  timestamp: string;
}

// ============================================================================
// Core Error Response Builder
// ============================================================================

/**
 * Creates a standardized error response
 * @param message User-facing error message
 * @param code Machine-readable error code (e.g., "VALIDATION_FAILED", "NOT_FOUND")
 * @param status HTTP status code
 * @param details Optional technical details (hidden in production)
 * @returns NextResponse with consistent error format
 */
export function apiError(
  message: string,
  code: string,
  status: number,
  details?: string
): NextResponse<ApiError> {
  const response: ApiError = {
    error: message,
    code,
    timestamp: new Date().toISOString(),
  };

  // Include details only in development or if explicitly provided
  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

// ============================================================================
// HTTP Status Helpers
// ============================================================================

/**
 * 400 Bad Request — Invalid input or malformed request
 */
export function badRequest(message: string, details?: string): NextResponse<ApiError> {
  return apiError(message, 'BAD_REQUEST', 400, details);
}

/**
 * 401 Unauthorized — Missing or invalid authentication
 */
export function unauthorized(message?: string): NextResponse<ApiError> {
  return apiError(
    message || 'Authentication required',
    'UNAUTHORIZED',
    401
  );
}

/**
 * 403 Forbidden — Authenticated but insufficient permissions
 */
export function forbidden(message?: string): NextResponse<ApiError> {
  return apiError(
    message || 'Insufficient permissions',
    'FORBIDDEN',
    403
  );
}

/**
 * 404 Not Found — Resource doesn't exist
 */
export function notFound(resource?: string): NextResponse<ApiError> {
  const message = resource ? `${resource} not found` : 'Resource not found';
  return apiError(message, 'NOT_FOUND', 404);
}

/**
 * 409 Conflict — Request conflicts with current state
 */
export function conflict(message: string, details?: string): NextResponse<ApiError> {
  return apiError(message, 'CONFLICT', 409, details);
}

/**
 * 413 Payload Too Large — Request body exceeds size limit
 */
export function payloadTooLarge(message?: string, details?: string): NextResponse<ApiError> {
  return apiError(
    message || 'Request body too large',
    'PAYLOAD_TOO_LARGE',
    413,
    details
  );
}

/**
 * 429 Too Many Requests — Rate limit exceeded
 */
export function rateLimitExceeded(
  message?: string,
  retryAfter?: number
): NextResponse<ApiError> {
  const response = apiError(
    message || 'Rate limit exceeded. Please try again later.',
    'RATE_LIMIT_EXCEEDED',
    429
  );

  if (retryAfter) {
    response.headers.set('Retry-After', String(retryAfter));
  }

  return response;
}

/**
 * 500 Internal Server Error — Unexpected server error
 * Includes error message only in development
 */
export function serverError(error: unknown, details?: string): NextResponse<ApiError> {
  const message = 'Internal server error';
  let errorDetails = details;

  if (!errorDetails && error instanceof Error) {
    errorDetails = error.message;
  }

  return apiError(message, 'INTERNAL_SERVER_ERROR', 500, errorDetails);
}

/**
 * 503 Service Unavailable — Temporary service issue
 */
export function serviceUnavailable(message?: string): NextResponse<ApiError> {
  return apiError(
    message || 'Service temporarily unavailable',
    'SERVICE_UNAVAILABLE',
    503
  );
}

// ============================================================================
// Error Wrapper for Route Handlers
// ============================================================================

export interface ErrorHandlerOptions {
  logErrors?: boolean;
  routeName?: string;
}

/**
 * Wraps an async route handler with automatic error catching and logging
 *
 * Usage:
 *   export const POST = withErrorHandling(async (req) => {
 *     // Your handler code
 *     return NextResponse.json({ success: true });
 *   }, { routeName: '/api/my-endpoint' });
 *
 * @param handler The async route handler function
 * @param options Configuration (logErrors, routeName)
 * @returns Wrapped handler with error catching
 */
export function withErrorHandling(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: ErrorHandlerOptions = {}
): (req: NextRequest) => Promise<NextResponse> {
  const { logErrors = true, routeName = 'unknown' } = options;

  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(req);
    } catch (error) {
      if (logErrors) {
        console.error(`[API ${routeName}] Error:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          method: req.method,
          url: req.url,
        });
      }

      // Default to 500 server error
      return serverError(error);
    }
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Checks request Content-Length header against a max size
 * Returns error response if exceeded, otherwise null
 *
 * @param req The request object
 * @param maxBytes Maximum allowed size in bytes
 * @returns Error response if exceeded, null if within limits
 */
export function checkContentLength(
  req: NextRequest,
  maxBytes: number
): NextResponse<ApiError> | null {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxBytes) {
    return payloadTooLarge(
      `Request body too large (max ${Math.floor(maxBytes / 1024)}KB)`,
      `Content-Length: ${contentLength} bytes`
    );
  }
  return null;
}

/**
 * Validates that a required header exists
 * Returns error response if missing, otherwise null
 *
 * @param req The request object
 * @param headerName Name of the header (case-insensitive)
 * @returns Error response if missing, null if present
 */
export function checkRequiredHeader(
  req: NextRequest,
  headerName: string
): NextResponse<ApiError> | null {
  if (!req.headers.get(headerName)) {
    return badRequest(
      `Missing required header: ${headerName}`,
      `The request must include the ${headerName} header`
    );
  }
  return null;
}

/**
 * Validates that a required field exists in the body
 * Returns error response if missing, otherwise null
 *
 * @param body The request body object
 * @param fieldName Name of the required field
 * @returns Error response if missing, null if present
 */
export function checkRequiredField(
  body: any,
  fieldName: string
): NextResponse<ApiError> | null {
  if (body[fieldName] === undefined || body[fieldName] === null) {
    return badRequest(
      `Missing required field: ${fieldName}`,
      `The request body must include the ${fieldName} field`
    );
  }
  return null;
}

// ============================================================================
// Logging Helpers
// ============================================================================

/**
 * Logs an API error with structured context
 */
export function logApiError(
  routeName: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  console.error(`[API ${routeName}] Error`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Logs an API event with structured context
 */
export function logApiEvent(
  routeName: string,
  event: string,
  context?: Record<string, unknown>
): void {
  console.log(`[API ${routeName}] ${event}`, {
    ...context,
    timestamp: new Date().toISOString(),
  });
}
