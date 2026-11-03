import { useSyncExternalStore } from 'react'

/**
 * Tiny auth store.
 *
 * The HttpOnly session cookie is the source of truth, so the store keeps only a
 * copy of the current user for rendering. `init()` revalidates that copy against
 * GET /api/auth/me on every page load, which means a revoked or stale session is
 * reflected immediately instead of trusting anything cached in the browser.
 */
let currentUser = null
let initialised = false
const listeners = new Set()

function emit() {
  for (const listener of listeners) listener()
}

function setUser(user) {
  currentUser = user || null
  initialised = true
  emit()
}

async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'include', ...options })
  let data = null
  try {
    data = await response.json()
  } catch (error) {
    data = null
  }
  return { response, data }
}

export const HOME_PATHS = {
  SYSTEM_ADMIN: '/admin/dashboard',
  NORMAL_USER: '/user/stores',
  STORE_OWNER: '/owner/dashboard',
}

export function homePathForRole(role) {
  return HOME_PATHS[role] || '/login'
}

const authStore = {
  getUser() {
    return currentUser
  },

  isInitialised() {
    return initialised
  },

  isAuthenticated() {
    return Boolean(currentUser)
  },

  hasRole(role) {
    return Boolean(currentUser && currentUser.role === role)
  },

  hasAnyRole(roles) {
    return Boolean(currentUser && roles.includes(currentUser.role))
  },

  /** Revalidates the session cookie and returns the current user (or null). */
  async init() {
    try {
      const { response, data } = await request('/api/auth/me')
      setUser(response.ok && data ? data.user : null)
    } catch (error) {
      setUser(null)
    }
    return currentUser
  },

  /** Called after a successful login/signup response. */
  login(user) {
    setUser(user)
  },

  logout() {
    setUser(null)
    // Fire-and-forget: clearing the httpOnly cookie must happen server side.
    request('/api/auth/logout', { method: 'POST' }).catch(() => {})
  },

  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

/** Re-renders the calling component whenever the signed-in user changes. */
export function useAuth() {
  return useSyncExternalStore(authStore.subscribe, authStore.getUser, () => null)
}

export default authStore
