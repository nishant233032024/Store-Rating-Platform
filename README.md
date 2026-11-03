# Store Rating Platform

A full-stack internship challenge implementation: role-based access control, store ratings with
one rating per user per store, and admin management of users and stores.

Three roles are supported and enforced **on the server**: `SYSTEM_ADMIN`, `NORMAL_USER` and
`STORE_OWNER`.

## Technology Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite, React Router, Tailwind CSS |
| Backend | Node.js + Express 5 (CommonJS) |
| Database | PostgreSQL in production; SQLite via Node's built-in `node:sqlite` for local integration tests |
| Schema | Prisma schema plus SQL migration; a small parameterized adapter runs the same queries in both environments |
| Auth | JWT in an HttpOnly cookie, bcrypt password hashing |
| Validation | Shared validators in `backend/src/validation.js`, mirrored by the forms |
| Tests | 33 HTTP integration tests on `node:test` (no Jest, no Supertest) |

Both database engines run the **same SQL**, written with `$1` placeholders and rewritten to `?1`
for SQLite, so behaviour does not drift between development and production.

## Requirements

- Node.js **22.5+** (the tests and SQLite mode rely on the built-in `node:sqlite` module)
- PostgreSQL only if you point `DATABASE_URL` at Postgres

## Quick start

```bash
# 1. Install
cd backend  && npm install
cd ../frontend && npm install

# 2. Configure the backend
cd backend
cp .env.example .env          # then set JWT_SECRET

# 3. Create the database schema + demo data
npm run seed

# 4. Start the API (port 3001)
npm run dev

# 5. In a second terminal, start the frontend (port 5173)
cd frontend
npm run dev
```

Open http://localhost:5173. Nothing else is needed: the SQLite database file and all tables are
created automatically on first boot.

### Environment variables

`backend/.env` (see `backend/.env.example`):

```ini
PORT=3001
DATABASE_URL=sqlite:./data/ratings.db
# or: DATABASE_URL=postgresql://user:password@host:5432/ratings
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=24h
COOKIE_MAX_AGE=86400000     # milliseconds, a plain number - not "24 * 60 * 60 * 1000"
CORS_ORIGIN=http://localhost:5173
BCRYPT_SALT_ROUNDS=10
```

`frontend/.env` is optional — only needed if the API is not on `http://localhost:3001`:

```ini
VITE_PROXY_TARGET=http://localhost:3001
```

The frontend always calls the API through its own origin (`/api/...`). In development Vite proxies
those requests, and in production the Vercel rewrite does. Keeping the API on the same origin means
the auth cookie stays first-party, so no CORS or `SameSite=None` workarounds are required.

### PostgreSQL option

For the assignment's PostgreSQL runtime, start the included database with Docker:

```bash
docker compose up -d postgres
```

Set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ratings` in `backend/.env`, then
start the API and run `npm run seed`. The API applies the idempotent PostgreSQL schema on first boot;
the matching Prisma/SQL migration is in `backend/prisma/migrations/` for a normal migration workflow.
An existing PostgreSQL installation works with the same `DATABASE_URL`; create the `ratings` database
first and ensure the database user can create tables.

## Demo accounts

Created by `npm run seed` in `backend/` (the script is idempotent and refuses to duplicate data).

| Role | Email | Password |
|---|---|---|
| System admin | `admin@example.com` | `Admin123!` |
| Normal user | `user1@example.com` | `User123!` |
| Normal user | `user2@example.com` | `User123!` |
| Store owner | `owner1@example.com` | `Owner123!` |
| Store owner | `owner2@example.com` | `Owner123!` |

The login page also lists these and can fill the form for you.

## Tests

```bash
cd backend
npm test
```

33 backend tests across 5 suites start the real Express app on an ephemeral port and drive it over
HTTP against a temporary SQLite file. Two frontend validation tests cover the client-side boundary
rules. No database server, Jest or Supertest is required for the local test commands.

Covered: registration and role-injection attempts, name/password/address boundaries, duplicate
emails, login and cookie sessions, logout, 401/403 on every role boundary, dashboard totals,
admin-only user creation, one-store-per-owner, owner data scoping, rater lists that never expose
email or address, first-versus-updated ratings, average rounding, 404s, session invalidation after a
password change, filtering and pagination.

The frontend test command is intentionally small and dependency-free; the production build remains
the main UI integration check.

## API

All routes return JSON. Errors use `{ "error": "message" }`.

### Authentication

| Endpoint | Method | Notes |
|---|---|---|
| `/api/auth/register` | POST | Public signup, always creates a `NORMAL_USER` |
| `/api/auth/login` | POST | Sets the `token` HttpOnly cookie |
| `/api/auth/logout` | POST | Clears the cookie |
| `/api/auth/me` | GET | Current user, used to revalidate the session on load |

### Administrator (requires `SYSTEM_ADMIN`)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/admin/dashboard` | GET | Totals for users, stores, ratings |
| `/api/admin/users` | GET | Filter by name/email/address/role, paginated, sortable |
| `/api/admin/users` | POST | Create a user of any role |
| `/api/admin/users/:id` | GET | User details, plus assigned store for owners |
| `/api/admin/stores` | GET | Filter by name/email/address, paginated |
| `/api/admin/stores` | POST | Create a store and assign an unassigned owner |
| `/api/admin/store-owners/available` | GET | Store owners without a store |

### Normal user (requires `NORMAL_USER`)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/user/stores` | GET | Listing with overall rating, rating count and the caller's own rating |
| `/api/user/stores/:storeId` | GET | Single store (used by the rating page) |
| `/api/user/stores/:storeId/rating` | PUT | Create or update the caller's rating (1-5) |
| `/api/user/password` | PATCH | Change password; invalidates existing sessions |

### Store owner (requires `STORE_OWNER`)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/owner/dashboard` | GET | Own store plus its raters |
| `/api/owner/raters` | GET | Full rater list for the owner's store |

`GET /health` returns `{ "status": "ok" }` and is used as the deployment health check.

## Rules enforced by the backend

- Names must be 20-60 characters; addresses at most 400 and non-blank.
- Passwords must be 8-16 characters with at least one uppercase letter and one special character.
- A rating is an integer from 1 to 5.
- One rating per user per store; submitting again updates the existing row.
- Averages are always derived from the rating rows and shown to one decimal place; a store with no
  ratings reads `"Not rated yet"`.
- Store owners only ever see their own store and its raters.
- Rater listings never include email addresses or addresses.
- Changing a password increments `authVersion`, so tokens issued before the change stop working.
- Only the server decides roles: a role sent by a client during signup is discarded.
- State-changing browser requests are checked against `CORS_ORIGIN`; the Vercel rewrite keeps the
  cookie first-party and the production cookie uses `Secure` plus `SameSite=Lax`.

## Database schema

| Table | Columns |
|---|---|
| `User` | id, name, email, passwordHash, address, role, authVersion, createdAt, updatedAt |
| `Store` | id, name, email, address, ownerId, averageRating, ratingCount, createdAt, updatedAt |
| `Rating` | id, userId, storeId, value, createdAt, updatedAt |

Constraints: case-insensitive unique email, unique `Store.ownerId` (one store per owner), unique
`(userId, storeId)` on `Rating`, `CHECK` on role and rating value, cascading foreign keys.

The production relational model is documented in `backend/prisma/schema.prisma` and
`backend/prisma/migrations/20240101000001_init.sql`. The API uses a modest parameterized SQL adapter
(`backend/src/db.js`) so the same integration suite can run without a local PostgreSQL server; in
production the adapter uses `pg` and bootstraps the equivalent schema on startup.

## Deployment

The repository contains configuration for **Vercel** (frontend) and **Render** (API + PostgreSQL).

### Backend on Render

`render.yaml` defines a Node web service in `backend/` plus a managed Postgres database:

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repository.
3. Render provisions `store-rating-api` and `store-rating-db`, generates `JWT_SECRET`, and wires
   `DATABASE_URL` from the database.
4. Set `CORS_ORIGIN` to the deployed frontend URL if browsers ever call the API directly (not
   needed when using the Vercel rewrite below).
5. The Render start command runs the idempotent seed automatically before starting the API. It
   creates demo accounts only when the database is empty, so a paid Render Shell is not required.

Notes: `NODE_VERSION` must stay at 22.11.0 or another version `>= 22.5`, and Render's filesystem is
ephemeral, so the service must use Postgres — a SQLite file would be wiped on every deploy.

### Frontend on Vercel

1. Import the repository, set the **root directory** to `frontend`.
   The linked Vercel project is configured with this root so GitHub `main` deployments build the
   React application rather than the repository wrapper.
2. Vercel detects Vite; `frontend/vercel.json` fixes the build command, output directory and routing.
3. Replace the `destination` in `frontend/vercel.json` (`/api/:path*`) with the real Render service URL.
4. Deploy.

`vercel.json` does two things: it proxies `/api/*` to the Render API, and it rewrites every other
path to `index.html` so client-side routes such as `/owner/dashboard` survive a page refresh.

## Project structure

```
backend/
  src/
    server.js                 Express app, middleware, route mounting
    db.js                     SQLite/PostgreSQL driver + $N placeholder translation
    schema.js                 DDL for both engines
    validation.js             Request validators and helpers
    middleware/               authenticate, validateRole, error handler
    routes/                   auth, admin, user, owner
  scripts/seed.js             Idempotent demo data
  tests/integration.test.js   33 HTTP integration tests
frontend/
  index.html                  Vite entry
  vite.config.mjs             Dev server + /api proxy
  src/
    App.jsx                   Router, role-aware navigation, guarded routes
    store/authStore.js        Session store backed by /api/auth/me
    pages/                    auth, admin, user, owner, change-password
```

## Trade-offs

1. Ratings are stored once per user/store and averages are calculated from those rows after each
   write. `Store.averageRating` and `Store.ratingCount` are maintained display caches; the Rating
   rows remain the source of truth.
2. The frontend keeps the current user in memory and revalidates it against `/api/auth/me` on every
   load; the HttpOnly cookie remains the only credential.
3. The Vercel rewrite is preferred over cross-site API calls because third-party cookies are
   increasingly blocked by browsers.
4. `pg` is installed in production only; the app falls back to a clear error message if a Postgres
   URL is supplied without the driver.

## Known limitations

- The PostgreSQL code path is not covered by the automated suite; only SQLite mode is tested
  locally. Both engines run the same SQL and the same DDL is applied on boot.
- No email verification, password reset, or store deletion flows.
- No rate limiting in tests by design; production uses 100 requests per 15 minutes per IP.
