export function validateName(value, label = 'Name') {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return `${label} is required`
  if (trimmed.length < 20) return `${label} must be at least 20 characters`
  if (trimmed.length > 60) return `${label} must be at most 60 characters`
  return ''
}

export function validateAddress(value, label = 'Address') {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return `${label} is required`
  if (trimmed.length > 400) return `${label} must be at most 400 characters`
  return ''
}

export function validatePassword(value, label = 'Password') {
  if (typeof value !== 'string' || value.length === 0) return `${label} is required`
  if (value.length < 8) return `${label} must be at least 8 characters`
  if (value.length > 16) return `${label} must be at most 16 characters`
  if (!/[A-Z]/.test(value)) return `${label} must contain an uppercase letter`
  if (!/[^A-Za-z0-9]/.test(value)) return `${label} must contain a special character`
  return ''
}

export function validateRating(value) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return 'Rating must be a whole number from 1 to 5'
  }
  return ''
}
