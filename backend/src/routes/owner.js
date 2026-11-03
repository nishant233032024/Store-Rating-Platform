require('dotenv').config()

const express = require('express')

const router = express.Router()
const { query } = require('../db')
const { handleError } = require('../middleware/errorHandler')
const { authenticate, validateRole } = require('../middleware/authorization')

async function loadStoreAndRaters(userId, sortBy = 'createdAt', sortOrder = 'desc') {
  const storeResult = await query(
    `SELECT id, name, email, address, "averageRating", "ratingCount"
     FROM "Store"
     WHERE "ownerId" = $1`,
    [userId]
  )

  if (storeResult.rows.length === 0) {
    return { store: null, raters: [] }
  }

  const store = storeResult.rows[0]

  // Raters are exposed without email or address.
  const sortColumns = {
    name: 'u.name',
    rating: 'r."value"',
    createdAt: 'r."createdAt"',
    updatedAt: 'r."updatedAt"',
  }
  const sortColumn = sortColumns[sortBy] || sortColumns.createdAt
  const direction = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC'

  const ratersResult = await query(
    `SELECT u.id AS "userId", u.name, r."value" AS rating, r."createdAt", r."updatedAt"
      FROM "Rating" r
      JOIN "User" u ON r."userId" = u.id
      WHERE r."storeId" = $1
      ORDER BY ${sortColumn} ${direction}, u.id ASC`,
    [store.id]
  )

  const ratingCount = Number(store.ratingCount || 0)

  return {
    store: {
      id: store.id,
      name: store.name,
      email: store.email,
      address: store.address,
      averageRating:
        ratingCount > 0 && store.averageRating !== null
          ? Number(store.averageRating).toFixed(1)
          : 'Not rated yet',
      ratingCount,
    },
    raters: ratersResult.rows.map((rater) => ({
      userId: rater.userId,
      name: rater.name,
      rating: Number(rater.rating),
      submittedAt: rater.createdAt,
      updatedAt: rater.updatedAt,
    })),
  }
}

router.get('/dashboard', validateRole('STORE_OWNER'), async (req, res) => {
  try {
    const { store, raters } = await loadStoreAndRaters(
      req.user.userId,
      req.query.sortBy,
      req.query.sortOrder
    )

    if (!store) {
      return res.json({ store: null, raters: [], emptyStore: true })
    }

    return res.json({ store, raters })
  } catch (error) {
    return handleError(res, error, 'GET /api/owner/dashboard')
  }
})

router.get('/raters', validateRole('STORE_OWNER'), async (req, res) => {
  try {
    const { store, raters } = await loadStoreAndRaters(
      req.user.userId,
      req.query.sortBy,
      req.query.sortOrder
    )
    return res.json({ store, raters })
  } catch (error) {
    return handleError(res, error, 'GET /api/owner/raters')
  }
})

module.exports = router
