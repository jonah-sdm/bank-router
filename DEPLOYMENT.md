# Deployment Guide

Production setup: GitHub → Vercel → Supabase.

## 0. Prerequisites

- Node.js 18+
- A GitHub account with push access to a new repo (recommended: `jonah-sdm/sdm-bank-router`)
- A Supabase account ([supabase.com](https://supabase.com)) — free tier is fine for now
- A Vercel account ([vercel.com](https://vercel.com)) — free Hobby tier is fine

---

## 1. Supabase — create project and run migrations

### 1a. Create the project

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Name: `sdm-atlas-routing` (or similar)
4. Generate a strong database password and **save it** somewhere safe (1Password, etc.)
5. Region: pick the one closest to your ops team (e.g. `us-east-1`)
6. Wait ~2 minutes for provisioning

### 1b. Run the migrations

From the project dashboard, open **SQL Editor** (left sidebar). Run these three files **in order**:

1. `supabase/migrations/0001_init.sql` — creates all tables, enums, triggers, RLS
2. `supabase/migrations/0002_seed.sql` — seeds the 9 banks + sample LPs
3. `supabase/migrations/0003_affinity.sql` — seeds the 17 affinity rules

For each: open the file locally, copy its entire contents, paste into SQL Editor, click **Run**. You should see "Success. No rows returned" for the schema file and row-count confirmations for the seeds.

**Verify:** run `select count(*) from banks;` — should return `9`. Same for `lps` (`7`), `affinity_rules` (`17`).

### 1c. Grab the API credentials

From the project dashboard, **Settings → API**:

- Copy **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
- Copy **anon public** key (long JWT, safe to expose in the frontend)
- Copy **service_role** key (also JWT) — **never commit this**, only for local migrations and CI

Save these three values. You'll paste them into Vercel's environment settings in step 3.

---

## 2. GitHub — push the repo

If the repo already exists, skip to the push step.

### 2a. Create the repo

1. Go to [github.com/new](https://github.com/new)
2. Name: `sdm-bank-router`
3. **Private** (internal tool — do not make public)
4. Do NOT initialize with README / .gitignore / license (we have those locally)
5. Click **Create repository**

### 2b. Push from local

From the project root (`/Users/jonah/sdm-bank-router/.claude/worktrees/happy-mestorf/`):

```bash
# If this is a fresh local clone / worktree with no remote yet:
git init -b main
git remote add origin git@github.com:jonah-sdm/sdm-bank-router.git

# Stage everything the project needs (see .gitignore — node_modules, .env, etc. are excluded)
git add .
git commit -m "Initial production-ready release"
git push -u origin main
```

If git is already set up, just `git push` to the new remote.

---

## 3. Vercel — connect the repo and set env vars

### 3a. Import the project

1. Sign in at [vercel.com](https://vercel.com)
2. Click **Add New → Project**
3. Choose **Import Git Repository** → select `sdm-bank-router`
4. Vercel auto-detects Vite — **do not change** build/output settings
5. **Before clicking Deploy**, expand **Environment Variables** and add:

   | Name                    | Value                                | Scope              |
   |-------------------------|--------------------------------------|--------------------|
   | `VITE_SUPABASE_URL`     | your `https://…supabase.co` URL      | Production + Preview |
   | `VITE_SUPABASE_ANON_KEY`| your `anon` public key (long JWT)    | Production + Preview |

   **Do not** add the `service_role` key to Vercel — it's server-side only and our frontend never needs it.

6. Click **Deploy**

Vercel will build and deploy in about a minute. You'll get a URL like `sdm-bank-router.vercel.app`.

### 3b. (Optional) Custom domain

In the Vercel project dashboard → **Settings → Domains**, add a custom domain (e.g. `routing.sdm.internal`). Vercel will show DNS records to add to your DNS provider.

---

## 4. Supabase — lock down RLS for production

The initial migrations use permissive policies to let `anon` users CRUD everything, for dev convenience. Before sharing the URL with the team, tighten them:

In Supabase SQL Editor, run:

```sql
-- Remove permissive anon policies (keep authenticated policies)
drop policy if exists "anon read banks"         on banks;
drop policy if exists "anon write banks"        on banks;
drop policy if exists "anon read lps"           on lps;
drop policy if exists "anon write lps"          on lps;
drop policy if exists "anon read clients"       on clients;
drop policy if exists "anon write clients"      on clients;
drop policy if exists "anon read routing"       on routing_assignments;
drop policy if exists "anon write routing"      on routing_assignments;
drop policy if exists "anon read weights"       on scoring_weights;
drop policy if exists "anon write weights"      on scoring_weights;
drop policy if exists "anon read affinity"      on affinity_rules;
drop policy if exists "anon write affinity"     on affinity_rules;
```

Then enable Supabase Auth (Email magic link or Google SSO) from **Authentication → Providers**. Every authenticated user gets full CRUD under the existing `authenticated` policies. To further split into ops vs. admin roles, see the follow-up migration plan.

---

## 5. Test the live deploy

Open the Vercel URL. You should see:

- No "DEMO MODE" banner (means Supabase is connected)
- The Routing page loads
- Clicking **Registry → Banks** shows all 9 seeded banks
- Loading a seeded client (Paktra, Toofan, Northern Lights) produces a recommendation
- Any edit in the admin page reflects live on routing

If you see "DEMO MODE" on the live URL, the env vars didn't pick up — go back to **Vercel → Settings → Environment Variables**, confirm both vars are set for Production, then trigger a redeploy.

---

## 6. Ongoing workflow

### Pushing changes

Every `git push` to `main` triggers a fresh Vercel deploy automatically.

Preview deploys on pull requests: if you push a branch, Vercel creates a preview URL — useful for sharing WIP with the team before merging.

### Running migrations

When you add a new migration file to `supabase/migrations/`, run it manually in Supabase SQL Editor. Migration tooling (Supabase CLI / `supabase db push`) can be set up later — see [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli).

### Changing scoring weights, banks, LPs, affinity rules

Ops edits these via the Admin UI — no deploy needed. Changes hit the database directly through Supabase client, and every mounted page sees them via the data-change event bus.

### Rolling back

In Vercel → **Deployments** tab, find the previous good deploy and click **Promote to Production**. Instant rollback.

---

## Team checklist for first use

1. Get the production URL from Jonah
2. Sign in with email magic link (if Auth is enabled)
3. Go to `/routing`, load an existing client, explore
4. For new clients: go to `+ New → Client`, fill in the form
5. For bank/LP/rule edits: `Registry → Banks|LPs|Clients` or `Rules → Affinity|Weights`
6. Audit log at `/audit` shows every change with timestamps

## Issues / feedback

- Bug reports → GitHub issue on the `sdm-bank-router` repo
- Urgent ops blocker → ping Jonah directly
