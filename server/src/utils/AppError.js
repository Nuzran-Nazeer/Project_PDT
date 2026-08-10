// Domain error type. Services throw these; the error handler maps them to HTTP.
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // an expected, handled error (vs. a bug)
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
