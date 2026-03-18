import { Response } from "express";

// Describes the shape of the optional pagination object.
// The "?" means every field is optional when building the object,
// but once passed in, they are all expected.
interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// A single function that sends every success response in the app.
// - res        → the Express response object
// - statusCode → HTTP status (200, 201, etc.)
// - message    → human-readable description
// - data       → the actual payload (object, array, or nothing)
// - pagination → optional, only included on list responses
export const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data?: unknown,
  pagination?: Pagination
) => {
  // Build the response body.
  // We use a typed object so the shape is always predictable.
  const body: Record<string, unknown> = {
    success: true,
    message,
  };

  // Only include "data" if something was passed in.
  // This avoids returning "data: undefined" on responses that have no payload.
  if (data !== undefined) {
    body.data = data;
  }

  // Only include "pagination" if it was passed in.
  // Single-item responses (create, update, get one) will never include this.
  if (pagination !== undefined) {
    body.pagination = pagination;
  }

  res.status(statusCode).json(body);
};
