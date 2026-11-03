const ROLES = ['NORMAL_USER', 'SYSTEM_ADMIN', 'STORE_OWNER']

/**
 * Thrown when request input fails validation. Carries per-field issues so the
 * error handler can return a useful 400 response.
 */
class ValidationError extends Error {
  constructor(issues) {
    super('Validation failed')
    this.name = 'ValidationError'
    this.issues = issues
  }
}

const ok = (value) => ({ ok: true, value })
const fail = (message) => ({ ok: false, message })

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---------- field validators ----------

function text({ label, min = 0, max = Infinity, required = true }) {
  return (raw) => {
    if (raw === undefined || raw === null || raw === '') {
      return required ? fail(`${label} is required`) : ok(undefined)
    }
    if (typeof raw !== 'string') return fail(`${label} must be text`)

    const value = raw.trim()
    if (required && value === '') return fail(`${label} is required`)
    if (value.length < min) return fail(`${label} must be at least ${min} characters`)
    if (value.length > max) return fail(`${label} must be at most ${max} characters`)

    return ok(value)
  }
}

function email({ label = 'Email' } = {}) {
  return (raw) => {
    if (typeof raw !== 'string' || raw.trim() === '') return fail(`${label} is required`)

    const value = raw.trim().toLowerCase()
    if (value.length > 255) return fail(`${label} must be at most 255 characters`)
    if (!EMAIL_PATTERN.test(value)) return fail('A valid email address is required')

    return ok(value)
  }
}

// 8-16 characters, at least one uppercase letter and one special character.
// Passwords are not trimmed: whitespace is significant.
function password({ label = 'Password' } = {}) {
  return (raw) => {
    if (typeof raw !== 'string' || raw === '') return fail(`${label} is required`)
    if (raw.length < 8) return fail(`${label} must be at least 8 characters`)
    if (raw.length > 16) return fail(`${label} must be at most 16 characters`)
    if (!/[A-Z]/.test(raw)) return fail(`${label} must contain at least one uppercase letter`)
    if (!/[^A-Za-z0-9]/.test(raw)) {
      return fail(`${label} must contain at least one special character`)
    }
    return ok(raw)
  }
}

function enumField(values, { label = 'Value' } = {}) {
  return (raw) => {
    if (raw === undefined || raw === null || raw === '') return fail(`${label} is required`)
    if (!values.includes(raw)) return fail(`${label} must be one of: ${values.join(', ')}`)
    return ok(raw)
  }
}

function integerRange(min, max, { label = 'Value' } = {}) {
  return (raw) => {
    if (typeof raw !== 'number' || Number.isNaN(raw)) return fail(`${label} must be a number`)
    if (!Number.isInteger(raw)) return fail(`${label} must be a whole number`)
    if (raw < min || raw > max) return fail(`${label} must be between ${min} and ${max}`)
    return ok(raw)
  }
}

function identifier({ label = 'ID' } = {}) {
  return (raw) => {
    const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return fail(`${label} is required`)
    }
    return ok(value)
  }
}

/**
 * Minimal schema object with the same shape the routes already use:
 *   schema.parse(input) -> normalized value, or throws ValidationError.
 * Unknown keys are dropped, which is what keeps role injection impossible.
 */
function schema(fields) {
  return {
    parse(input) {
      const source = input && typeof input === 'object' ? input : {}
      const value = {}
      const issues = []

      for (const [key, validate] of Object.entries(fields)) {
        const result = validate(source[key])
        if (result.ok) {
          if (result.value !== undefined) value[key] = result.value
        } else {
          issues.push({ path: [key], message: result.message })
        }
      }

      if (issues.length > 0) throw new ValidationError(issues)
      return value
    },
  }
}

// ---------- request schemas ----------

const registerSchema = schema({
  name: text({ label: 'Name', min: 20, max: 60 }),
  email: email(),
  address: text({ label: 'Address', min: 1, max: 400 }),
  password: password(),
})

// Login only checks presence: bcrypt decides whether the credentials are valid,
// so a wrong password is a 401 rather than a validation error.
const loginSchema = schema({
  email: schedulePresence('Email'),
  password: schedulePresence('Password'),
})

const changePasswordSchema = schema({
  currentPassword: schedulePresence('Current password'),
  newPassword: password({ label: 'New password' }),
  confirmNewPassword: schedulePresence('Password confirmation'),
})

const createUserSchema = schema({
  name: text({ label: 'Name', min: 20, max: 60 }),
  email: email(),
  password: password(),
  address: text({ label: 'Address', min: 1, max: 400 }),
  role: enumField(ROLES, { label: 'Role' }),
})

const createStoreSchema = schema({
  name: text({ label: 'Store name', min: 20, max: 60 }),
  email: email({ label: 'Store email' }),
  address: text({ label: 'Store address', min: 1, max: 400 }),
  ownerId: identifier({ label: 'A valid store owner' }),
})

const ratingSchema = schema({
  value: integerRange(1, 5, { label: 'Rating' }),
})

function schedulePresence(label) {
  return (raw) => {
    if (typeof raw !== 'string' || raw.trim() === '') return fail(`${label} is required`)
    return ok(label === 'Email' ? raw.trim().toLowerCase() : raw)
  }
}

// ---------- helpers ----------

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : value
}

function parsePagination(queryParams, defaultLimit = 10) {
  const page = Math.max(1, Number.parseInt(queryParams.page, 10) || 1)
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(queryParams.limit, 10) || defaultLimit)
  )
  return { page, limit, offset: (page - 1) * limit }
}

/**
 * Builds `LOWER(column) LIKE LOWER($n)` conditions with bound parameters.
 * User input is never interpolated into SQL.
 */
function buildLikeFilters(queryParams, fields, startIndex = 1) {
  const conditions = []
  const params = []

  for (const { param, column } of fields) {
    const raw = queryParams[param]
    if (typeof raw === 'string' && raw.trim() !== '') {
      params.push(`%${raw.trim()}%`)
      conditions.push(`LOWER(${column}) LIKE LOWER($${startIndex + params.length - 1})`)
    }
  }

  return { conditions, params }
}

module.exports = {
  ROLES,
  ValidationError,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  createUserSchema,
  createStoreSchema,
  ratingSchema,
  normalizeEmail,
  normalizeText,
  parsePagination,
  buildLikeFilters,
}
