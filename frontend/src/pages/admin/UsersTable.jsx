import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const ROLE_STYLES = {
  NORMAL_USER: 'bg-blue-100 text-blue-800',
  SYSTEM_ADMIN: 'bg-purple-100 text-purple-800',
  STORE_OWNER: 'bg-orange-100 text-orange-800',
}

const EMPTY_FILTERS = { name: '', email: '', address: '', role: '' }

export default function AdminUsersTable() {
  const [users, setUsers] = useState([])
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

    const loadUsers = async () => {
      setLoading(true)
      setError('')

      try {
         const params = new URLSearchParams({
           page: String(page),
           limit: String(limit),
           sortBy,
           sortOrder,
         })
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value)
        })

        const response = await fetch(`/api/admin/users?${params.toString()}`, {
          credentials: 'include',
        })
        const data = await response.json().catch(() => null)

        if (cancelled) return

        if (!response.ok) {
          setError((data && data.error) || 'Failed to load users')
          setUsers([])
          return
        }

        setUsers(data.users)
        setTotal(data.total)
        setTotalPages(Math.max(1, data.totalPages))
      } catch (err) {
        if (!cancelled) setError('Network error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadUsers()
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
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">{total} registered users</p>
        </div>
        <Link
          to="/admin/create-user"
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add user
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mb-6 grid gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
          <select
            name="role"
            value={filters.role}
            onChange={handleFilterChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">All roles</option>
            <option value="NORMAL_USER">Normal user</option>
            <option value="SYSTEM_ADMIN">System admin</option>
            <option value="STORE_OWNER">Store owner</option>
          </select>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="font-medium text-gray-700" htmlFor="user-sort-by">Sort by</label>
        <select id="user-sort-by" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1) }} className="rounded-md border border-gray-300 px-3 py-2">
          <option value="id">Created order</option>
          <option value="name">Name</option>
          <option value="email">Email</option>
          <option value="role">Role</option>
        </select>
        <select aria-label="User sort direction" value={sortOrder} onChange={(event) => { setSortOrder(event.target.value); setPage(1) }} className="rounded-md border border-gray-300 px-3 py-2">
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                  Loading users…
                </td>
              </tr>
            )}

            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                  No users match these filters.
                </td>
              </tr>
            )}

            {!loading &&
              users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{user.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600">
                    {user.address || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        ROLE_STYLES[user.role] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/users/${user.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      View
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
