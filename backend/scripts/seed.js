require('dotenv').config()

const bcrypt = require('bcrypt')
const { initDb, closeDb, query } = require('../src/db')

const PASSWORD = {
  admin: 'Admin123!',
  user: 'User123!',
  owner: 'Owner123!',
}

async function seed() {
  initDb()
  console.log('Starting database seed...')

  const existing = await query('SELECT COUNT(*) AS count FROM "User"')
  if (Number(existing.rows[0].count) > 0) {
    console.log('Database already contains users - skipping seed.')
    return
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10

  async function createUser(name, email, password, address, role) {
    const passwordHash = await bcrypt.hash(password, saltRounds)
    const result = await query(
      `INSERT INTO "User" (name, email, passwordHash, address, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [name, email, passwordHash, address, role]
    )
    return result.rows[0].id
  }

  await createUser('System Administrator Account', 'admin@example.com', PASSWORD.admin, '123 Admin Street', 'SYSTEM_ADMIN')
  const user1Id = await createUser('Normal User One Account', 'user1@example.com', PASSWORD.user, '456 User Avenue', 'NORMAL_USER')
  const user2Id = await createUser('Normal User Two Account', 'user2@example.com', PASSWORD.user, '789 User Boulevard', 'NORMAL_USER')
  const owner1Id = await createUser('Store Owner One Account', 'owner1@example.com', PASSWORD.owner, '321 Owner Road', 'STORE_OWNER')
  const owner2Id = await createUser('Store Owner Two Account', 'owner2@example.com', PASSWORD.owner, '654 Owner Lane', 'STORE_OWNER')

  async function createStore(name, email, address, ownerId) {
    const result = await query(
      `INSERT INTO "Store" (name, email, address, "ownerId")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name, email, address, ownerId]
    )
    return result.rows[0].id
  }

  const storeAId = await createStore('Downtown Market Store', 'storea@example.com', '123 Store Street', owner1Id)
  const storeBId = await createStore('Uptown Market Storefront', 'storeb@example.com', '456 Store Avenue', owner2Id)

  const ratings = [
    [user1Id, storeAId, 5],
    [user2Id, storeAId, 4],
    [user1Id, storeBId, 3],
    [user2Id, storeBId, 2],
  ]

  for (const [userId, storeId, value] of ratings) {
    await query(
      'INSERT INTO "Rating" ("userId", "storeId", "value") VALUES ($1, $2, $3)',
      [userId, storeId, value]
    )
  }

  // Recalculate derived store ratings.
  for (const storeId of [storeAId, storeBId]) {
    const aggregate = await query(
      'SELECT AVG("value") AS average, COUNT(*) AS count FROM "Rating" WHERE "storeId" = $1',
      [storeId]
    )
    const average = Number(aggregate.rows[0].average || 0)
    const count = Number(aggregate.rows[0].count)
    await query('UPDATE "Store" SET "averageRating" = $1, "ratingCount" = $2 WHERE id = $3', [
      Number(average.toFixed(2)),
      count,
      storeId,
    ])
  }

  console.log('Database seeded successfully!')
  console.log('Demo credentials:')
  console.log('Admin: admin@example.com / Admin123!')
  console.log('User 1: user1@example.com / User123!')
  console.log('User 2: user2@example.com / User123!')
  console.log('Owner 1: owner1@example.com / Owner123!')
  console.log('Owner 2: owner2@example.com / Owner123!')
}

seed()
  .then(() => closeDb())
  .catch(async (error) => {
    console.error('Seed error:', error)
    await closeDb()
    process.exit(1)
  })
