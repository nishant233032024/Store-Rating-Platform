require('dotenv').config()

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const cookieParser = require('cookie-parser')

const { initDb, closeDb } = require('./db')
const { authenticate } = require('./middleware/authorization')
const errorHandler = require('./middleware/errorHandler')

const authRoutes = require('./routes/auth')
const adminRoutes = require('./routes/admin')
const userRoutes = require('./routes/user')
const ownerRoutes = require('./routes/owner')

// Fail fast with a clear message if DATABASE_URL is missing or unusable.
initDb()

const app = express()

// Render terminates TLS in front of the app. Without this, express-rate-limit
// rejects the X-Forwarded-For header and treats every client as the same IP.
app.set('trust proxy', 1)

app.disable('x-powered-by')
app.use(helmet())
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
)

// Rate limiting is a production concern; the integration suite makes far more
// than 100 requests and would otherwise throttle itself.
if (process.env.NODE_ENV !== 'test') {
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: true,
      legacyHeaders: false,
    })
  )
}

app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())

// Cookie-authenticated state changes must come from the configured frontend
// origin. Requests without an Origin header are still allowed for CLI clients
// and automated tests; browsers send Origin on cross-origin state changes.
app.use('/api', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next()

  const origin = req.get('origin')
  const configuredOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
  if (origin && origin !== configuredOrigin) {
    return res.status(403).json({ error: 'Untrusted request origin' })
  }

  return next()
})

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// Auth routes manage their own authentication (/login, /register, /me, /logout).
app.use('/api/auth', authRoutes)

// Every other API requires a valid session cookie.
app.use('/api/admin', authenticate, adminRoutes)
app.use('/api/user', authenticate, userRoutes)
app.use('/api/owner', authenticate, ownerRoutes)

app.use((req, res) => res.status(404).json({ error: 'Not found' }))
app.use(errorHandler)

if (require.main === module) {
  const port = Number(process.env.PORT) || 3001
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`)
  })

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`)
    server.close(() => {
      Promise.resolve(closeDb())
        .catch(() => {})
        .finally(() => process.exit(0))
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

module.exports = app
