import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { validateAddress, validateName } from '../../lib/validation'

const EMPTY_FORM = { name: '', email: '', address: '', ownerId: '' }

export default function AdminCreateStore() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [owners, setOwners] = useState([])
  const [loadingOwners, setLoadingOwners] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadOwners = async () => {
      setLoadingOwners(true)
      try {
        const response = await fetch('/api/admin/store-owners/available', {
          credentials: 'include',
        })
        const data = await response.json().catch(() => null)
        if (cancelled) return
        if (response.ok && data) setOwners(data.owners)
      } catch (err) {
        if (!cancelled) setError('Could not load store owners')
      } finally {
        if (!cancelled) setLoadingOwners(false)
      }
    }

    loadOwners()
    return () => {
      cancelled = true
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const validationError = validateName(form.name, 'Store name') || validateAddress(form.address, 'Store address')
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ownerId: Number(form.ownerId) }),
        credentials: 'include',
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError((data && data.error) || 'Failed to create store')
        return
      }

      setSuccess(`Created ${data.store.name}`)
      setForm(EMPTY_FORM)
      // The owner now has a store, so drop them from the available list.
      setOwners((current) => current.filter((owner) => String(owner.id) !== String(form.ownerId)))
    } catch (err) {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <form
        onSubmit={handleCreate}
        className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Add store</h1>
        <p className="mb-6 text-sm text-gray-500">
          Each store is assigned to a store owner without one.
        </p>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {success && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Store name <span className="text-gray-400">(20-60 characters)</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              minLength={20}
              maxLength={60}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Store email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Store address <span className="text-gray-400">(max 400 characters)</span>
            </label>
            <input
              type="text"
              name="address"
              value={form.address}
              onChange={handleChange}
              required
              maxLength={400}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Store owner</label>
            <select
              name="ownerId"
              value={form.ownerId}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Select an owner…</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name} ({owner.email})
                </option>
              ))}
            </select>
            {loadingOwners && <p className="mt-1 text-xs text-gray-500">Loading owners…</p>}
            {!loadingOwners && owners.length === 0 && (
              <p className="mt-1 text-xs text-orange-600">
                No store owner is free. Create one from “Add user” first.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || loadingOwners || owners.length === 0}
            className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create store'}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link to="/admin/stores" className="font-medium text-blue-600 hover:underline">
            Back to stores
          </Link>
        </p>
      </form>
    </div>
  )
}
