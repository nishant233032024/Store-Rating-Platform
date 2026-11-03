/**
 * Backend integration tests.
 *
 * Runs the real Express app over HTTP against Node's built-in SQLite driver,
 * so no external database, supertest or jest install is required.
 *
 *   cd backend && npm test
 */

const { test, describe, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')

// Configure the environment before the app is required.
// dotenv never overrides variables that already exist, so these win over .env.
const dbFile = path.join(os.tmpdir(), `store-rating-tests-${process.pid}.db`)
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = `sqlite:${dbFile}`
process.env.JWT_SECRET = 'integration-test-secret'
process.env.JWT_EXPIRES_IN = '1h'
process.env.COOKIE_MAX_AGE = '3600000'
process.env.BCRYPT_SALT_ROUNDS = '4'

const bcrypt = require('bcrypt')
const app = require('../src/server')
const { query, closeDb } = require('../src/db')

const PASSWORD = 'TestPass1!'

let server
let baseUrl
let sequence = 0

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  await closeDb()
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(`${dbFile}${suffix}`, { force: true })
    } catch (error) {
      // best effort cleanup
    }
  }
})

beforeEach(async () => {
  await query('DELETE FROM "Rating"')
  await query('DELETE FROM "Store"')
  await query('DELETE FROM "User"')
  try {
    await query(`DELETE FROM sqlite_sequence WHERE name IN ('User', 'Store', 'Rating')`)
  } catch (error) {
    // sqlite_sequence only exists once an AUTOINCREMENT row has been written
  }
})

// ---------- helpers ----------

async function api(method, routePath, { body, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.cookie = `token=${token}`

  const response = await fetch(`${baseUrl}${routePath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  let parsed = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      parsed = text
    }
  }

  return {
    status: response.status,
    body: parsed,
    setCookies: response.headers.getSetCookie(),
  }
}

function tokenFrom(response) {
  const cookie = response.setCookies.find((value) => value.startsWith('token='))
  if (!cookie) return null
  const value = cookie.slice('token='.length).split(';')[0]
  return value === '' ? null : value
}

function nextId() {
  sequence += 1
  return sequence
}

async function createUser({ role = 'NORMAL_USER', password = PASSWORD, name, email } = {}) {
  const id = nextId()
  const userName = name || `Integration Test User ${String(id).padStart(3, '0')}`
  const userEmail = email || `user${id}@example.com`
  const passwordHash = await bcrypt.hash(password, 4)

  const result = await query(
    `INSERT INTO "User" (name, email, passwordHash, address, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userName, userEmail, passwordHash, '1 Integration Street', role]
  )

  return { id: result.rows[0].id, email: userEmail, password, name: userName, role }
}

async function loginAs(user) {
  const response = await api('POST', '/api/auth/login', {
    body: { email: user.email, password: user.password },
  })
  assert.equal(response.status, 200, `login failed: ${JSON.stringify(response.body)}`)
  return tokenFrom(response)
}

async function createStoreFor(owner, overrides = {}) {
  const id = nextId()
  const name = overrides.name || `Integration Test Store ${String(id).padStart(3, '0')}`

  const result = await query(
    `INSERT INTO "Store" (name, email, address, "ownerId")
     VALUES ($1, $2, $3, $4)
     RETURNING id, name`,
    [
      name,
      overrides.email || `store${id}@example.com`,
      overrides.address || '10 Integration Avenue',
      owner ? owner.id : null,
    ]
  )

  return result.rows[0]
}

async function registerUser(email, overrides = {}) {
  const response = await api('POST', '/api/auth/register', {
    body: {
      name: 'Signup Test User Account',
      address: '5 Signup Street',
      password: PASSWORD,
      ...overrides,
      email,
    },
  })
  return { response, token: tokenFrom(response) }
}

async function countRows(table) {
  const result = await query(`SELECT COUNT(*) AS count FROM "${table}"`)
  return Number(result.rows[0].count)
}

// ---------- authentication ----------

describe('Authentication and signup', () => {
  test('public signup creates a NORMAL_USER and sets an HttpOnly cookie', async () => {
    const { response, token } = await registerUser('newuser@example.com')

    assert.equal(response.status, 201)
    assert.equal(response.body.user.role, 'NORMAL_USER')
    assert.equal(response.body.user.email, 'newuser@example.com')
    assert.equal(response.body.user.passwordHash, undefined, 'password hash must never be returned')
    assert.ok(token, 'signup must set a session cookie')

    const cookieHeader = response.setCookies.find((value) => value.startsWith('token='))
    assert.match(cookieHeader, /HttpOnly/i)

    const me = await api('GET', '/api/auth/me', { token })
    assert.equal(me.status, 200)
    assert.equal(me.body.user.email, 'newuser@example.com')
  })

  test('a client-supplied role cannot escalate privileges on signup', async () => {
    const { response } = await registerUser('escalate@example.com', { role: 'SYSTEM_ADMIN' })
    assert.equal(response.status, 201)
    assert.equal(response.body.user.role, 'NORMAL_USER')

    const row = await query('SELECT role FROM "User" WHERE email = $1', ['escalate@example.com'])
    assert.equal(row.rows[0].role, 'NORMAL_USER')
  })

  test('name must be between 20 and 60 characters', async () => {
    const short = await registerUser('short@example.com', { name: 'A'.repeat(19) })
    assert.equal(short.response.status, 400)

    const lowerBound = await registerUser('lower@example.com', { name: 'A'.repeat(20) })
    assert.equal(lowerBound.response.status, 201)

    const tooLong = await registerUser('long@example.com', { name: 'A'.repeat(61) })
    assert.equal(tooLong.response.status, 400)
  })

  test('names are trimmed before validation', async () => {
    const { response } = await registerUser('trimmed@example.com', {
      name: `   ${'B'.repeat(20)}   `,
    })
    assert.equal(response.status, 201)
    assert.equal(response.body.user.name, 'B'.repeat(20))
  })

  test('passwords must be 8-16 chars with an uppercase letter and a special character', async () => {
    const tooShort = await registerUser('pw1@example.com', { password: 'Ab1!xyz' })
    assert.equal(tooShort.response.status, 400)

    const noUppercase = await registerUser('pw2@example.com', { password: 'alllower1!' })
    assert.equal(noUppercase.response.status, 400)

    const noSpecial = await registerUser('pw3@example.com', { password: 'NoSpecial123' })
    assert.equal(noSpecial.response.status, 400)

    const tooLong = await registerUser('pw4@example.com', { password: `${'A'.repeat(16)}!` })
    assert.equal(tooLong.response.status, 400)

    const valid = await registerUser('pw5@example.com', { password: 'GoodPass1!' })
    assert.equal(valid.response.status, 201)
  })

  test('invalid email formats are rejected', async () => {
    const { response } = await registerUser('not-an-email')
    assert.equal(response.status, 400)
  })

  test('duplicate emails are rejected regardless of casing', async () => {
    const first = await registerUser('CaseTest@example.com')
    assert.equal(first.response.status, 201)

    const duplicate = await registerUser('casetest@example.com')
    assert.equal(duplicate.response.status, 409)
  })

  test('address is required and capped at 400 characters', async () => {
    const blank = await registerUser('blank@example.com', { address: '    ' })
    assert.equal(blank.response.status, 400)

    const tooLong = await registerUser('addr@example.com', { address: 'A'.repeat(401) })
    assert.equal(tooLong.response.status, 400)
  })

  test('login rejects a wrong password and unknown accounts', async () => {
    const user = await createUser({ email: 'login@example.com' })

    const wrong = await api('POST', '/api/auth/login', {
      body: { email: user.email, password: 'WrongPass1!' },
    })
    assert.equal(wrong.status, 401)

    const unknown = await api('POST', '/api/auth/login', {
      body: { email: 'nobody@example.com', password: PASSWORD },
    })
    assert.equal(unknown.status, 401)
  })

  test('login succeeds and /me requires a session', async () => {
    const user = await createUser({ email: 'session@example.com' })
    const token = await loginAs(user)
    assert.ok(token)

    const me = await api('GET', '/api/auth/me', { token })
    assert.equal(me.status, 200)
    assert.equal(me.body.user.email, 'session@example.com')

    const anonymous = await api('GET', '/api/auth/me')
    assert.equal(anonymous.status, 401)
  })

  test('logout clears the session cookie', async () => {
    const user = await createUser({ email: 'logout@example.com' })
    const token = await loginAs(user)

    const response = await api('POST', '/api/auth/logout', { token })
    assert.equal(response.status, 200)
    assert.equal(tokenFrom(response), null)
  })
})

// ---------- authorization ----------

describe('Role authorization', () => {
  test('protected routes reject unauthenticated requests', async () => {
    for (const routePath of ['/api/user/stores', '/api/admin/dashboard', '/api/owner/dashboard']) {
      const response = await api('GET', routePath)
      assert.equal(response.status, 401, `${routePath} should require authentication`)
    }
  })

  test('normal users and store owners cannot reach admin endpoints', async () => {
    const normalUser = await createUser({ role: 'NORMAL_USER' })
    const owner = await createUser({ role: 'STORE_OWNER' })

    for (const user of [normalUser, owner]) {
      const token = await loginAs(user)
      for (const routePath of ['/api/admin/dashboard', '/api/admin/users', '/api/admin/stores']) {
        const response = await api('GET', routePath, { token })
        assert.equal(response.status, 403, `${user.role} should not reach ${routePath}`)
      }
    }
  })

  test('admin dashboard reports totals across all roles', async () => {
    const admin = await createUser({ role: 'SYSTEM_ADMIN' })
    await createUser({ role: 'NORMAL_USER' })
    await createUser({ role: 'NORMAL_USER' })
    const owner = await createUser({ role: 'STORE_OWNER' })
    const store = await createStoreFor(owner)

    const rater = await createUser({ role: 'NORMAL_USER' })
    await query('INSERT INTO "Rating" ("userId", "storeId", "value") VALUES ($1, $2, $3)', [
      rater.id,
      store.id,
      4,
    ])

    const token = await loginAs(admin)
    const response = await api('GET', '/api/admin/dashboard', { token })

    assert.equal(response.status, 200)
    assert.deepEqual(response.body, { totalUsers: 5, totalStores: 1, totalRatings: 1 })
  })

  test('only admins can create privileged accounts', async () => {
    const admin = await createUser({ role: 'SYSTEM_ADMIN' })
    const normalUser = await createUser({ role: 'NORMAL_USER' })

    const payload = {
      name: 'Created Store Owner Account',
      email: 'created-owner@example.com',
      password: 'OwnerPass1!',
      address: '12 Created Street',
      role: 'STORE_OWNER',
    }

    const forbidden = await api('POST', '/api/admin/users', {
      body: payload,
      token: await loginAs(normalUser),
    })
    assert.equal(forbidden.status, 403)

    const created = await api('POST', '/api/admin/users', {
      body: payload,
      token: await loginAs(admin),
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.user.role, 'STORE_OWNER')
    assert.equal(created.body.user.passwordHash, undefined)
  })

  test('store creation requires an unassigned store owner', async () => {
    const admin = await createUser({ role: 'SYSTEM_ADMIN' })
    const adminToken = await loginAs(admin)
    const normalUser = await createUser({ role: 'NORMAL_USER' })
    const owner = await createUser({ role: 'STORE_OWNER' })

    const notAnOwner = await api('POST', '/api/admin/stores', {
      token: adminToken,
      body: {
        name: 'Invalid Owner Store Name',
        email: 'store-x@example.com',
        address: '14 Store Street',
        ownerId: normalUser.id,
      },
    })
    assert.equal(notAnOwner.status, 400)

    const created = await api('POST', '/api/admin/stores', {
      token: adminToken,
      body: {
        name: 'Valid Owner Store Name',
        email: 'store-y@example.com',
        address: '15 Store Street',
        ownerId: owner.id,
      },
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.store.name, 'Valid Owner Store Name')

    const duplicate = await api('POST', '/api/admin/stores', {
      token: adminToken,
      body: {
        name: 'Second Store Same Owner',
        email: 'store-z@example.com',
        address: '16 Store Street',
        ownerId: owner.id,
      },
    })
    assert.equal(duplicate.status, 409)
  })

  test('store owners only ever see their own store', async () => {
    const ownerOne = await createUser({ role: 'STORE_OWNER' })
    const ownerTwo = await createUser({ role: 'STORE_OWNER' })
    const storeOne = await createStoreFor(ownerOne, { name: 'Owner One Coffee House' })
    await createStoreFor(ownerTwo, { name: 'Owner Two Coffee House' })

    const token = await loginAs(ownerOne)
    const response = await api('GET', '/api/owner/dashboard', { token })

    assert.equal(response.status, 200)
    assert.equal(response.body.store.id, storeOne.id)
    assert.equal(response.body.store.name, 'Owner One Coffee House')
  })

  test('owner rater lists exclude user email and address', async () => {
    const owner = await createUser({ role: 'STORE_OWNER' })
    const store = await createStoreFor(owner)
    const rater = await createUser({ role: 'NORMAL_USER', email: 'rater@example.com' })

    const raterToken = await loginAs(rater)
    const rated = await api('PUT', `/api/user/stores/${store.id}/rating`, {
      token: raterToken,
      body: { value: 4 },
    })
    assert.equal(rated.status, 200)

    const token = await loginAs(owner)
    const response = await api('GET', '/api/owner/raters', { token })

    assert.equal(response.status, 200)
    assert.equal(response.body.raters.length, 1)
    const [entry] = response.body.raters
    assert.equal(entry.name, rater.name)
    assert.equal(entry.rating, 4)
    assert.deepEqual(Object.keys(entry).sort(), [
      'name',
      'rating',
      'submittedAt',
      'updatedAt',
      'userId',
    ])
  })

  test('admin user details include the assigned store', async () => {
    const admin = await createUser({ role: 'SYSTEM_ADMIN' })
    const owner = await createUser({ role: 'STORE_OWNER' })
    const store = await createStoreFor(owner, { name: 'Details Coffee Roasters' })

    const token = await loginAs(admin)
    const response = await api('GET', `/api/admin/users/${owner.id}`, { token })

    assert.equal(response.status, 200)
    assert.equal(response.body.user.role, 'STORE_OWNER')
    assert.equal(response.body.user.assignedStore.id, store.id)
    assert.equal(response.body.user.assignedStore.averageRating, 'Not rated yet')
    assert.equal(response.body.user.assignedStore.ratingCount, 0)
  })
})

// ---------- ratings ----------

describe('Rating behavior', () => {
  test('first rating creates a single record', async () => {
    const store = await createStoreFor(null)
    const user = await createUser({ role: 'NORMAL_USER' })
    const token = await loginAs(user)

    const response = await api('PUT', `/api/user/stores/${store.id}/rating`, {
      token,
      body: { value: 5 },
    })

    assert.equal(response.status, 200)
    assert.deepEqual(response.body, { rating: 5, average: '5.0', ratingCount: 1 })
    assert.equal(await countRows('Rating'), 1)
  })

  test('re-submitting updates the existing rating instead of adding a record', async () => {
    const store = await createStoreFor(null)
    const user = await createUser({ role: 'NORMAL_USER' })
    const token = await loginAs(user)

    await api('PUT', `/api/user/stores/${store.id}/rating`, { token, body: { value: 5 } })
    const second = await api('PUT', `/api/user/stores/${store.id}/rating`, {
      token,
      body: { value: 3 },
    })

    assert.equal(second.status, 200)
    assert.deepEqual(second.body, { rating: 3, average: '3.0', ratingCount: 1 })
    assert.equal(await countRows('Rating'), 1)

    const stored = await query('SELECT "value" FROM "Rating" WHERE "storeId" = $1', [store.id])
    assert.equal(Number(stored.rows[0].value), 3)
  })

  test('the average across users is rounded to one decimal place', async () => {
    const store = await createStoreFor(null)
    const first = await createUser({ role: 'NORMAL_USER' })
    const second = await createUser({ role: 'NORMAL_USER' })

    await api('PUT', `/api/user/stores/${store.id}/rating`, {
      token: await loginAs(first),
      body: { value: 5 },
    })
    const response = await api('PUT', `/api/user/stores/${store.id}/rating`, {
      token: await loginAs(second),
      body: { value: 4 },
    })

    assert.equal(response.status, 200)
    assert.deepEqual(response.body, { rating: 4, average: '4.5', ratingCount: 2 })
    assert.equal(await countRows('Rating'), 2)
  })

  test('ratings outside 1-5, fractions and non-numbers are rejected', async () => {
    const store = await createStoreFor(null)
    const user = await createUser({ role: 'NORMAL_USER' })
    const token = await loginAs(user)

    for (const value of [0, 6, -1, 2.5, '5', null]) {
      const response = await api('PUT', `/api/user/stores/${store.id}/rating`, {
        token,
        body: { value },
      })
      assert.equal(response.status, 400, `value ${JSON.stringify(value)} should be rejected`)
    }

    assert.equal(await countRows('Rating'), 0)
  })

  test('rating an unknown store returns 404', async () => {
    const user = await createUser({ role: 'NORMAL_USER' })
    const token = await loginAs(user)

    const response = await api('PUT', '/api/user/stores/99999/rating', {
      token,
      body: { value: 4 },
    })
    assert.equal(response.status, 404)
  })

  test('only normal users may submit ratings', async () => {
    const store = await createStoreFor(null)

    for (const role of ['SYSTEM_ADMIN', 'STORE_OWNER']) {
      const user = await createUser({ role })
      const response = await api('PUT', `/api/user/stores/${store.id}/rating`, {
        token: await loginAs(user),
        body: { value: 4 },
      })
      assert.equal(response.status, 403, `${role} should not be able to rate stores`)
    }
  })

  test('unrated stores show "Not rated yet" and the caller rating is returned', async () => {
    const store = await createStoreFor(null)
    const user = await createUser({ role: 'NORMAL_USER' })
    const token = await loginAs(user)

    const before = await api('GET', '/api/user/stores', { token })
    const unrated = before.body.stores.find((entry) => entry.id === store.id)
    assert.equal(unrated.averageRating, 'Not rated yet')
    assert.equal(unrated.ratingCount, 0)
    assert.equal(unrated.myRating, null)

    await api('PUT', `/api/user/stores/${store.id}/rating`, { token, body: { value: 2 } })

    const after = await api('GET', '/api/user/stores', { token })
    const rated = after.body.stores.find((entry) => entry.id === store.id)
    assert.equal(rated.averageRating, '2.0')
    assert.equal(rated.ratingCount, 1)
    assert.equal(rated.myRating, 2)
  })
})

// ---------- password change ----------

describe('Password change', () => {
  test('the current password must be correct', async () => {
    const user = await createUser({ email: 'pwd@example.com' })
    const token = await loginAs(user)

    const response = await api('PATCH', '/api/user/password', {
      token,
      body: {
        currentPassword: 'WrongPass1!',
        newPassword: 'NewPass1!',
        confirmNewPassword: 'NewPass1!',
      },
    })
    assert.equal(response.status, 400)
  })

  test('the confirmation must match the new password', async () => {
    const user = await createUser({ email: 'pwd2@example.com' })
    const token = await loginAs(user)

    const response = await api('PATCH', '/api/user/password', {
      token,
      body: {
        currentPassword: PASSWORD,
        newPassword: 'NewPass1!',
        confirmNewPassword: 'OtherPass1!',
      },
    })
    assert.equal(response.status, 400)
  })

  test('changing the password invalidates existing sessions', async () => {
    const user = await createUser({ email: 'pwd3@example.com' })
    const token = await loginAs(user)

    const change = await api('PATCH', '/api/user/password', {
      token,
      body: {
        currentPassword: PASSWORD,
        newPassword: 'NewPass1!',
        confirmNewPassword: 'NewPass1!',
      },
    })
    assert.equal(change.status, 200)

    const staleSession = await api('GET', '/api/auth/me', { token })
    assert.equal(staleSession.status, 401)

    const oldPassword = await api('POST', '/api/auth/login', {
      body: { email: user.email, password: PASSWORD },
    })
    assert.equal(oldPassword.status, 401)

    const newPassword = await api('POST', '/api/auth/login', {
      body: { email: user.email, password: 'NewPass1!' },
    })
    assert.equal(newPassword.status, 200)
  })
})

// ---------- listing ----------

describe('Listing, filtering and pagination', () => {
  test('admin user listing filters by role and name and paginates', async () => {
    const admin = await createUser({ role: 'SYSTEM_ADMIN' })
    await createUser({ role: 'NORMAL_USER', name: 'Alice Anderson Longname', email: 'alice@example.com' })
    await createUser({ role: 'NORMAL_USER', name: 'Bob Brown Senior Person', email: 'bob@example.com' })
    await createUser({ role: 'STORE_OWNER', name: 'Carol Clark Senior Person', email: 'carol@example.com' })

    const token = await loginAs(admin)

    const byRole = await api('GET', '/api/admin/users?role=STORE_OWNER', { token })
    assert.equal(byRole.status, 200)
    assert.equal(byRole.body.total, 1)
    assert.equal(byRole.body.users[0].email, 'carol@example.com')

    const byName = await api('GET', '/api/admin/users?name=Alice', { token })
    assert.equal(byName.body.total, 1)
    assert.equal(byName.body.users[0].email, 'alice@example.com')

    const paged = await api('GET', '/api/admin/users?page=2&limit=2', { token })
    assert.equal(paged.body.page, 2)
    assert.equal(paged.body.limit, 2)
    assert.equal(paged.body.total, 4)
    assert.equal(paged.body.totalPages, 2)
    assert.equal(paged.body.users.length, 2)
  })

  test('admin store listing filters by name', async () => {
    const admin = await createUser({ role: 'SYSTEM_ADMIN' })
    const firstOwner = await createUser({ role: 'STORE_OWNER' })
    const secondOwner = await createUser({ role: 'STORE_OWNER' })
    await createStoreFor(firstOwner, { name: 'Downtown Coffee Roasters' })
    await createStoreFor(secondOwner, { name: 'Uptown Coffee Roasters' })

    const token = await loginAs(admin)
    const response = await api('GET', '/api/admin/stores?name=Uptown', { token })

    assert.equal(response.status, 200)
    assert.equal(response.body.total, 1)
    assert.equal(response.body.stores[0].name, 'Uptown Coffee Roasters')
    assert.equal(response.body.stores[0].averageRating, 'Not rated yet')
  })

  test('an unknown sort field falls back instead of failing', async () => {
    const admin = await createUser({ role: 'SYSTEM_ADMIN' })
    const token = await loginAs(admin)

    const users = await api('GET', '/api/admin/users?sortBy=passwordHash&sortOrder=sideways', {
      token,
    })
    assert.equal(users.status, 200)

    const stores = await api('GET', '/api/admin/stores?sortBy=ownerName', { token })
    assert.equal(stores.status, 200)
  })

  test('normal user store listing filters by name and address', async () => {
    const firstOwner = await createUser({ role: 'STORE_OWNER' })
    const secondOwner = await createUser({ role: 'STORE_OWNER' })
    await createStoreFor(firstOwner, { name: 'Riverside Bakery Downtown', address: '1 River Road' })
    await createStoreFor(secondOwner, { name: 'Hillside Bakery Uptown', address: '2 Hill Road' })

    const user = await createUser({ role: 'NORMAL_USER' })
    const token = await loginAs(user)

    const byName = await api('GET', '/api/user/stores?name=Riverside', { token })
    assert.equal(byName.status, 200)
    assert.equal(byName.body.total, 1)
    assert.equal(byName.body.stores[0].name, 'Riverside Bakery Downtown')

    const byAddress = await api('GET', '/api/user/stores?address=Hill', { token })
    assert.equal(byAddress.body.total, 1)
    assert.equal(byAddress.body.stores[0].name, 'Hillside Bakery Uptown')
  })
})
