# Implementation Challenges & How They Were Resolved

This document is written from the interviewer's perspective: a running record of the
real blockers that came up while turning the Store Rating Platform into a working,
presentable project, the methods used to diagnose them, and the fixes that actually
carried. It is meant to be read aloud or paraphrased in an interview: concrete problem,
concrete investigation, concrete resolution.

---

## 1. The frontend could not build or render anything at all

**Symptom.** `html` root level was empty, Vite had no entry point, `npm run dev` would
not serve a page, and `npm run build` either failed or produced a blank shell. Five
pages referenced a module store as an object (`authStore.login()`) that was actually
exported as a function, so they threw on load. `App.jsx` called `useNavigate()` outside
the `<BrowserRouter>`.

**Investigation / method.** Start with the build, because a broken build is the cleanest
failing signal and is cheap to reproduce locally. Read the build output first, then the
entry point, then a sample page. The build log pointed to the missing `index.html`; the
component tree review showed the router boundary was inside the component instead of
wrapping it. For the auth problem I read the store export once, then followed it across
the five importing pages to see the exact call site mismatch (`function` vs plain object
with methods).

**What I tried first (and why it was wrong).** Patching the five pages in place by
rewriting only their `authStore` calls. That was too fragile: the store's contract was
wrong in two places (`.login()`/`.logout()` existed on no export, and there was no
`.init()`), and patching callers without fixing the source just papers over an API that
was never real.

**Real fix.** Rewrite `authStore.js` as a proper source of truth that integrates with the
browser: the store's state is derived from `GET /api/auth/me`, the same endpoint the UI
shell uses to decide where to redirect each role. That avoids trusting stale client-side
session state forever. Then rewrite `App.jsx` so `<BrowserRouter>` wraps the whole shell
and guards (`RequireAuth`, `RequireRole`) sit inside it, and rewrite `main.jsx` so it
actually mounts `App`. Do the same reading pass for the pages that were still calling old
patches (`CreateStore`, `Signup`, `UserDetails`, `Raters`, the rating page link) so the
whole graph is consistent again.

**Why it matters for an interview.** Sugar-coating: "I got the app to build." The better
answer is: I prioritized build errors because they're deterministic and cheap, read the
entry point and a representative page, found that five callers shared one broken API
surface, fixed the central module instead of patching callers, and verified the whole app
render by rendering a real authenticated page, not by assuming the build work.

---

## 2. CSS was silently missing — Tailwind 4 was installed but produced no styles

**Symptom.** The app rendered unstyled: raw boxes, default links, no hover states, no
grid or spacing. The app "worked" but looked like a prototype with no CSS applied at all.

**Investigation / method.** When styling is totally absent, check two things: is the CSS
file actually loading, and is the Tailwind plugin the file expects installed. Read
`index.css`, `postcss.config.js`, `package.json` (dev deps), and `vite.config.mjs`. The
package was Tailwind 4, but the CSS used Tailwind 3 directives, and the PostCSS config did
not list the Tailwind PostCSS plugin. That combination is a complete CSS failure, not a
partial one.

**What I tried first.** Adjusting the CSS import order. That doesn't matter when the
plugin itself is missing from PostCSS — order isn't the lever here.

**Real fix.** Install the matching plugin (`@tailwindcss/postcss`), switch the CSS to the
Tailwind 4 form (`@import "tailwindcss"` plus an `@theme` block for the font and base
body styles), and delete the dead `tailwind.config.js` and the leftover build rules that
were trying to drive the v4 compiler. Confirm by rendering a real page in the browser and
checking that spacing, borders, and hover states now apply.

**Interview framing.** "The CSS was gone because Tailwind 4 and Tailwind 3 tooling had been
mixed. I confirmed it by reading the CSS, the PostCSS config, and the installed plugin, then
aligned all three to the same Tailwind 4 contract instead of guessing at a partial fix."

---

## 3. The admin dashboard showed "Loading..." forever

**Symptom.** Dashboard rendered, but the three number tiles stayed on loading forever; the
numbers that belong there (`6 / 2 / 4`) never appeared.

**Investigation / method.** If a component stays on loading, either the data fetch is
failing, the URL is wrong, or the component never reads the response. Read the page
component, the auth store's request helper, and the server route. The page was calling a
route that didn't exist, so the fetch returned nothing useful and the loading path never
exited. I also checked the server's `/api/admin/dashboard` route directly to confirm it
does return real data; the server was fine, the client was pointing at the wrong surface.

**Real fix.** Point the dashboard at the real route that already existed and verified on the
server, and make sure the loading/empty/success branches all read that response. Confirm by
rendering the dashboard as an admin in the browser and seeing the real totals.

**Interview framing.** "A page stuck on loading usually means a mismatch between what the
component calls and what exists on the server. I verified the server route first, then fixed
the client to actually use it, then rendered the page with a real session to confirm the
numbers appear."

---

## 4. Users and stores pages linked to broken or missing routes

**Symptom.** The listing page link to `Change rating` pointed to a rating page that did not
exist. The admin "Users" table and "Stores" table used filter inputs without `name`
attributes, so filtering never worked. `Raters` called `/api/owner/raters` which either
didn't exist or returned nothing useful. `UserDetails` showed "No assigned store" for users
who clearly had one.

**Investigation / method.** Read each page's JSX and its network surface, not just the
render. For tables, check that the filter control passes a usable query parameter; for
links, check that the target route exists; for a "no data" message, check the condition
logic and the API it depends on. I found: filter inputs missing `name`, a missing rating
page, a wrong conditional in `UserDetails`, and a `Raters` fetch against a route that wasn't
implemented.

**Real fix.** Give every filter input a `name` so its value actually reaches the query
string. Create the rating page (`/user/store/:storeId`) with stars and a PUT to update the
user's own rating. Fix the `UserDetails` conditional so it accurately reflects whether a
store is assigned. Make `Raters` call the route that actually exists and return rater data.
Confirm by rendering the listing, opening a rating, and rendering the raters page with a
real session.

**Interview framing.** "Broken lists and links usually fail at a single control, query param,
or route per page. I read each page against its network surface, fixed the control/query/param
mismatch or route, and walked through the real pages with an authenticated session to confirm."

---

## 5. The auth flow assumed the client's session was authoritative

**Symptom.** If the session were somehow stale or revoked, the client could keep showing a
dashboard for a user whose server session no longer exists — a security and UX bug.

**Investigation / method.** Read `authStore.js` and the shell's redirect logic. The store was a
function, not an object, so the shell couldn't even call `.init()` or `.isAuthenticated()`. Even
after making it an object, I wanted the store's source of truth to be the server, not a flag
the client set on login.

**Real fix.** Rewrite the store so `useSyncExternalStore` derives its state from `GET
/api/auth/me`, and add `init()` so the shell can seed that state on mount. Make the redirect
logic (`homePathForRole`, the `HOME_PATHS` map) depend on that server-backed state. Confirm by
logging in, rendering a real page, and checking that a signed-out session redirects to login.

**Interview framing.** "I treated authentication state as a server-backed thing, not a client
flag, so a stale session never becomes a trusted session. I also made the redirect logic depend
on that same source so role-based routing is consistent."

---

## 6. Backend deploy readiness — Tailwind build, Fastify/Express confusion, and auth roles

**Symptom.** Before deploying, the backend would have run into several practical problems:
the login page rendered empty on the frontend because of the CSS issue above; the login button
and the dashboard fetch logic were also broken; the backend itself had `pg` in optional deps
(where it would not reliably ship; the server would have started but fail to talk to Postgres);
there was only a SQLite schema path, so a Render deploy would have started against an empty
database; and `express-rate-limit` would mis-handle `X-Forwarded-For` behind a proxy unless
`trust proxy` was set.

**Investigation / method.** Read the backend's `package.json`, `server.js`, and DB/route code,
then cross-check the frontend's build and login page. The deployment blockers were: (a) the
frontend build was broken, (b) `pg` lived in `optionalDependencies`, (c) the schema only created
tables for SQLite, (d) `trust proxy` was not set, and (e) the admin stores page and owner/raters
routes only existed partially.

**What I tried first.** Each one individually as soon as it appeared. The "pg in optional deps"
fix moved `pg` to `dependencies`. The schema fix added a real Postgres DDL (`POSTGRES_SCHEMA`)
applied idempotently on boot, with queries waiting for the schema to be ready. The proxy fix added
`app.set('trust proxy', 1)`. The route fixes added `ownerId` to the admin stores payload and
`GET /api/user/stores/:storeId`.

**Why the schema fix was the one to get right.** A deployment that starts and immediately shows
empty data is worse than one that fails loudly during setup. I made the boot process apply the DDL
so the Render environment doesn't need a manual `CREATE TABLE` step, and I made queries wait for
the schema to be ready before running. That's the difference between "deployed but broken" and
"deployed and usable."

**Interview framing.** "Before deployment I checked both sides: the frontend build/login path and
the backend deploy surface. The fixes were: align the build, move `pg` to real dependencies, add a
self-bootstrapping Postgres schema instead of only SQLite, set `trust proxy` for the proxy layer,
and complete the routes the UI actually depends on. I did that in that order so the deploy starts
up useful, not just alive."

---

## 7. Testing strategy

**What I verified and how.**
- Build: `npm run build` in the frontend, exit 0, real assets produced.
- Backend tests: `cd backend && npm test` (runs `node --test` across the tests), 33/33;
  they cover auth, ratings, and role-based authorization.
- Live HTTP: /health 200, /api/auth/me 401 when signed out, admin login 200 and cookie round-
  trip, /api/admin/dashboard returns real totals, admin stores include `ownerId`, the PUT rating
  endpoint updates the existing rating and does not create a duplicate, an out-of-range rating is
  rejected with 400, a new signup sees `myRating: null` for an unrated store, and pagination of
  the listing returns a real `myRating` for the signed-in user.
- Browser rendering: login page, store listing, and admin dashboard all rendered with real data
  in the browser, with Tailwind applied and the filter inputs functional.

**What I left explicitly for the user.**
- The `vercel.json` proxy rewrite still contains a placeholder — the real Render URL must be
  substituted before a frontend deploy.
- Pushing to GitHub and deploying to Render/Vercel were not performed, since they were not
  authorized.
- The PostgreSQL path bootstraps itself now, but it was not exercised against a real Postgres
  server; only SQLite mode was tested locally.

**Interview framing.** "I verified three layers: the build, the server-side tests, and the live
end-to-end flows through HTTP and the browser. I kept the verification tied to the actual risk: the
build had to produce assets, the tests had to pass, and the real pages had to render with real data.
Where I couldn't test something locally — a real Postgres server and the actual deployment step — I
was explicit about it rather than pretending it was covered."
