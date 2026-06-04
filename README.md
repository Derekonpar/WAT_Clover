# Clover Sales Agent

This agent pulls beverage sales data from Clover using your API token and answers customizable questions like:
- How much Michelob Ultra did I sell last week?
- How many units of Modelo sold between two dates?

## 1) Configure secrets (required)

Copy `.env.example` to `.env` and fill in values:

- `CLOVER_API_TOKEN`
- `CLOVER_MERCHANT_ID`
- optional `CLOVER_BASE_URL` (defaults to `https://api.clover.com`)

Example:

```bash
cd /Users/derekpethel/onpar-agents/departments/clover-sales-agent
cp .env.example .env
```

## 2) Run the query script

Last week (previous Monday-Sunday):

```bash
cd /Users/derekpethel/onpar-agents/departments/clover-sales-agent
set -a; source .env; set +a
python3 scripts/clover_sales_agent.py --item "Michelob Ultra" --last-week
```

Custom date range:

```bash
python3 scripts/clover_sales_agent.py --item "Michelob Ultra" --start-date 2026-05-01 --end-date 2026-05-07
```

Exact name match:

```bash
python3 scripts/clover_sales_agent.py --item "Michelob Ultra" --last-week --exact
```

## Output

The script writes:
- JSON summary to `data/`
- CSV line-item matches to `data/`

and prints a compact JSON result to stdout.

## Customizable knobs

- item name (`--item`)
- date range (`--last-week` OR `--start-date/--end-date`)
- contains vs exact matching (`--exact`)
- output directory (`--output-dir`)

## Web dashboard (sales by date range)

```bash
cd /Users/derekpethel/onpar-agents/departments/clover-sales-agent
chmod +x run_dashboard.sh
./run_dashboard.sh
```

Open **http://127.0.0.1:5173** — Usage, beer inventory, and liquor inventory tabs.

### Supabase (inventory par)

1. In Supabase SQL editor, run:
   - `supabase/migrations/001_usage_weekly.sql`
   - `supabase/migrations/002_liquor_par.sql`
   - `supabase/migrations/004_beer_pack_size.sql` (or re-run `RUN_ALL_IN_SQL_EDITOR.sql` if starting fresh)
2. Add to `.env`:
   - `SUPABASE_URL` (or `SUPABASE_PROJECT_ID`)
   - `SUPABASE_SERVICE_ROLE_KEY` (recommended) or `SUPABASE_PUBLISHABLE_KEY`
3. On the **Usage** tab, click **Sync last 8 weeks to Supabase** (pulls Clover history into `usage_weekly`).
4. **Beer inventory**: read-only par from **6-week average** weekly beer sales in `usage_weekly` (includes High Noon), rounded up to multiples of 24.
5. **Liquor inventory**: read-only par from fixed **`liquor_par`** rows (build-to-par for shots/cocktails — not usage-based). Edit `docs/liquor-par-build.yaml`, then run:

```bash
python3 scripts/setup_inventory_par.py
```

This tests Supabase, syncs usage (cached), seeds liquor par, and prints beer par summary. Use `--refresh` only when you need fresh Clover pulls.

Production build (local):

```bash
cd web && npm install && npm run build
cd .. && python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8787
# UI served from web/dist at http://localhost:8787
```

## Deploy on Vercel

1. Import https://github.com/Derekonpar/WAT_Clover in Vercel (root directory: `.`).
2. **Environment variables** (Project → Settings → Environment Variables):
   - `CLOVER_API_TOKEN`
   - `CLOVER_MERCHANT_ID`
   - `CLOVER_BASE_URL` = `https://api.clover.com` (optional)
3. Redeploy after env vars are set.

Build outputs the React app to `web/dist`. API routes are Node serverless functions in `api/health.js` and `api/sales.js`.

### Vercel env vars (required — not your local `.env`)

Your `.env` file stays on your Mac only (it is gitignored). In Vercel:

**Project → Settings → Environment Variables** add for Production (and Preview):

| Name | Value |
|------|--------|
| `CLOVER_API_TOKEN` | your Clover API token |
| `CLOVER_MERCHANT_ID` | `F94ACDTMC3C51` (or your merchant id) |
| `CLOVER_BASE_URL` | `https://api.clover.com` |
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `GMAIL_SENDER` | beer order sender email |
| `GMAIL_APP_PASSWORD` | Gmail app password |
| `PROVI_RETAILER_ID` | `403032` (Wild Axe Throwing) |
| `PROVI_OHLQ_ACCOUNT_NUMBER` | `9609977` |
| `PROVI_COOKIES_JSON` | run locally: `python3 scripts/provi/export_vercel_env.py` — paste the one-line JSON |

**Liquor → Provi cart** uses `api/send-liquor-orders.js` on Vercel (same as local Python path). Refresh `PROVI_COOKIES_JSON` after `python3 scripts/provi/setup_session.py` when Provi session expires.

Then **Redeploy**. Test: `https://your-app.vercel.app/api/health` should return `{"ok":true,...}` not 404.

## Notes

- Read-only API calls only.
- Monetary values are in Clover minor units (usually cents).
- If results look off, verify line-item naming in Clover and adjust matching mode.
