import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";

// This is a global error handler middleware.
// Express identifies it as an error handler because it has FOUR parameters.
// The first one being "err" — Express will only call this when an error is thrown or
// passed via next(error) anywhere in the app.
const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check if the error is one we threw intentionally using ApiError.
  // If so, we already have a statusCode and message ready to use.
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  // If we reach here, it's an unexpected error — something we didn't anticipate.
  // Examples: database crashes, null reference errors, third-party API failures.
  // We log the full error for debugging but send a generic message to the client.
  // Never expose raw error details to the client in production — it's a security risk.
  console.error("Unexpected error:", err);

  res.status(500).json({
    success: false,
    message: "Something went wrong. Please try again later.",
    statusCode: 500,
  });
};

export default errorHandler;
