import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

export default function StoreOwnerDashboard() {
  const [store, setStore] = useState(null)
  const [raters, setRaters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadDashboard = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch('/api/owner/dashboard', { credentials: 'include' })
        const data = await response.json().catch(() => null)

        if (cancelled) return

        if (!response.ok) {
          setError((data && data.error) || 'Failed to load dashboard')
          return
        }

        setStore(data.store)
        setRaters(data.raters || [])
      } catch (err) {
        if (!cancelled) setError('Network error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDashboard()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <p className="text-sm text-gray-500">Loading dashboard…</p>
  }

  if (error) {
    return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  }

  if (!store) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">No store assigned</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ask an administrator to create a store for your account.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Store dashboard</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Store</p>
            <p className="text-xl font-bold text-gray-900">{store.name}</p>
            <p className="text-sm text-gray-500">{store.address}</p>
          </div>

          <div className="flex gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Average rating
              </p>
              <p className="text-3xl font-bold text-yellow-600">
                {store.averageRating === 'Not rated yet'
                  ? 'Not rated yet'
                  : `${store.averageRating} ★`}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Total ratings
              </p>
              <p className="text-3xl font-bold text-purple-700">{store.ratingCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent ratings</h2>
          <Link to="/owner/raters" className="text-sm font-medium text-blue-600 hover:underline">
            View all
          </Link>
        </div>

        {raters.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">No ratings yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {raters.slice(0, 5).map((rater) => (
                  <tr key={rater.userId} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-sm text-gray-900">{rater.name}</td>
                    <td className="px-4 py-3 text-sm font-medium text-yellow-600">
                      {rater.rating} ★
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(rater.submittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
