/**
 * Request logging middleware
 * Logs important events and requests
 */

/**
 * Request logger middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Log request
  console.log({
    type: 'request',
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log({
      type: 'response',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  });

  next();
}

/**
 * Log important events
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export function logEvent(event, data = {}) {
  console.log({
    type: 'event',
    event,
    ...data,
    timestamp: new Date().toISOString(),
  });
}
