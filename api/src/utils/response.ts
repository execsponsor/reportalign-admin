/**
 * Response helpers for Azure Functions.
 * Ensures all responses have snake_case keys for the admin frontend.
 */

import { HttpResponseInit } from '@azure/functions';
import { camelToSnake } from './caseTransform';

export function jsonResponse(status: number, data: unknown): HttpResponseInit {
  return {
    status,
    jsonBody: {
      success: status >= 200 && status < 300,
      data: camelToSnake(data),
    },
  };
}

export function errorResponse(status: number, error: string): HttpResponseInit {
  return {
    status,
    jsonBody: { success: false, error },
  };
}
