# Instant local preview (localhost, hot-reload)

Run Caliber on your own machine to see changes in ~1 second instead of waiting on
a Render deploy. One-time setup, then it's just `npm run dev`.

## One-time setup

### 1. Install the prerequisites (skip any you already have)
- **Node.js LTS** (v20+): https://nodejs.org  → download the LTS installer, run it.
- **Git**: https://git-scm.com/downloads
- Verify in a terminal: `node -v` and `git --version` should print versions.

### 2. Get the code
```bash
git clone https://github.com/AimanSadeq/vifm-assessment-center.git
cd vifm-assessment-center
git checkout master
npm install
```

### 3. Create `.env.local` with your keys
Copy the template, then fill in the three Supabase values (the only ones needed
to preview the app):
```bash
cp .env.local.example .env.local
```
Open `.env.local` and set:
```
NEXT_PUBLIC_SUPABASE_URL=...          # from Render → vifm-assessment-center → Environment
NEXT_PUBLIC_SUPABASE_ANON_KEY=...     # same place
SUPABASE_SERVICE_ROLE_KEY=...         # same place
# Optional — only needed to test the SQL assessment block locally:
SANDBOX_DATABASE_URL=...              # the Render sandbox DB External URL + ?sslmode=require
```
> Get these from **Render → vifm-assessment-center → Environment** (the values
> are already there). Use the sandbox DB's **External** URL locally (Internal
> only works inside Render). Never commit `.env.local`.

### 4. Run it
```bash
npm run dev
```
Open **http://localhost:3000**. Log in with your admin account
(`asadeq@viftraining.com`). Go to **/admin/tech-sandbox**.

## Day-to-day loop
- To get my latest changes: `git pull` (in the project folder), then the dev
  server hot-reloads automatically — no restart, no deploy.
- Edit-and-see for your own tweaks is instant: save a file → the page updates.
- Stop the server with `Ctrl+C`; restart with `npm run dev`.

## Notes
- This runs against the **same Supabase database** as production, so data you
  create locally is real. Use test/demo entries.
- The SQL assessment block needs `SANDBOX_DATABASE_URL`; everything else works
  with just the three Supabase keys.
- If a page looks stale after pulling, stop and run `npm run dev:clean` (clears
  the `.next` cache).
