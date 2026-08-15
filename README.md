# ArenaroadX

A full-stack Gaming Tournament Management Platform — players register and pay for tournaments
(Chess, Smash Karts, BGMI, Free Fire, and any other game an admin adds), the admin runs the
tournament and enters results manually, and a leaderboard and prize payouts are tracked per
tournament. Built for games with no official public results API: an admin (or teammate) watches
the match, records the outcome, and enters it into the platform by hand.

## Stack

**Backend** — FastAPI, MongoDB, Beanie (async ODM over PyMongo's native async client), Pydantic v2,
JWT auth in HTTP-only cookies, Razorpay SDK (Standard Checkout, including UPI).

**Frontend** — React 19 + TypeScript, Vite, React Router, Tailwind CSS, Razorpay Checkout.js.
A single app and a single deployment: the player-facing site and the admin dashboard are both
just routes (`/admin/*`) in the same build, gated by the logged-in user's role.

## Architecture

Backend:

```
Router -> Service -> Repository -> Beanie Document -> MongoDB
```

Routers handle HTTP concerns only (request/response shapes, auth dependencies). Services hold all
business logic (validation, state transitions, orchestration). Repositories are the only layer that
talks to MongoDB. Money is stored as integer paise throughout the backend and converted to rupees
only at the API boundary.

Frontend: plain page components under `src/pages/` (and `src/pages/admin/`) and a thin typed API
client per resource under `src/api/`. `/admin/*` routes are wrapped in `AdminLayout`, which
redirects any non-admin user back to `/` — that's the only gate; there's no separate build.

## How a tournament actually runs

This platform assumes **no official game API exists** for results (true for Smash Karts and most
casual web games), so results are never fetched automatically:

1. Admin creates the game once (name + logo) and a tournament under it (entry fee, 1st/2nd prize,
   max players, registration deadline, start time, an optional website link players click to go
   play, rules, description).
2. Admin opens registration. Players register (just their in-game name — no UID field, since most
   casual games don't expose one) and pay the entry fee via Razorpay.
3. Admin closes registration, marks the tournament ready, and starts it. Players click "Visit
   Website" and play the actual match on the game's own site.
4. A teammate watches the match (or the player self-reports) and tells the admin the result.
5. Admin creates one **Match** as a container, then enters each player's placement (and kills, if
   tracked) through the "Manual Entry" form.
6. Admin reviews and publishes the calculated results — this locks them against casual edits (a
   published result can still be corrected, but it's an audited action with a required reason).
7. The leaderboard updates automatically for both dashboards. Admin creates a Prize record for the
   actual winners and marks it paid once they've sent the money (payouts happen outside the
   platform — this just tracks who got what).

## Features

**Auth** — register/login/logout, JWT in an HTTP-only cookie, profile editing, admin-only account
suspension/ban.

**Games** — admin creates games with a name, description, and logo (image URL). The logo shows on
every tournament card for that game.

**Tournaments** — full lifecycle (`DRAFT → REGISTRATION_OPEN → REGISTRATION_CLOSED → READY → LIVE →
RESULTS_PENDING → RESULTS_REVIEW → RESULTS_PUBLISHED → COMPLETED`, with `CANCELLED` reachable from
most states). Entry fee, a 1st/2nd prize breakdown (auto-summed into a total prize pool, both shown
separately on tournament cards), max players, registration deadline, start time, an optional
website link, rules, and description — all editable after creation.

**Registration & payment** — a player registers (reserving a slot for a short window), then pays via
Razorpay Standard Checkout (cards, netbanking, wallets, and UPI if enabled on the Razorpay account).
Payment is verified server-side via real HMAC signature verification — nothing about payment
success is ever trusted from the client. An unpaid reservation auto-releases its slot after it
expires. Registering while an unfinished reservation already exists correctly resumes payment
instead of erroring.

**Matches & results** — one match per tournament is enough to hang results on (no private
room/lobby concept — players just use the tournament's website link). Admin enters each player's
placement/kills manually; a scoring rule (placement-only, placement+kills, or a custom weighted
formula) converts that into ranked, scored results. Corrections to already-published results are
audited (reason required, old/new values recorded).

**Leaderboard** — auto-ranked per tournament from published results, plus a per-user history across
tournaments they've played.

**Prizes** — admin assigns actual prize amounts to actual winners once results are published, and
marks them paid (manual payout, tracked here for transparency — players see "You won ₹700" on their
own dashboard).

**Refunds & ledger** — cancelling a tournament with a reason automatically creates a refund for every
confirmed, paid registration; admin marks each processed. Every entry fee, refund, and prize is
recorded in an append-only financial ledger, viewable per tournament.

**Admin payment history** — a platform-wide, searchable list of every payment across every
tournament (player, tournament, amount, status, Razorpay order ID, date) — not just per-tournament.

**Backend-only (not exposed in the current frontend)** — CSV bulk result import
(`/api/admin/matches/{id}/results/import`, with per-row validate/commit and duplicate/unknown
detection) and an admin activity audit log (`/api/admin/audit-logs`) both still exist and work; the
frontend UI for them was intentionally removed since this platform's actual workflow is manual,
single-row result entry. Both are still reachable directly against the API if ever needed.

**Safety/ops** — rate limiting on sensitive endpoints (register, login, payment order creation, CSV
import), an audit-logging middleware that records every mutating admin request, and atomic
slot-reservation (MongoDB has no row locks, so registration capacity is enforced via a conditional
atomic update, proven under concurrency).

## Player flow

Register/login → browse open tournaments → pick one → enter in-game name → pay entry fee (Razorpay,
UPI included) → registration confirmed → click "Visit Website" when it's time to play → check back
for results once the admin publishes them → see rank on the leaderboard and, if a winner, the prize
on their own dashboard.

## Admin flow

Create a game (name + logo) → create a tournament under it (fees, 1st/2nd prize, deadlines, rules,
website link) → open registration → close registration → mark ready → start → create one match →
enter each player's result manually as it comes in → review → publish → assign prizes to the actual
winners → mark paid. Cancel a tournament at any point before results are published and refunds are
generated automatically for anyone who'd paid.

## Running the frontend

One app, one dev server, one port. The player site lives at `/`, the admin dashboard at `/admin` —
which one you see after logging in depends on your account's role, not on which URL/build you're
running.

```bash
npm run dev   # http://localhost:5173
```

Log in with a player account to see the player app; log in with an admin account (or just visit
`/admin` directly, which bounces you to `/login` if you're not authenticated) to see the admin
dashboard. `CORS_ORIGINS` in the backend `.env` should list this one origin.

## Project structure

Two fully independent, separately deployable folders live side by side in this one repo, with
shared project files (this README, `render.yaml`, `.gitignore`) at the repo root, outside both:

```
backend/
  app/
    core/          config, database, security, auth dependencies, rate limiting, audit middleware
    models/        Beanie documents (one per MongoDB collection)
    schemas/       Pydantic request/response models
    repositories/  MongoDB access, one module per collection
    services/      business logic and orchestration
    routers/       FastAPI routers (HTTP layer only)
  scripts/         create_admin, seed_games, seed_demo_tournament
  tests/           pytest suite
  requirements.txt, pytest.ini, .env.example
frontend/
  src/pages/           player-facing pages
  src/pages/admin/     admin dashboard pages
  src/components/      shared UI + page-specific components
  src/api/             typed API client, one module per resource (src/api/admin/ for admin-only calls)
  src/contexts/        auth context/provider
  src/lib/             DTO<->frontend-type mappers, formatting helpers, Razorpay Checkout wrapper
render.yaml            Render deployment blueprint for backend/
README.md
```

## Local setup

### Backend

1. Create a virtualenv and install dependencies:

   ```bash
   cd backend
   python3.12 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and fill in the values (MongoDB URL, JWT secret, Razorpay keys,
   initial admin credentials, `CORS_ORIGINS`). Never commit `.env`.

3. Point `MONGODB_URL` at a MongoDB instance (Atlas connection string, or local). For local
   development, MongoDB must run as a (single-node is fine) replica set, since Beanie/PyMongo need
   one for multi-document transactions:

   ```bash
   brew tap mongodb/brew
   brew install mongodb-community@7.0
   # add `replication: { replSetName: rs0 }` to /opt/homebrew/etc/mongod.conf
   brew services start mongodb/brew/mongodb-community@7.0
   mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: '127.0.0.1:27017'}]})"
   ```

   There are no schema migrations to run — Beanie creates indexes automatically at startup from each
   Document's `Settings.indexes`.

4. Seed reference data (games) and create the initial admin account (run from `backend/`):

   ```bash
   .venv/bin/python -m scripts.seed_games
   .venv/bin/python -m scripts.create_admin
   ```

5. Run the server (from `backend/`):

   ```bash
   .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
   ```

6. Open API docs at `http://127.0.0.1:8010/docs`.

### Frontend

1. Install dependencies:

   ```bash
   cd frontend
   npm install
   ```

2. Copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL` (the backend URL) and
   `VITE_RAZORPAY_KEY_ID` (safe to expose client-side — it's the public key, not the secret).

3. Run the dev server (see [Running the frontend](#running-the-frontend)).

## Tests

```bash
.venv/bin/pytest
```

Tests run against a dedicated MongoDB database (`TEST_MONGODB_URL`/`TEST_MONGODB_DB_NAME`), never
against production data. Razorpay calls are mocked in tests — no real Razorpay API calls are made.

## Environment variables

Backend: see `.env.example` for the full list (MongoDB, JWT, Razorpay, cookie settings,
`CORS_ORIGINS`, initial admin credentials). Frontend: see `frontend/.env.example`
(`VITE_API_URL`, `VITE_RAZORPAY_KEY_ID`). All secrets are read from the environment and are never
hardcoded.

`ADMIN_ORIGIN` (backend) is a leftover hook for a dual-deployment setup this project doesn't use
anymore — leave it blank. If set, it would restrict ADMIN-role logins to one specific frontend
origin; with a single deployment there's nothing meaningful to restrict it to.

## Deployment

Backend deploys to **Render**, frontend deploys to **Vercel** — both directly from this one repo,
no need to split it into separate repos. Render/Vercel each let you pick a subfolder as the
project's root, so the existing `backend-at-repo-root` / `frontend/` layout already works as-is.

### Backend → Render

`render.yaml` at the repo root is a Render Blueprint — in the Render dashboard, "New +" → "Blueprint",
point it at this repo, and it reads the service definition automatically (build command, start
command, and the list of required env vars). Values marked `sync: false` in `render.yaml` (Mongo
URL, Razorpay keys, `CORS_ORIGINS`, admin credentials) aren't stored in git — fill them in once in
the Render dashboard after the first deploy. `JWT_SECRET_KEY` is auto-generated by Render.

Without the blueprint, the equivalent manual setup is: Root Directory blank (repo root), Build
Command `pip install -r requirements.txt`, Start Command
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`, plus every var from `.env.example` set in the
dashboard.

**Set `CORS_ORIGINS` to your deployed Vercel URL(s)** (comma-separated, no trailing slash) once you
know them — the backend rejects cross-origin requests from anything not in that list.

### Frontend → Vercel

One Vercel project for the whole `frontend/` folder — the player site and admin dashboard are both
served from it, split by route (`/admin/*`) and gated by role, not by a separate build:

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Env: `VITE_API_URL` | leave the value **empty** (see below) |
| Env: `VITE_RAZORPAY_KEY_ID` | Razorpay key ID (public, safe to expose) |

`frontend/vercel.json` does two things, both required:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://<your-render-backend>.onrender.com/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- The `/api/*` rule proxies API calls through Vercel's own edge to the Render backend, so from the
  browser's point of view every request — including the auth cookie — is same-origin. This is why
  `VITE_API_URL` is left empty: an empty value makes `src/api/client.ts` resolve API paths against
  the current page's own origin instead of a separate backend hostname, so it hits this proxy.
- The `/(.*)` rule is the standard SPA fallback — without it, refreshing on any client-side route
  (e.g. `/tournaments`) 404s, since React Router's routes only exist in the JS bundle, not as real
  server paths.

### Cookies in production

Because of the `/api/*` proxy above, the frontend and backend are same-origin from the browser's
perspective even though they're on different hosts (`*.vercel.app` and `*.onrender.com`) — this
sidesteps browsers' third-party-cookie blocking, which a bare cross-origin setup runs straight into
regardless of `SameSite` configuration. `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` (set in
`render.yaml`) are still required by the browser for the cookie the proxy passes through.
