/**
 * SQLite schema used for local development and integration tests.
 *
 * PostgreSQL deployments keep using prisma/migrations/20240101000001_init.sql.
 * The constraints here mirror the ones that matter for correctness:
 *   - one rating per (user, store)
 *   - rating value must be 1..5
 *   - role must be one of the three known values
 *   - case-insensitive unique email
 *   - one store per owner
 */
const SQLITE_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "User" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 20 AND 60),
  email TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  address TEXT NOT NULL CHECK (length(trim(address)) BETWEEN 1 AND 400),
  role TEXT NOT NULL DEFAULT 'NORMAL_USER'
    CHECK (role IN ('SYSTEM_ADMIN', 'NORMAL_USER', 'STORE_OWNER')),
  "authVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_email_lower" ON "User" (LOWER(email));
CREATE INDEX IF NOT EXISTS "idx_user_role" ON "User" (role);

CREATE TABLE IF NOT EXISTS "Store" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 20 AND 60),
  email TEXT NOT NULL,
  address TEXT NOT NULL CHECK (length(trim(address)) BETWEEN 1 AND 400),
  "ownerId" INTEGER UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  "averageRating" REAL,
  "ratingCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_store_ownerId" ON "Store" ("ownerId");

CREATE TABLE IF NOT EXISTS "Rating" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "storeId" INTEGER NOT NULL REFERENCES "Store"(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", "storeId")
);

CREATE INDEX IF NOT EXISTS "idx_rating_userId" ON "Rating" ("userId");
CREATE INDEX IF NOT EXISTS "idx_rating_storeId" ON "Rating" ("storeId");
`

/**
 * PostgreSQL schema, executed statement by statement on startup.
 *
 * Every statement is idempotent so a deploy against an existing database is a
 * no-op. Keeping this in code means a fresh Render Postgres instance works
 * without running psql by hand, and the constraints match the SQLite schema.
 */
const POSTGRES_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS "User" (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 20 AND 60),
    email TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    address TEXT NOT NULL CHECK (char_length(trim(address)) BETWEEN 1 AND 400),
    role TEXT NOT NULL DEFAULT 'NORMAL_USER'
      CHECK (role IN ('SYSTEM_ADMIN', 'NORMAL_USER', 'STORE_OWNER')),
    "authVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_email_lower" ON "User" (LOWER(email))',
  'CREATE INDEX IF NOT EXISTS "idx_user_role" ON "User" (role)',
  `CREATE TABLE IF NOT EXISTS "Store" (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 20 AND 60),
    email TEXT NOT NULL,
    address TEXT NOT NULL CHECK (char_length(trim(address)) BETWEEN 1 AND 400),
    "ownerId" INTEGER UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
    "averageRating" DOUBLE PRECISION,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  'CREATE INDEX IF NOT EXISTS "idx_store_ownerId" ON "Store" ("ownerId")',
  `CREATE TABLE IF NOT EXISTS "Rating" (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "storeId" INTEGER NOT NULL REFERENCES "Store"(id) ON DELETE CASCADE,
    value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("userId", "storeId")
  )`,
  'CREATE INDEX IF NOT EXISTS "idx_rating_userId" ON "Rating" ("userId")',
  'CREATE INDEX IF NOT EXISTS "idx_rating_storeId" ON "Rating" ("storeId")',
]

module.exports = { SQLITE_SCHEMA, POSTGRES_SCHEMA }
