// ApiError extends the built-in JavaScript Error class.
// The reason we extend Error (instead of just returning a plain object) is so we
// can use "throw new ApiError()" anywhere in the app — services, controllers, etc.
// It will bubble up and get caught by the global error handler middleware.

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    // Call the parent Error constructor with the message.
    // This sets this.message and the stack trace automatically.
    super(message);

    this.statusCode = statusCode;

    // This fixes the prototype chain when extending built-in classes in TypeScript.
    // Without it, "instanceof ApiError" checks can fail in some environments.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
