import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import authStore from '../../store/authStore'
import { validateAddress, validateName, validatePassword } from '../../lib/validation'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSignup = async (event) => {
    event.preventDefault()
    setError('')

    const validationError =
      validateName(name) || validateAddress(address) || validatePassword(password)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, address, password }),
        credentials: 'include',
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError((data && data.error) || 'Signup failed')
        return
      }

      // Public signup always creates a NORMAL_USER.
      authStore.login(data.user)
      navigate('/user/stores', { replace: true })
    } catch (err) {
      setError('Network error - is the API running?')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <form
        onSubmit={handleSignup}
        className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Create an account</h1>
        <p className="mb-6 text-sm text-gray-500">
          Public signup creates a normal user account.
        </p>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Name <span className="text-gray-400">(20-60 characters)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={20}
              maxLength={60}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

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
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Address <span className="text-gray-400">(max 400 characters)</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
              maxLength={400}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Password <span className="text-gray-400">(8-16 characters)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              maxLength={16}
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <p className="mt-1 text-xs text-gray-500">
              At least one uppercase letter and one special character.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  )
}
