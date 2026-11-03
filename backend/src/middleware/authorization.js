const jwt = require('jsonwebtoken')
const { query } = require('../db')

/**
 * Verifies the JWT from the HttpOnly cookie and reloads the user so that
 * role changes and password changes (authVersion bump) take effect
 * immediately, in the backend, for every protected route.
 */
async function authenticate(req, res, next) {
  const token = req.cookies && req.cookies.token

  if (!token) {
    return res.status(401).json({ error: 'Unauthenticated - no token' })
  }

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    return res.status(401).json({ error: 'Unauthenticated - invalid token' })
  }

  try {
    const result = await query(
      'SELECT id, role, "authVersion" FROM "User" WHERE id = $1',
      [decoded.userId]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthenticated - user no longer exists' })
    }

    const user = result.rows[0]
    const tokenVersion = Number(decoded.authVersion || 0)

    if (tokenVersion !== Number(user.authVersion || 0)) {
      return res.status(401).json({ error: 'Unauthenticated - session expired' })
    }

    req.user = {
      userId: user.id,
      role: user.role,
    }
    return next()
  } catch (error) {
    return next(error)
  }
}

/**
 * Restricts a route to the given roles.
 * Accepts either validateRole('SYSTEM_ADMIN') or validateRole(['SYSTEM_ADMIN']).
 */
function validateRole(...allowedRoles) {
  const allowed = allowedRoles.flat()

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' })
    }

    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden - insufficient role' })
    }

    return next()
  }
}

module.exports = {
  authenticate,
  validateRole,
}
