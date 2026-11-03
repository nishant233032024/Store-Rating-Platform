import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import authStore, { homePathForRole } from '../../store/authStore'

const DEMO_ACCOUNTS = [
  { role: 'System Admin', email: 'admin@example.com', password: 'Admin123!' },
  { role: 'Normal User', email: 'user1@example.com', password: 'User123!' },
  { role: 'Store Owner', email: 'owner1@example.com', password: 'Owner123!' },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError((data && data.error) || 'Login failed')
        return
      }

      authStore.login(data.user)
      navigate(homePathForRole(data.user.role), { replace: true })
    } catch (err) {
      setError('Network error - is the API running?')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
      <form
        onSubmit={handleLogin}
        className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="mb-6 text-sm text-gray-500">Sign in to continue to your dashboard.</p>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Login'}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          No account?{' '}
          <Link to="/signup" className="font-medium text-blue-600 hover:underline">
            Sign up as a normal user
          </Link>
        </p>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Demo accounts</h2>
        <p className="mb-4 text-sm text-gray-500">
          Created by <code className="rounded bg-gray-100 px-1">npm run seed</code> in the
          backend.
        </p>

        <ul className="space-y-3">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email} className="rounded-md border border-gray-100 bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-800">{account.role}</p>
              <p className="text-sm text-gray-600">{account.email}</p>
              <p className="text-sm text-gray-600">{account.password}</p>
              <button
                type="button"
                onClick={() => {
                  setEmail(account.email)
                  setPassword(account.password)
                  setError('')
                }}
                className="mt-2 text-sm font-medium text-blue-600 hover:underline"
              >
                Use this account
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
