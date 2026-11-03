import React, { useEffect, useState } from 'react'

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

export default function StoreOwnerRaters() {
  const [raters, setRaters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')

  useEffect(() => {
    let cancelled = false

    const loadRaters = async () => {
      setLoading(true)
      setError('')

      try {
         const params = new URLSearchParams({ sortBy, sortOrder })
         const response = await fetch(`/api/owner/raters?${params.toString()}`, { credentials: 'include' })
        const data = await response.json().catch(() => null)

        if (cancelled) return

        if (!response.ok) {
          setError((data && data.error) || 'Failed to load ratings')
          return
        }

        setRaters(data.raters || [])
      } catch (err) {
        if (!cancelled) setError('Network error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRaters()
    return () => {
      cancelled = true
    }
  }, [sortBy, sortOrder])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ratings</h1>
        <p className="text-sm text-gray-500">
          Everyone who has rated your store. Emails and addresses are never exposed.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="font-medium text-gray-700" htmlFor="rater-sort-by">Sort by</label>
        <select id="rater-sort-by" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2">
          <option value="createdAt">Submitted date</option>
          <option value="updatedAt">Updated date</option>
          <option value="name">User name</option>
          <option value="rating">Rating</option>
        </select>
        <select aria-label="Rater sort direction" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2">
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading ratings…</p>
      ) : raters.length === 0 ? (
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
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {raters.map((rater) => (
                <tr key={rater.userId} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 text-sm text-gray-900">{rater.name}</td>
                  <td className="px-4 py-3 text-sm font-medium text-yellow-600">
                    {rater.rating} ★
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(rater.submittedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {rater.updatedAt ? formatDate(rater.updatedAt) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
