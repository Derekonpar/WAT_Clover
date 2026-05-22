# AGENTS.md — Clover Sales Agent

This department owns Clover beverage-sales analytics for On Par.

Goals:
- Pull sales data from Clover API using API token auth.
- Answer ad-hoc questions like: "How many Michelob Ultra sold last week?"
- Keep logic customizable (date ranges, item names, endpoint templates, output format).
- Preserve auditability (log queries, save raw and summarized outputs).

Security rules:
- Never hardcode or commit API keys/tokens.
- Read secrets only from env vars.
- Do not print full secrets in logs.

Data rules:
- Store structured output in data/.
- Store run logs in logs/.
- Keep temporary notes in memory/scratchpad.md.

Approval gates:
- Read-only Clover API calls are allowed.
- Any write/mutation request to Clover requires explicit approval.
