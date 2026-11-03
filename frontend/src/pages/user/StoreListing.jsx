import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RatingDisplay } from '../../components/RatingStars'

export default function NormalUserStoreListing() {
  const [stores, setStores] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({ name: '', address: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const limit = 10

  useEffect(() => {
    let cancelled = false

    const loadStores = async () => {
      setLoading(true)
      setError('')

      try {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) })
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value)
        })

        const response = await fetch(`/api/user/stores?${params.toString()}`, {
          credentials: 'include',
        })
        const data = await response.json().catch(() => null)

        if (cancelled) return

        if (!response.ok) {
          setError((data && data.error) || 'Failed to load stores')
          setStores([])
          return
        }

        setStores(data.stores)
        setTotal(data.total)
        setTotalPages(Math.max(1, data.totalPages))
      } catch (err) {
        if (!cancelled) setError('Network error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadStores()
    return () => {
      cancelled = true
    }
  }, [page, filters])

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
        <p className="text-sm text-gray-500">
          {total} store{total === 1 ? '' : 's'} available to rate.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mb-6 grid gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Store name</label>
          <input
            type="text"
            name="name"
            value={filters.name}
            onChange={handleFilterChange}
            placeholder="Filter by store name"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
          <input
            type="text"
            name="address"
            value={filters.address}
            onChange={handleFilterChange}
            placeholder="Filter by address"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Overall rating</th>
              <th className="px-4 py-3">Ratings</th>
              <th className="px-4 py-3">Your rating</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                  Loading stores…
                </td>
              </tr>
            )}

            {!loading && stores.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                  No stores match these filters.
                </td>
              </tr>
            )}

            {!loading &&
              stores.map((store) => (
                <tr key={store.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{store.name}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600">
                    {store.address || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {store.averageRating === 'Not rated yet' ? (
                      <span className="text-gray-500">Not rated yet</span>
                    ) : (
                      <span className="font-medium text-yellow-600">
                        <RatingDisplay value={store.averageRating} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{store.ratingCount}</td>
                  <td className="px-4 py-3 text-sm">
                    {store.myRating ? (
                      <span className="font-medium text-blue-700">
                        <RatingDisplay value={store.myRating} />
                      </span>
                    ) : (
                      <span className="text-gray-400">Not rated</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      to={`/user/store/${store.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {store.myRating ? 'Change rating' : 'Rate store'}
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || loading}
            className="rounded-md border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-100 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages || loading}
            className="rounded-md border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-100 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
