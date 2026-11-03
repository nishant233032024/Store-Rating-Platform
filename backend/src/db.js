require('dotenv').config()

const fs = require('node:fs')
const path = require('node:path')
const { SQLITE_SCHEMA, POSTGRES_SCHEMA } = require('./schema')

let pool = null
let sqliteDb = null
let dialect = null
// Resolves once the schema exists. SQLite creates it synchronously; PostgreSQL
// creates it in the background and every query waits for it first.
let readyPromise = Promise.resolve()

const PG_PLACEHOLDER = /\$(\d+)/g

/**
 * SQLite uses ?NNN positional parameters, PostgreSQL uses $NNN.
 * Every query in this project is written with $NNN so the same SQL works
 * in both engines once placeholders are rewritten.
 */
function toSqliteSql(text) {
  return text.replace(PG_PLACEHOLDER, (_, index) => `?${index}`)
}

function statementReturnsRows(text) {
  return /\breturning\b/i.test(text) || /^\s*(select|with|pragma|explain)/i.test(text)
}

/**
 * Initializes the configured driver. Supports:
 *   DATABASE_URL=sqlite:./data/ratings.db   (built-in node:sqlite)
 *   DATABASE_URL=postgresql://...           (pg, installed in production)
 */
function initDb() {
  if (dialect) return dialect

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required (e.g. sqlite:./data/ratings.db or postgresql://user:pass@host:5432/ratings)'
    )
  }

  if (databaseUrl.startsWith('sqlite:')) {
    const dbPath = databaseUrl.slice('sqlite:'.length) || ':memory:'

    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath)
      if (dir && dir !== '.' && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }

    const { DatabaseSync } = require('node:sqlite')
    sqliteDb = new DatabaseSync(dbPath)
    sqliteDb.exec('PRAGMA foreign_keys = ON')
    dialect = 'sqlite'
    sqliteDb.exec(SQLITE_SCHEMA)
    console.log(`Using SQLite database at ${dbPath}`)
    return dialect
  }

  let Pool
  try {
    ;({ Pool } = require('pg'))
  } catch (error) {
    throw new Error(
      "DATABASE_URL points at PostgreSQL but the 'pg' driver is not installed. " +
        'Run `npm install pg`, or set DATABASE_URL=sqlite:./data/ratings.db to use the bundled SQLite driver.'
    )
  }

  const sslSetting = String(process.env.DATABASE_SSL || '').toLowerCase()
  const ssl =
    sslSetting === 'true'
      ? { rejectUnauthorized: false }
      : sslSetting === 'false'
        ? false
        : undefined

  pool = new Pool({ connectionString: databaseUrl, ssl })
  dialect = 'postgres'
  console.log('Using PostgreSQL database')

  readyPromise = createPostgresSchema()
  // Surface failures through query() instead of an unhandled rejection.
  readyPromise.catch(() => {})

  return dialect
}

async function createPostgresSchema() {
  try {
    for (const statement of POSTGRES_SCHEMA) {
      await pool.query(statement)
    }
    console.log('PostgreSQL schema is up to date')
  } catch (error) {
    console.error('Failed to initialise the PostgreSQL schema:', error.message)
    throw error
  }
}

/** Resolves when the schema for the active dialect is ready. */
function whenReady() {
  return readyPromise
}

function getDialect() {
  if (!dialect) initDb()
  return dialect
}

function getDb() {
  if (sqliteDb) return sqliteDb
  if (pool) return pool
  throw new Error('Database not initialized')
}

async function closeDb() {
  if (sqliteDb) {
    try {
      sqliteDb.close()
    } catch (error) {
      // already closed
    }
    sqliteDb = null
  }
  if (pool) {
    await pool.end()
    pool = null
  }
  dialect = null
}

/**
 * Runs a parameterized query.
 * Returns { rows, rowCount } for both engines.
 */
async function query(text, params = []) {
  if (!dialect) initDb()
  await readyPromise
  const values = params || []

  if (dialect === 'sqlite') {
    const statement = sqliteDb.prepare(toSqliteSql(text))
    try {
      if (statementReturnsRows(text)) {
        const rows = statement.all(...values).map((row) => ({ ...row }))
        return { rows, rowCount: rows.length }
      }
      const info = statement.run(...values)
      return { rows: [], rowCount: Number(info.changes) }
    } finally {
      if (typeof statement.close === 'function') statement.close()
    }
  }

  const result = await pool.query(text, values)
  return { rows: result.rows, rowCount: result.rowCount }
}

// Execute multiple statements (used for idempotent schema creation).
async function createTables(statements) {
  for (const statement of statements) {
    await query(statement)
  }
}

// Raw execution escape hatch (no parameters, no result rows).
async function execute(sql, params = []) {
  if (!dialect) initDb()
  await readyPromise
  if (dialect === 'sqlite') {
    if (params && params.length > 0) return query(sql, params)
    sqliteDb.exec(sql)
    return { rows: [], rowCount: 0 }
  }
  return pool.query(sql, params)
}

module.exports = {
  initDb,
  whenReady,
  getDb,
  getDialect,
  closeDb,
  query,
  createTables,
  execute,
}
