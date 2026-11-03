const { ValidationError } = require('../validation')

/**
 * Converts a thrown error into the project's consistent JSON error shape.
 * Used directly by route handlers and by the Express error middleware.
 */
function handleError(res, error, context) {
  if (error instanceof ValidationError || error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      issues: (error.issues || []).map((issue) => ({
        path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || ''),
        message: issue.message,
      })),
    })
  }

  const code = String(error.code || '')
  const message = String(error.message || '')

  // Unique constraint (Postgres 23505 / SQLite message)
  if (code === '23505' || /UNIQUE constraint failed/i.test(message)) {
    return res.status(409).json({ error: 'Duplicate value violates a unique constraint' })
  }

  // Foreign key violation (Postgres 23503 / SQLite message)
  if (code === '23503' || /FOREIGN KEY constraint failed/i.test(message)) {
    return res.status(400).json({ error: 'Referenced record does not exist' })
  }

  // Body-parser and other HTTP-aware errors
  const status = Number(error.status || error.statusCode)
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: message || 'Bad request' })
  }

  console.error(context ? `${context}:` : 'Unhandled error:', error)
  return res.status(500).json({ error: 'Internal server error' })
}

function errorHandler(err, req, res, next) {
  handleError(res, err)
}

module.exports = errorHandler
module.exports.handleError = handleError
