import React from 'react'
import { Link } from 'react-router-dom'

export default function Unauthorized() {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Not allowed</h1>
      <p className="mb-6 text-sm text-gray-600">
        Your role does not have access to this page.
      </p>
      <Link to="/" className="font-medium text-blue-600 hover:underline">
        Go to my dashboard
      </Link>
    </div>
  )
}
