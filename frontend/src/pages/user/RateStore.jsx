import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { validateRating } from '../../lib/validation'

const STARS = [1, 2, 3, 4, 5]

export default function RateStore() {
  const { storeId } = useParams()
  const navigate = useNavigate()

  const [store, setStore] = useState(null)
  const [value, setValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadStore = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/user/stores/${storeId}`, { credentials: 'include' })
        const data = await response.json().catch(() => null)

        if (cancelled) return

        if (!response.ok) {
          setError((data && data.error) || 'Failed to load store')
          return
        }

        setStore(data.store)
        setValue(data.store.myRating || 0)
      } catch (err) {
        if (!cancelled) setError('Network error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadStore()
    return () => {
      cancelled = true
    }
  }, [storeId])

  const handleSubmit = async (event) => {
    event.preventDefault()

    const ratingError = validateRating(value)
    if (ratingError) {
      setError(ratingError)
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // PUT creates the rating on first submission and updates it afterwards.
      const response = await fetch(`/api/user/stores/${storeId}/rating`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
        credentials: 'include',
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError((data && data.error) || 'Failed to save rating')
        return
      }

      setSuccess(
        `Rating saved. Store average is now ${data.average} from ${data.ratingCount} rating${
          data.ratingCount === 1 ? '' : 's'
        }.`
      )
      setStore((current) =>
        current
          ? { ...current, myRating: value, averageRating: data.average, ratingCount: data.ratingCount }
          : current
      )
    } catch (err) {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading store…</p>
  }

  if (error && !store) {
    return (
      <div>
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        <Link to="/user/stores" className="text-sm font-medium text-blue-600 hover:underline">
          Back to stores
        </Link>
      </div>
    )
  }

  if (!store) {
    return null
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link to="/user/stores" className="text-sm font-medium text-blue-600 hover:underline">
        ← Back to stores
      </Link>

      <form
        onSubmit={handleSubmit}
        className="mt-4 rounded-lg border border-gray-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
        <p className="mt-1 text-sm text-gray-500">{store.address}</p>

        <div className="mt-4 flex flex-wrap gap-6 rounded-md bg-gray-50 p-4 text-sm text-gray-700">
          <p>
            <span className="font-medium">Overall rating:</span>{' '}
            {store.averageRating === 'Not rated yet'
              ? 'Not rated yet'
              : `${store.averageRating} ★`}
          </p>
          <p>
            <span className="font-medium">Ratings:</span> {store.ratingCount}
          </p>
          <p>
            <span className="font-medium">Your rating:</span>{' '}
            {store.myRating ? `${store.myRating} ★` : 'Not rated'}
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {success && (
          <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>
        )}

        <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-medium text-gray-700">
            {store.myRating ? 'Update your rating' : 'Select a rating'}
          </legend>

          <div className="flex gap-2">
            {STARS.map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => {
                  setValue(star)
                  setError('')
                }}
                aria-label={`${star} star${star === 1 ? '' : 's'}`}
                aria-pressed={value === star}
                className={`h-11 w-11 rounded-md border text-lg font-semibold transition-colors ${
                  value >= star
                    ? 'border-yellow-400 bg-yellow-100 text-yellow-700'
                    : 'border-gray-300 bg-white text-gray-400 hover:bg-gray-50'
                }`}
              >
                ★
              </button>
            ))}
          </div>

          <p className="mt-2 text-sm text-gray-600">
            {value ? `You selected ${value} of 5.` : 'No rating selected yet.'}
          </p>
        </fieldset>

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={saving || value < 1}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : store.myRating ? 'Update rating' : 'Submit rating'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/user/stores')}
            className="rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
