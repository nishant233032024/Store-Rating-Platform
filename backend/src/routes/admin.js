require('dotenv').config()

const express = require('express')
const bcrypt = require('bcrypt')

const router = express.Router()
const { query } = require('../db')
const { handleError } = require('../middleware/errorHandler')
const { validateRole } = require('../middleware/authorization')
const {
  createUserSchema,
  createStoreSchema,
  normalizeEmail,
  normalizeText,
  parsePagination,
  buildLikeFilters,
  ROLES,
} = require('../validation')

const USER_SORT_COLUMNS = {
  id: 'id',
  name: 'name',
  email: 'email',
  role: 'role',
  createdAt: '"createdAt"',
}

const STORE_SORT_COLUMNS = {
  id: 's.id',
  name: 's.name',
  email: 's.email',
  address: 's.address',
  rating: 's."averageRating"',
  ratingCount: 's."ratingCount"',
  createdAt: 's."createdAt"',
}

function sortClause(sortBy, sortOrder, columns, fallback) {
  const column = columns[sortBy] || fallback
  const direction = String(sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
  return `ORDER BY ${column} ${direction}, ${fallback} ASC`
}

// Dashboard totals
router.get('/dashboard', validateRole('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const [users, stores, ratings] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM "User"'),
      query('SELECT COUNT(*) AS count FROM "Store"'),
      query('SELECT COUNT(*) AS count FROM "Rating"'),
    ])

    return res.json({
      totalUsers: Number(users.rows[0].count),
      totalStores: Number(stores.rows[0].count),
      totalRatings: Number(ratings.rows[0].count),
    })
  } catch (error) {
    return handleError(res, error, 'GET /api/admin/dashboard')
  }
})

// List users with filtering, sorting and pagination
router.get('/users', validateRole('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { conditions, params } = buildLikeFilters(req.query, [
      { param: 'name', column: 'name' },
      { param: 'email', column: 'email' },
      { param: 'address', column: 'address' },
    ])

    const role = req.query.role
    if (typeof role === 'string' && ROLES.includes(role)) {
      params.push(role)
      conditions.push(`role = $${params.length}`)
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''

    const countResult = await query(`SELECT COUNT(*) AS total FROM "User"${where}`, params)
    const total = Number(countResult.rows[0].total)

    const order = sortClause(req.query.sortBy, req.query.sortOrder, USER_SORT_COLUMNS, 'id')
    const usersResult = await query(
      `SELECT id, name, email, address, role, "createdAt"
       FROM "User"${where}
       ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    )

    return res.json({
      users: usersResult.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return handleError(res, error, 'GET /api/admin/users')
  }
})

// Single user, including the assigned store for store owners
router.get('/users/:id', validateRole('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.address, u.role,
              s.id AS "storeId", s.name AS "storeName", s.email AS "storeEmail",
              s.address AS "storeAddress", s."averageRating" AS "storeAverageRating",
              agg."ratingTotal" AS "ratingTotal"
       FROM "User" u
       LEFT JOIN "Store" s ON u.id = s."ownerId"
       LEFT JOIN (
         SELECT "storeId", AVG("value") AS "ratingAverage", COUNT(*) AS "ratingTotal"
         FROM "Rating" GROUP BY "storeId"
       ) agg ON s.id = agg."storeId"
       WHERE u.id = $1`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = result.rows[0]
    const response = {
      id: user.id,
      name: user.name,
      email: user.email,
      address: user.address,
      role: user.role,
    }

    if (user.role === 'STORE_OWNER') {
      const ratingTotal = Number(user.ratingTotal || 0)
      response.assignedStore = {
        id: user.storeId,
        name: user.storeName,
        email: user.storeEmail,
        address: user.storeAddress,
        averageRating:
          ratingTotal > 0 && user.storeAverageRating !== null
            ? Number(user.storeAverageRating).toFixed(1)
            : 'Not rated yet',
        ratingCount: ratingTotal,
      }
    }

    return res.json({ user: response })
  } catch (error) {
    return handleError(res, error, 'GET /api/admin/users/:id')
  }
})

// Create a user of any role
router.post('/users', validateRole('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const body = createUserSchema.parse({
      ...req.body,
      name: normalizeText(req.body.name),
      address: normalizeText(req.body.address),
      email: normalizeEmail(req.body.email),
    })

    const email = normalizeEmail(body.email)
    const existing = await query('SELECT id FROM "User" WHERE LOWER(email) = LOWER($1)', [
      email,
    ])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10
    const passwordHash = await bcrypt.hash(body.password, saltRounds)

    const result = await query(
      `INSERT INTO "User" (name, email, "passwordHash", address, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, address, role, "createdAt"`,
      [body.name, email, passwordHash, body.address, body.role]
    )

    return res.status(201).json({ user: result.rows[0] })
  } catch (error) {
    return handleError(res, error, 'POST /api/admin/users')
  }
})

// List stores with filtering, sorting and pagination
router.get('/stores', validateRole('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { conditions, params } = buildLikeFilters(req.query, [
      { param: 'name', column: 's.name' },
      { param: 'email', column: 's.email' },
      { param: 'address', column: 's.address' },
    ])

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''

    const countResult = await query(`SELECT COUNT(*) AS total FROM "Store" s${where}`, params)
    const total = Number(countResult.rows[0].total)

    const order = sortClause(req.query.sortBy, req.query.sortOrder, STORE_SORT_COLUMNS, 's.id')
    const storesResult = await query(
      `SELECT s.id, s.name, s.email, s.address, s."averageRating", s."ratingCount",
              s."ownerId", u.name AS "ownerName"
       FROM "Store" s
       LEFT JOIN "User" u ON s."ownerId" = u.id
       ${where}
       ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    )

    const stores = storesResult.rows.map((store) => {
      const ratingCount = Number(store.ratingCount || 0)
      return {
        id: store.id,
        name: store.name,
        email: store.email,
        address: store.address,
        averageRating:
          ratingCount > 0 && store.averageRating !== null
            ? Number(store.averageRating).toFixed(1)
            : 'Not rated yet',
        ratingCount,
        ownerId:
          store.ownerId === null || store.ownerId === undefined ? null : Number(store.ownerId),
        ownerName: store.ownerName,
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
    return handleError(res, error, 'GET /api/admin/stores')
  }
})

// Create a store and assign it to an unassigned store owner
router.post('/stores', validateRole('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const body = createStoreSchema.parse({
      ...req.body,
      name: normalizeText(req.body.name),
      address: normalizeText(req.body.address),
      email: normalizeEmail(req.body.email),
    })

    const ownerResult = await query('SELECT id, role FROM "User" WHERE id = $1', [
      body.ownerId,
    ])

    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Owner not found' })
    }

    if (ownerResult.rows[0].role !== 'STORE_OWNER') {
      return res.status(400).json({ error: 'User is not a store owner' })
    }

    const existingStore = await query('SELECT id FROM "Store" WHERE "ownerId" = $1', [
      body.ownerId,
    ])
    if (existingStore.rows.length > 0) {
      return res.status(409).json({ error: 'Store owner already has a store assigned' })
    }

    const result = await query(
      `INSERT INTO "Store" (name, email, address, "ownerId", "averageRating", "ratingCount")
       VALUES ($1, $2, $3, $4, NULL, 0)
       RETURNING id, name, email, address, "averageRating", "ratingCount", "createdAt"`,
      [body.name, normalizeEmail(body.email), body.address, body.ownerId]
    )

    return res.status(201).json({ store: result.rows[0] })
  } catch (error) {
    return handleError(res, error, 'POST /api/admin/stores')
  }
})

// Store owners without a store yet
router.get('/store-owners/available', validateRole('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.address, u.role
       FROM "User" u
       LEFT JOIN "Store" s ON s."ownerId" = u.id
       WHERE u.role = 'STORE_OWNER' AND s.id IS NULL
       ORDER BY u.id ASC`
    )

    return res.json({ owners: result.rows })
  } catch (error) {
    return handleError(res, error, 'GET /api/admin/store-owners/available')
  }
})

module.exports = router
