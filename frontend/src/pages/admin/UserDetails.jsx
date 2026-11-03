import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const ROLE_STYLES = {
  NORMAL_USER: 'bg-blue-100 text-blue-800',
  SYSTEM_ADMIN: 'bg-purple-100 text-purple-800',
  STORE_OWNER: 'bg-orange-100 text-orange-800',
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-base text-gray-900">{value || '-'}</p>
    </div>
  )
}

export default function AdminUserDetails() {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadUser = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/admin/users/${id}`, { credentials: 'include' })
        const data = await response.json().catch(() => null)

        if (cancelled) return

        if (!response.ok) {
          setError((data && data.error) || 'Failed to load user')
          return
        }

        setUser(data.user)
      } catch (err) {
        if (!cancelled) setError('Network error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadUser()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return <p className="text-sm text-gray-500">Loading user…</p>
  }

  if (error) {
    return (
      <div>
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        <Link to="/admin/users" className="text-sm font-medium text-blue-600 hover:underline">
          Back to users
        </Link>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const store = user.assignedStore

  return (
    <div>
      <div className="mb-6">
        <Link to="/admin/users" className="text-sm font-medium text-blue-600 hover:underline">
          ← Back to users
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{user.name}</h1>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Name" value={user.name} />
          <Field label="Email" value={user.email} />
          <Field label="Address" value={user.address} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Role</p>
            <p className="mt-1">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  ROLE_STYLES[user.role] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {user.role}
              </span>
            </p>
          </div>
        </div>

        {user.role === 'STORE_OWNER' && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Assigned store</h2>

            {store ? (
              <div className="grid gap-4 rounded-md bg-gray-50 p-4 sm:grid-cols-2">
                <Field label="Store name" value={store.name} />
                <Field label="Store email" value={store.email} />
                <Field label="Store address" value={store.address} />
                <Field
                  label="Average rating"
                  value={
                    store.averageRating === 'Not rated yet'
                      ? 'Not rated yet'
                      : `${store.averageRating} ★ (${store.ratingCount} rating${
                          store.ratingCount === 1 ? '' : 's'
                        })`
                  }
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500">This owner has no store assigned yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
