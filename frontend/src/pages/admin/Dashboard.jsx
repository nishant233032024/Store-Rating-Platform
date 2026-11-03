import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  const [totals, setTotals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch('/api/admin/dashboard', { credentials: 'include' })
        const data = await response.json().catch(() => null)

        if (cancelled) return

        if (!response.ok) {
          setError((data && data.error) || 'Failed to load dashboard')
          return
        }

        setTotals(data)
      } catch (err) {
        if (!cancelled) setError('Network error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const cards = [
    { label: 'Total users', value: totals?.totalUsers, href: '/admin/users', tone: 'bg-blue-50 text-blue-700' },
    { label: 'Total stores', value: totals?.totalStores, href: '/admin/stores', tone: 'bg-green-50 text-green-700' },
    { label: 'Total ratings', value: totals?.totalRatings, href: '/admin/stores', tone: 'bg-purple-50 text-purple-700' },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin dashboard</h1>
          <p className="text-sm text-gray-500">Platform totals across all users and stores.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/create-user"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add user
          </Link>
          <Link
            to="/admin/create-store"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Add store
          </Link>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.href}
            className={`rounded-lg border border-gray-200 p-6 shadow-sm transition-shadow hover:shadow-md ${card.tone}`}
          >
            <p className="text-3xl font-bold">
              {loading ? '—' : card.value ?? 0}
            </p>
            <p className="mt-1 text-sm font-medium">{card.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
