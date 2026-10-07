# Querit web search

Real-time web search (querit.ai) for research that needs sources and dates.

- **Scout:** market, competitor, and fee research.
- **Comp:** model-name lookups (e.g. confirming a garment/model name before a comp search).

## Run

```bash
export QUERIT_API_KEY=...   # founder's key; lives in web/.env.local and InstaCloud, never in the repo
node ops/querit/search.mjs "eBay final value fee clothing 2026" --n 5
```

Prints title, URL, date, and snippet per result. Exits with an error if the key is
missing. Request shape follows the `querit` Python SDK (0.1.5): `POST https://api.querit.ai/v1/search`,
Bearer auth, body `{query, count}`.

## Citation rule

Every fact taken from a result must be cited with **URL + date** (the printed date, or the date
you retrieved it if the result shows "date unknown"). No URL and date, no claim.

## Test

```bash
node --test ops/querit/search.test.mjs   # mocked response, no live calls
```
