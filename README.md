# Tournament Backend

Backend API for a Gaming Tournament Management Platform (Chess, Smash Karts, BGMI, Free Fire, and more).
This is a backend-only project — no frontend is included.

**Migration in progress:** this backend is being migrated from PostgreSQL/SQLAlchemy to MongoDB/Beanie,
per the revised platform specification (admin-owned result pipeline, multi-match tournaments, CSV import,
configurable scoring engine, audit trail, refunds). Being rebuilt in phases; this file reflects current state.

## Stack

FastAPI, MongoDB, Beanie (async ODM on top of PyMongo's native async client), Pydantic v2,
JWT (HTTP-only cookie auth), Razorpay SDK.

## Architecture

```
Router -> Service -> Repository -> Beanie Document -> MongoDB
```

Routers handle HTTP concerns only. Services hold business logic. Repositories hold database access.

## Local setup

1. Create a virtualenv and install dependencies:

   ```bash
   python3.12 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and fill in the values. Never commit `.env`.

3. Point `MONGODB_URL` at a MongoDB instance (Atlas connection string, or local). For local development,
   MongoDB must run as a (single-node is fine) replica set, since Beanie/PyMongo need one for
   multi-document transactions:

   ```bash
   brew tap mongodb/brew
   brew install mongodb-community@7.0
   # add `replication: { replSetName: rs0 }` to /opt/homebrew/etc/mongod.conf
   brew services start mongodb/brew/mongodb-community@7.0
   mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: '127.0.0.1:27017'}]})"
   ```

   There are no schema migrations to run — Beanie creates indexes automatically at startup from each
   Document's `Settings.indexes`.

4. Seed reference data (games) and create the initial admin account:

   ```bash
   .venv/bin/python -m scripts.seed_games
   .venv/bin/python -m scripts.create_admin
   ```

5. Run the server:

   ```bash
   .venv/bin/uvicorn app.main:app --reload
   ```

6. Open API docs at `http://127.0.0.1:8000/docs`.

## Tests

```bash
.venv/bin/pytest
```

Tests run against a dedicated MongoDB database (`TEST_MONGODB_URL`/`TEST_MONGODB_DB_NAME`, see
`tests/conftest.py`), never against production data. Razorpay calls are mocked in tests — no real
Razorpay API calls are made.

## Environment variables

See `.env.example` for the full list. `MONGODB_URL` and all Razorpay/JWT secrets are read from the
environment via Pydantic Settings and are never hardcoded.
