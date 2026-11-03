import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RatingDisplay } from '../../components/RatingStars'

const EMPTY_FILTERS = { name: '', email: '', address: '' }

export default function AdminStoresTable() {
  const [stores, setStores] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sortBy, setSortBy] = useState('id')
  const [sortOrder, setSortOrder] = useState('asc')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const limit = 10

  useEffect(() => {
    let cancelled = false

    const loadStores = async () => {
      setLoading(true)
      setError('')

      try {
         const params = new URLSearchParams({ page: String(page), limit: String(limit), sortBy, sortOrder })
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value)
        })

        const response = await fetch(`/api/admin/stores?${params.toString()}`, {
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
  }, [page, filters, sortBy, sortOrder])

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
          <p className="text-sm text-gray-500">{total} registered stores</p>
        </div>
        <Link
          to="/admin/create-store"
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add store
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="font-medium text-gray-700" htmlFor="store-sort-by">Sort by</label>
        <select id="store-sort-by" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1) }} className="rounded-md border border-gray-300 px-3 py-2">
          <option value="id">Created order</option>
          <option value="name">Name</option>
          <option value="email">Email</option>
          <option value="address">Address</option>
          <option value="rating">Average rating</option>
          <option value="ratingCount">Rating count</option>
        </select>
        <select aria-label="Store sort direction" value={sortOrder} onChange={(event) => { setSortOrder(event.target.value); setPage(1) }} className="rounded-md border border-gray-300 px-3 py-2">
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mb-6 grid gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-3">
        {[
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'address', label: 'Address', type: 'text' },
        ].map((field) => (
          <div key={field.name}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{field.label}</label>
            <input
              type={field.type}
              name={field.name}
              value={filters[field.name]}
              onChange={handleFilterChange}
              placeholder={`Filter by ${field.label.toLowerCase()}`}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Average rating</th>
              <th className="px-4 py-3">Ratings</th>
              <th className="px-4 py-3">Owner</th>
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
                  <td className="px-4 py-3 text-sm text-gray-600">{store.email}</td>
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
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {store.ownerId ? (
                      <Link
                        to={`/admin/users/${store.ownerId}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {store.ownerName || 'View owner'}
                      </Link>
                    ) : (
                      <span className="text-gray-400">Unassigned</span>
                    )}
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
