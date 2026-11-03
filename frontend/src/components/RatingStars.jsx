function formatRating(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return ''

  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1)
}

export function RatingStars({ value, className = '' }) {
  const numericValue = Number(value)
  const rating = Number.isFinite(numericValue) ? Math.max(0, Math.min(5, numericValue)) : 0
  const fillWidth = `${(rating / 5) * 100}%`

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      aria-label={`${formatRating(rating)} out of 5 stars`}
    >
      <span className="relative inline-block leading-none" aria-hidden="true">
        <span className="text-gray-300">★★★★★</span>
        <span
          className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-yellow-500"
          style={{ width: fillWidth }}
        >
          ★★★★★
        </span>
      </span>
    </span>
  )
}

export function RatingDisplay({ value, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span>{formatRating(value)}</span>
      <RatingStars value={value} />
    </span>
  )
}
