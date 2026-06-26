# QuickMove Command Center

A hybrid web app for **QuickMove**, a city-relocation coordination company. Two
faces of the same move:

- **Ops cockpit** (internal) — coordinate every relocation from one calm, dense
  command center.
- **Customer portal** (external) — a magic-link portal where the person moving
  tracks progress, acts on what's needed, uploads documents, and messages ops.

The core idea: **every per-city difference is encoded as data (the "City
Playbook"), and the system generates each move's entire task timeline
automatically.** Nothing city-specific is hardcoded in the UI.

> Built against the spec in `QuickMove_Command_Center_BUILD_DOC.md`. The build
> narrative lives in `QuickMove_Build_Conversation_Log.md` (append-only).

---

## Stack

- **Next.js 16** (App Router) · TypeScript · Tailwind v4 · shadcn/ui
- **Supabase** — Postgres + Auth + Storage, Row-Level Security on every table
- **OpenAI** — server-side only, behind one swappable module
  (`src/lib/ai/provider.ts`); the app degrades gracefully when no key is set
- Deploys to **Vercel** (done manually by you)

## Prerequisites

- Node 20+ (built on Node 24)
- Docker Desktop (for the local Supabase stack)
- Supabase CLI (`supabase`)

## Local setup

```bash
# 1. Install deps
npm install

# 2. Start the local Supabase stack (Postgres + Auth + Storage in Docker).
#    Applies all migrations in supabase/migrations automatically.
npm run db:start          # = supabase start

# 3. Copy env and fill in the local keys printed by `supabase status`
cp .env.example .env.local
#   The repo's .env.local is already filled with the local-dev keys.
#   For a fresh stack, copy NEXT_PUBLIC_SUPABASE_ANON_KEY (publishable) and
#   SUPABASE_SERVICE_ROLE_KEY (secret) from `supabase status`.

# 4. Seed 8 cities, ops users, and ~15 showcase relocations (idempotent)
npm run seed

# 5. Run the app
npm run dev               # http://localhost:3000
```

### Useful scripts

| Script            | What it does                                            |
| ----------------- | ------------------------------------------------------- |
| `npm run dev`     | Next dev server                                         |
| `npm run db:start`| Start local Supabase + apply migrations                 |
| `npm run db:reset`| Drop + re-apply all migrations (then re-run `npm run seed`) |
| `npm run db:stop` | Stop local Supabase                                     |
| `npm run seed`    | Idempotent seed (safe to re-run)                        |

## Demo accounts

All ops accounts share the password **`quickmove123`**:

| Role  | Email                | Cities             |
| ----- | -------------------- | ------------------ |
| admin | admin@quickmove.in   | all                |
| lead  | lead@quickmove.in    | all                |
| ops   | rahul@quickmove.in   | Bengaluru, Hyderabad |
| ops   | sneha@quickmove.in   | Pune, Mumbai       |
| ops   | karan@quickmove.in   | Delhi-NCR, Chennai |
| ops   | anjali@quickmove.in  | Kolkata, Ahmedabad |

**Customer portal magic links** are printed at the end of `npm run seed` — open
one to see that customer's move (no password, scoped to a single relocation).

## AI on/off behavior

AI lives entirely behind `src/lib/ai/provider.ts` and is **server-side only**.

- **With `OPENAI_API_KEY` set:** documents are extracted + validated on upload,
  and the ops copilot answers from real move data.
- **Without a key (default in local dev):** the app runs in honest **degraded
  mode** — documents go to a manual-review state and the copilot returns
  deterministic answers computed from the database. No crashes, no fake AI
  claims. (The AI layer is wired up in a later build phase.)

## Deploying to Vercel (manual)

1. Push this repo to GitHub and import it into Vercel.
2. Create a Supabase **cloud** project; run the migrations against it
   (`supabase db push` with the project linked) and run `npm run seed` pointed
   at the cloud `SUPABASE_DB_URL` / keys.
3. In Vercel → Project → Settings → Environment Variables, set:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (server), `OPENAI_API_KEY` (optional),
   `OPENAI_TEXT_MODEL`, `OPENAI_VISION_MODEL`, `MAGIC_LINK_SECRET`,
   `APP_BASE_URL`, `NEXT_PUBLIC_APP_BASE_URL`.
4. Deploy. Never expose the service-role or OpenAI keys to the client.

> **Security note:** real Aadhaar/bank documents need encryption-at-rest and a
> retention policy before production. Documents are stored in private buckets
> and served only via short-lived signed URLs; every access is audit-logged.

## Demo script (reviewer walkthrough)

1. Sign in as `admin@quickmove.in` → **Dashboard / Risk Radar** flags the
   critical & at-risk moves with reasons.
2. Open a critical move → **Mission Control**: a dependency-aware, back-planned
   checklist that differs by city; proof-gated tasks can't be closed without
   proof.
3. Open a **customer portal** magic link → track progress, act on what's needed,
   upload a document, approve an apartment, message ops.
4. Watch the move-day live tracker on the move dated **today**.

## Repo map

```
src/
  app/
    (ops)/            ops cockpit (auth-guarded): dashboard, pipeline, moves/[id], cities, vendors, copilot
    portal/[token]/   customer magic-link portal
    login/            ops sign-in
  lib/
    playbook/engine.ts   the City Playbook engine (generation + derived fields)
    supabase/            client (anon), server (RLS), admin (service role)
    portal/              magic-link token verify + scoped data
    seed/                per-city playbook seed data
    ai/                  swappable OpenAI provider (degrades gracefully)
  components/         shared UI (status chips, rings, shells)
supabase/
  migrations/         schema, RLS, storage buckets
  seed.ts             idempotent seed
```

See `DECISIONS.md` for architecture decisions and `CHANGELOG.md` for milestone
history.
