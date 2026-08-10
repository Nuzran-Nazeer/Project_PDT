// Wraps an async route handler so rejected promises flow to the error handler.
// Removes the need for try/catch in every controller.
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
