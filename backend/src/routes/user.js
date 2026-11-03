require('dotenv').config()

const express = require('express')
const bcrypt = require('bcrypt')

const router = express.Router()
const { query } = require('../db')
const { handleError } = require('../middleware/errorHandler')
const { authenticate, validateRole } = require('../middleware/authorization')
const {
  changePasswordSchema,
  ratingSchema,
  parsePagination,
  buildLikeFilters,
} = require('../validation')

// Store listing with the caller's own rating, filtering and pagination.
router.get('/stores', authenticate, async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)

    const countFilters = buildLikeFilters(
      req.query,
      [
        { param: 'name', column: 'name' },
        { param: 'address', column: 'address' },
      ],
      1
    )
    const listFilters = buildLikeFilters(
      req.query,
      [
        { param: 'name', column: 's.name' },
        { param: 'address', column: 's.address' },
      ],
      2 // $1 is the current user id
    )

    const countWhere =
      countFilters.conditions.length > 0 ? ` WHERE ${countFilters.conditions.join(' AND ')}` : ''
    const listWhere =
      listFilters.conditions.length > 0 ? ` WHERE ${listFilters.conditions.join(' AND ')}` : ''

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM "Store"${countWhere}`,
      countFilters.params
    )
    const total = Number(countResult.rows[0].total)

    const limitIndex = listFilters.params.length + 2
    const offsetIndex = listFilters.params.length + 3

    const storesResult = await query(
      `SELECT s.id, s.name, s.address, s."ratingCount",
              agg."ratingAverage" AS "averageRating",
              (SELECT r."value" FROM "Rating" r
                WHERE r."userId" = $1 AND r."storeId" = s.id) AS "myRating"
       FROM "Store" s
       LEFT JOIN (
         SELECT "storeId", AVG("value") AS "ratingAverage", COUNT(*) AS "ratingTotal"
         FROM "Rating" GROUP BY "storeId"
       ) agg ON agg."storeId" = s.id
       ${listWhere}
       ORDER BY s.name ASC, s.id ASC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      [req.user.userId, ...listFilters.params, limit, offset]
    )

    const stores = storesResult.rows.map((store) => {
      const ratingCount = Number(store.ratingCount || 0)
      return {
        id: store.id,
        name: store.name,
        address: store.address,
        averageRating:
          ratingCount > 0 && store.averageRating !== null
            ? Number(store.averageRating).toFixed(1)
            : 'Not rated yet',
        ratingCount,
        myRating: store.myRating === null || store.myRating === undefined ? null : Number(store.myRating),
      }
    })

    return res.json({
      stores,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return handleError(res, error, 'GET /api/user/stores')
  }
})

// Single store with the caller's own rating (used by the rating page).
router.get('/stores/:storeId', authenticate, async (req, res) => {
  try {
    const storeId = Number(req.params.storeId)
    if (!Number.isInteger(storeId) || storeId <= 0) {
      return res.status(400).json({ error: 'Invalid store id' })
    }

    const result = await query(
      `SELECT s.id, s.name, s.address, s."ratingCount",
              agg."ratingAverage" AS "averageRating",
              (SELECT r."value" FROM "Rating" r
                WHERE r."userId" = $1 AND r."storeId" = s.id) AS "myRating"
       FROM "Store" s
       LEFT JOIN (
         SELECT "storeId", AVG("value") AS "ratingAverage"
         FROM "Rating" GROUP BY "storeId"
       ) agg ON agg."storeId" = s.id
       WHERE s.id = $2`,
      [req.user.userId, storeId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' })
    }

    const store = result.rows[0]
    const ratingCount = Number(store.ratingCount || 0)

    return res.json({
      store: {
        id: store.id,
        name: store.name,
        address: store.address,
        averageRating:
          ratingCount > 0 && store.averageRating !== null
            ? Number(store.averageRating).toFixed(1)
            : 'Not rated yet',
        ratingCount,
        myRating:
          store.myRating === null || store.myRating === undefined ? null : Number(store.myRating),
      },
    })
  } catch (error) {
    return handleError(res, error, 'GET /api/user/stores/:storeId')
  }
})

// Submit or update the caller's rating for a store.
router.put('/stores/:storeId/rating', validateRole('NORMAL_USER'), async (req, res) => {
  try {
    const { value } = ratingSchema.parse({ value: req.body.value })
    const storeId = Number(req.params.storeId)
    const userId = req.user.userId

    const storeResult = await query('SELECT id FROM "Store" WHERE id = $1', [storeId])
    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' })
    }

    // The composite unique key makes this safe when two requests arrive at
    // the same time: one row is created, or the existing row is updated.
    await query(
      `INSERT INTO "Rating" ("userId", "storeId", "value")
       VALUES ($1, $2, $3)
       ON CONFLICT ("userId", "storeId") DO UPDATE
       SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
      [userId, storeId, value]
    )

    // Averages are always derived from the rating records.
    const aggregate = await query(
      'SELECT AVG("value") AS average, COUNT(*) AS count FROM "Rating" WHERE "storeId" = $1',
      [storeId]
    )
    const average = aggregate.rows[0].average === null ? 0 : Number(aggregate.rows[0].average)
    const ratingCount = Number(aggregate.rows[0].count)

    await query(
      `UPDATE "Store"
       SET "averageRating" = $1, "ratingCount" = $2, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [Number(average.toFixed(2)), ratingCount, storeId]
    )

    return res.json({
      rating: value,
      average: average.toFixed(1),
      ratingCount,
    })
  } catch (error) {
    return handleError(res, error, 'PUT /api/user/stores/:storeId/rating')
  }
})

// Change password; bumps authVersion so existing tokens stop working.
router.patch('/password', authenticate, async (req, res) => {
  try {
    const body = changePasswordSchema.parse(req.body)

    if (body.newPassword !== body.confirmNewPassword) {
      return res.status(400).json({ error: 'New passwords do not match' })
    }

    const userId = req.user.userId
    const userResult = await query('SELECT passwordHash FROM "User" WHERE id = $1', [userId])

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const validPassword = await bcrypt.compare(body.currentPassword, userResult.rows[0].passwordHash)
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' })
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10
    const newPasswordHash = await bcrypt.hash(body.newPassword, saltRounds)

    await query(
      `UPDATE "User"
       SET "passwordHash" = $1, "authVersion" = "authVersion" + 1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newPasswordHash, userId]
    )

    res.cookie('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })

    return res.json({ message: 'Password changed successfully. Please log in again.' })
  } catch (error) {
    return handleError(res, error, 'PATCH /api/user/password')
  }
})

module.exports = router
