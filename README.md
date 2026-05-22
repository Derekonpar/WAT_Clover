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

Open **http://127.0.0.1:5173** — Sales tab shows all food & beverage line items with a date range picker. Inventory tab is a placeholder for Google Sheets + Twilio reorder alerts.

Production build (local):

```bash
cd web && npm install && npm run build
cd .. && python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8787
# UI served from web/dist at http://localhost:8787
```

## Deploy on Vercel

1. Import https://github.com/Derekonpar/WAT_Clover in Vercel (root directory: `.`, no monorepo subpath).
2. **Environment variables** (Project → Settings → Environment Variables):
   - `CLOVER_API_TOKEN`
   - `CLOVER_MERCHANT_ID`
   - `CLOVER_BASE_URL` = `https://api.clover.com` (optional)
3. Redeploy after env vars are set.

`vercel.json` builds the React app to `web/dist` and routes `/api/*` to the Python FastAPI handler in `api/index.py`.

## Notes

- Read-only API calls only.
- Monetary values are in Clover minor units (usually cents).
- If results look off, verify line-item naming in Clover and adjust matching mode.
