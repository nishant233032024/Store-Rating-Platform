require('dotenv').config()

const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const router = express.Router()
const { query } = require('../db')
const { handleError } = require('../middleware/errorHandler')
const { authenticate } = require('../middleware/authorization')
const {
  registerSchema,
  loginSchema,
  normalizeEmail,
  normalizeText,
} = require('../validation')

function cookieOptions() {
  const maxAge = Number(process.env.COOKIE_MAX_AGE)
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  }
  if (Number.isFinite(maxAge) && maxAge > 0) options.maxAge = maxAge
  return options
}

function issueToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      authVersion: Number(user.authVersion || 0),
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  )
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    address: user.address,
    role: user.role,
  }
}

// Public signup - always creates a NORMAL_USER.
router.post('/register', async (req, res) => {
  try {
    const body = registerSchema.parse({
      ...req.body,
      name: normalizeText(req.body.name),
      address: normalizeText(req.body.address),
      email: normalizeEmail(req.body.email),
    })

    const email = normalizeEmail(body.email)

    const existing = await query('SELECT id FROM "User" WHERE LOWER(email) = LOWER($1)', [
      email,
    ])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10
    const passwordHash = await bcrypt.hash(body.password, saltRounds)

    // Role is hard-coded: a client-supplied role can never escalate privileges.
    const result = await query(
      `INSERT INTO "User" (name, email, "passwordHash", address, role)
       VALUES ($1, $2, $3, $4, 'NORMAL_USER')
       RETURNING id, name, email, address, role, "authVersion"`,
      [body.name, email, passwordHash, body.address]
    )

    const user = result.rows[0]
    res.cookie('token', issueToken(user), cookieOptions())
    return res.status(201).json({ user: publicUser(user) })
  } catch (error) {
    return handleError(res, error, 'POST /api/auth/register')
  }
})

router.post('/login', async (req, res) => {
  try {
    const body = loginSchema.parse(req.body)
    const email = normalizeEmail(body.email)

    const result = await query(
      'SELECT id, name, email, address, "passwordHash", role, "authVersion" FROM "User" WHERE LOWER(email) = LOWER($1)',
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const user = result.rows[0]
    const validPassword = await bcrypt.compare(body.password, user.passwordHash)

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    res.cookie('token', issueToken(user), cookieOptions())
    return res.json({ user: publicUser(user) })
  } catch (error) {
    return handleError(res, error, 'POST /api/auth/login')
  }
})

router.post('/logout', (req, res) => {
  res.cookie('token', '', { ...cookieOptions(), maxAge: 0 })
  return res.json({ message: 'Logged out' })
})

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, address, role FROM "User" WHERE id = $1',
      [req.user.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    return res.json({ user: publicUser(result.rows[0]) })
  } catch (error) {
    return handleError(res, error, 'GET /api/auth/me')
  }
})

module.exports = router
