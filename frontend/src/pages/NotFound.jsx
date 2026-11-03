import React from 'react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">404</h1>
      <p className="mb-6 text-sm text-gray-600">The page you are looking for does not exist.</p>
      <Link to="/" className="font-medium text-blue-600 hover:underline">
        Go to my dashboard
      </Link>
    </div>
  )
}
