---
name: trading-report
description: "[v2.0.1] Generate the daily Agentic Account portfolio snapshot from Robinhood MCP and publish it as JSON directly to GitHub (via the Contents API) so the connected GitHub Pages dashboard updates. Use this skill whenever the user asks for a portfolio report, daily summary, account performance, P&L update, how the Agentic account is doing, wants to update/publish/push the trading dashboard, or mentions data.json, the Trading-Dashboard repo, the portfolio site, or \"Trading Report\"."
---

You read Agentic Account data from Robinhood via MCP, assemble it into the fixed JSON schema below, and publish it to the `Trading-Dashboard` GitHub repo via the REST Contents API — no git, no clone, no local credentials. Runs identically manually or on a schedule (needs only network + token). **The published JSON is the deliverable, not a chat report** — chat output is a short confirmation only. Self-contained (no dependency on other skills).

## Scope

**Agentic Account only.** The other two monitoring accounts must not appear in the JSON or be queried for it.

## Read-Only Rule for Robinhood (absolute)

Call no Robinhood tool that changes account state: no placing/cancelling orders, no watchlist changes, no scan create/modify, no settings. If something looks like it needs action (e.g. a stale open order), note it in `open_orders[].stale` — do not act. The **only** write this skill performs is one authenticated update to `docs/data/data.json` via the GitHub Contents API (a normal commit under the hood, one per run) — no git, no other files, no history rewriting.

## Publishing Target & Auth

```
ORG       = "HappypsychoX"
REPO      = "Trading-Dashboard"
FILE_PATH = "docs/data/data.json"
BRANCH    = "main"                # confirm via GET /repos/{ORG}/{REPO} if this ever 404s
API_BASE  = "https://api.github.com"
```

- **Locate the token** in a `github.json` secrets file (shape `{"github": {"token": "ghp_..."}}`) inside whatever folder is connected — never hardcode a filesystem path or username. If no connected folder has it, request one named `secrets`. Same credential as `trading-agent`; reuse as-is. Read it with the Read tool (plain JSON).
- **Never print the token in chat.** It only needs to exist transiently inside one shell command.
- Required PAT scope: `repo` (contents read/write) on the repo. On 401/403, stop and report the exact error — don't try to fix or replace the token.

## Workflow

### 1. Fetch the current published data.json (your history source — no local file, no git)

Substitute the real token for `$TOKEN`:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/vnd.github+json" \
     "https://api.github.com/repos/HappypsychoX/Trading-Dashboard/contents/docs/data/data.json?ref=main"
```

- **Success:** response has `content` (base64, possibly with newlines) and `sha`. Decode `content` for the current JSON; keep `sha` for publishing.
- **404** (first-ever run): treat base history (`charts.*` arrays, `trade_quality.per_symbol`) as empty and proceed; no `sha` to pass on publish (Contents API needs `sha` only when updating).
- **Any other error (401/403/5xx):** stop and report the exact error. Do not build or publish.

You need this file's `charts.*` arrays (`equity_curve`, `realized_pnl_daily`, `benchmark_spy_close`) and `trade_quality.per_symbol` as the base to append/merge into. See the schema reference below (its `_demo_data: true` must be `false` in anything you publish).

### 2. Retrieve Robinhood data (Agentic Account only, batch where possible)

- `get_accounts` — identify the Agentic Account by number; confirm before proceeding.
- `get_equity_orders` — today, all states (filled, partial, cancelled, rejected, open/queued).
- `get_equity_positions` — open positions.
- `get_pnl_trade_history` — all-time closed trades, to recompute `trade_quality` fresh each run. Prefer full API history (the source of truth); fall back to merging the existing file's `per_symbol` only if the API can't return full history in one reasonable pass.
- `get_realized_pnl` — today's realized P&L.
- `get_portfolio` — equity, cash, buying power.
- `get_equity_quotes` — one batched call over all positions plus SPY (current price + previous close).
- `get_earnings_calendar` / `get_earnings_results` — per held symbol, for `earnings_within_7d`.
- Cross-reference open orders for standing stop-loss/take-profit per symbol → `positions[].protective_order`.

You have no memory of the session that placed today's trades — reconstruct everything from the API. Don't infer or invent rationale; this JSON is data only.

### 3. Build the JSON object

Follow the schema exactly — same keys, nesting, types (percentages as decimals like `0.05069`, not `5.069`). Field mapping:

- `_demo_data`: `false`
- `as_of`: current timestamp, ISO 8601, ET offset (e.g. `2026-07-25T16:05:00-04:00`)
- `timezone_note`: keep as-is (`"All times ET. Quotes are delayed."`)
- `account`: nickname `"Agentic"`, plus `total_value`, `equity_value`, `cash`, `buying_power`, `open_positions_count`
- `daily_pl`: `unrealized`, `realized` (null if none), `dollars`, `percent` (decimal), `same_day_open_note` (whether today's moves are from open or yesterday's close, depending on whether new positions opened today)
- `todays_trades`: one entry per order touched today — `symbol`, `side`, `quantity`, `dollar_based_amount`, `fill_price`, `value`, `fees`, `source` (`"agentic"`), `realized_gain` (null if still open), `state`
- `open_orders`: still-open/queued orders, `stale: true` if `created_at` is before today
- `positions`: one per open position — `quantity`, `avg_cost`, `cost_basis`, `current_price`, `market_value`, `unrealized_pl_dollars`, `unrealized_pl_percent`, `today_change_dollars`, `pct_of_portfolio`, `days_held`, `protective_order` (object or null), `earnings_within_7d`, `sellable_quantity` (quantity minus shares reserved by open sell orders)
- `guardrails`: report against the trading skill's parameter framework — `cash_reserve_floor`, `buying_power_deployed_today`, `position_size` (flag anything over max_pct), `new_positions_today`, `unprotected_positions`. Each with `status` `"green"`/`"yellow"`/`"red"`.

  `buying_power_deployed_today` measures **this session's spending** against `MAX_BUYING_POWER_DEPLOYED_PER_SESSION` — a per-day flow, not standing exposure. Do **not** report equity as a share of account value: that's just the inverse of `cash_reserve_floor` (one number in two tiles) and stays green on the day the agent burns its whole buying power. Compute from today's filled orders:

  ```
  deployed_dollars              = Σ today's filled BUY notional (incl. fees)
  proceeds_today                = Σ today's filled SELL proceeds
  buying_power_at_session_start = buying_power_now + deployed_dollars - proceeds_today
  current_pct                   = deployed_dollars / buying_power_at_session_start
  ```

  Publish `deployed_dollars` and `buying_power_at_session_start` alongside `current_pct`. No buys → `current_pct: 0` (a real green result). If `buying_power_at_session_start` ≤ 0, publish `current_pct: null` and explain in `note` rather than dividing by zero.
- `trade_quality`: over all-time closed Agentic trades — `closed_trades`, `win_rate`, `avg_win`, `avg_loss`, `profit_factor`, `largest_win`, `largest_loss`, `total_realized`, `realized_vs_unrealized`, `avg_holding_period_days`, `per_symbol` (realized gain per symbol, summed across closes), `sample_size_warning` (true if `closed_trades < sample_size_floor`), `sample_size_floor: 20`
- `charts`: see step 4
- `snapshot_log`: `latest_date` (today, YYYY-MM-DD), `last_trading_day`, `is_stale` (true only if you couldn't get fresh data and are re-publishing stale numbers — flag loudly in the chat confirmation if so)

### 4. Merge chart history (append-or-replace-today, never drop older entries)

For each of `charts.realized_pnl_daily`, `charts.equity_curve`, `charts.benchmark_spy_close`:

- Take the array from the file fetched in step 1 (empty if 404 first-run).
- If the last entry's `date` is today, replace it with today's fresh entry (re-running same day overwrites, not duplicates).
- Otherwise append today's entry. Never delete or reorder earlier entries.

Today's entry per array:

- `realized_pnl_daily`: `{ date, realized_gain (null if no closed trades today), number_of_trades }`
- `equity_curve`: `{ date, total_value, net_external_flow: 0 }` (no deposit/withdrawal tracking yet, so always 0 unless the user says otherwise)
- `benchmark_spy_close`: `{ date, close }` from the SPY quote

### 5. Publish via the GitHub Contents API

Write the full JSON pretty-printed (2-space indent) to a temp file, then base64-encode and PUT:

```bash
# working_data.json already written with the full pretty-printed JSON
B64=$(base64 -w0 working_data.json)

curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/HappypsychoX/Trading-Dashboard/contents/docs/data/data.json" \
  -d @- <<EOF
{
  "message": "Portfolio update - $(date +%Y-%m-%d)",
  "content": "$B64",
  "branch": "main"$( [ -n "$SHA" ] && echo ",\n  \"sha\": \"$SHA\"" )
}
EOF
```

Adjust quoting/escaping for your shell; the required fields are `message`, `content` (base64), `branch`, and `sha` if updating.

- **200/201:** done — note the returned commit `sha` (short) for the confirmation.
- **409** (stale sha — something wrote the file since step 1): re-fetch (step 1), re-apply the chart merge (step 4) against the newer data, retry the PUT **once** with the fresh `sha`. If it fails again, stop and report — don't loop or force.
- **401/403:** stop and report — a token auth/permission problem, not something to work around.
- **Any other error:** stop and report verbatim.

## Chat Output

Minimal — the JSON is the deliverable. After a successful run, a short confirmation only, e.g.:

> Published — Agentic account $1,050.00 (+$0.90 today), 3 positions, 1 trade today. Pushed to `Trading-Dashboard` (commit `<short-sha>`).

Include in that same message only if applicable: any guardrail breach/near-breach (name it plainly); any stale/unprotected position flags; any step that failed — say exactly what failed and what you did instead, don't paper over it with an estimate. If something failed partway, state plainly what succeeded and what didn't (e.g. "JSON built, but the GitHub publish failed with `<error>` — nothing was published").

Don't print the full JSON blob or reconstruct the old multi-section narrative report. If the user explicitly asks to *see* the full data in chat, that's a fine one-off exception; just don't do it by default.

---

## Reference: JSON Schema Example

Same shape every run, `_demo_data` must be `false` in real output:

```json
{
  "_demo_data": true,
  "as_of": "2026-07-24T16:05:00-04:00",
  "timezone_note": "All times ET. Quotes are delayed.",
  "account": {
    "nickname": "Agentic",
    "total_value": 1050.0,
    "equity_value": 839.5,
    "cash": 210.5,
    "buying_power": 210.5,
    "open_positions_count": 3
  },
  "daily_pl": {
    "unrealized": 0.9,
    "realized": null,
    "dollars": 0.9,
    "percent": 0.00086,
    "same_day_open_note": "PLTR was opened today, so its change is measured from its fill price rather than yesterday's close. NVDA and SOFI are measured from yesterday's close."
  },
  "todays_trades": [
    {
      "symbol": "PLTR",
      "side": "buy",
      "quantity": 1.5,
      "dollar_based_amount": 225.0,
      "fill_price": 150.0,
      "value": 225.0,
      "fees": 0.0,
      "source": "agentic",
      "realized_gain": null,
      "state": "filled"
    }
  ],
  "open_orders": [
    {
      "symbol": "NVDA",
      "side": "sell",
      "type": "stop_loss",
      "quantity": 2,
      "trigger_price": 156.5,
      "limit_price": null,
      "state": "queued",
      "created_at": "2026-07-24T09:41:00-04:00",
      "stale": false
    },
    {
      "symbol": "SOFI",
      "side": "sell",
      "type": "limit",
      "quantity": 6,
      "trigger_price": null,
      "limit_price": 24.0,
      "state": "queued",
      "created_at": "2026-07-24T09:44:00-04:00",
      "stale": false
    },
    {
      "symbol": "AMD",
      "side": "buy",
      "type": "limit",
      "quantity": 1,
      "trigger_price": null,
      "limit_price": 141.0,
      "state": "queued",
      "created_at": "2026-07-21T10:12:00-04:00",
      "stale": true
    }
  ],
  "positions": [
    {
      "symbol": "NVDA",
      "quantity": 2,
      "avg_cost": 168.25,
      "cost_basis": 336.5,
      "current_price": 174.1,
      "market_value": 348.2,
      "unrealized_pl_dollars": 11.7,
      "unrealized_pl_percent": 0.03477,
      "today_change_dollars": 0.6,
      "pct_of_portfolio": 0.33162,
      "days_held": 6,
      "protective_order": {
        "type": "stop_loss",
        "trigger_price": 156.5,
        "limit_price": null,
        "quantity": 2,
        "distance_percent": -0.10109
      },
      "earnings_within_7d": false,
      "sellable_quantity": 0
    },
    {
      "symbol": "SOFI",
      "quantity": 12,
      "avg_cost": 21.4,
      "cost_basis": 256.8,
      "current_price": 22.15,
      "market_value": 265.8,
      "unrealized_pl_dollars": 9.0,
      "unrealized_pl_percent": 0.03505,
      "today_change_dollars": -0.24,
      "pct_of_portfolio": 0.25314,
      "days_held": 3,
      "protective_order": {
        "type": "take_profit",
        "trigger_price": null,
        "limit_price": 24.0,
        "quantity": 6,
        "distance_percent": 0.08352
      },
      "earnings_within_7d": true,
      "sellable_quantity": 6
    },
    {
      "symbol": "PLTR",
      "quantity": 1.5,
      "avg_cost": 150.0,
      "cost_basis": 225.0,
      "current_price": 150.33,
      "market_value": 225.5,
      "unrealized_pl_dollars": 0.5,
      "unrealized_pl_percent": 0.00222,
      "today_change_dollars": 0.54,
      "pct_of_portfolio": 0.21476,
      "days_held": 0,
      "protective_order": null,
      "earnings_within_7d": false,
      "sellable_quantity": 1.5
    }
  ],
  "guardrails": {
    "cash_reserve_floor": {
      "floor_pct": 0.15,
      "current_pct": 0.20048,
      "status": "green",
      "note": "Cash is above the 15% floor."
    },
    "buying_power_deployed_today": {
      "max_pct": 0.85,
      "current_pct": 0.51665,
      "deployed_dollars": 225.0,
      "buying_power_at_session_start": 435.5,
      "status": "green",
      "note": "Spent $225.00 of the $435.50 buying power available at session start (51.7%), within the 85% per-session ceiling."
    },
    "position_size": {
      "max_pct": 0.35,
      "largest_position": "NVDA",
      "largest_position_pct": 0.33162,
      "over_limit": [],
      "status": "yellow",
      "note": "NVDA is at 33.2% of portfolio, approaching the 35% single-position cap."
    },
    "new_positions_today": {
      "count": 1,
      "max_per_day": 3,
      "status": "green",
      "note": "1 new position opened today (PLTR)."
    },
    "unprotected_positions": {
      "count": 1,
      "symbols": ["PLTR"],
      "status": "yellow",
      "note": "PLTR has no standing stop-loss or take-profit order."
    }
  },
  "trade_quality": {
    "closed_trades": 12,
    "win_rate": 0.58333,
    "avg_win": 14.22,
    "avg_loss": -8.05,
    "profit_factor": 2.47,
    "largest_win": 31.4,
    "largest_loss": -18.9,
    "total_realized": 59.29,
    "realized_vs_unrealized": {
      "realized": 59.29,
      "unrealized": 21.2
    },
    "avg_holding_period_days": 4.3,
    "per_symbol": [
      { "symbol": "NVDA", "realized_gain": 24.1, "closed_trades": 3 },
      { "symbol": "SOFI", "realized_gain": 18.59, "closed_trades": 4 },
      { "symbol": "RIVN", "realized_gain": 12.3, "closed_trades": 2 },
      { "symbol": "F", "realized_gain": 10.7, "closed_trades": 2 },
      { "symbol": "AMD", "realized_gain": -6.4, "closed_trades": 1 }
    ],
    "sample_size_warning": true,
    "sample_size_floor": 20
  },
  "charts": {
    "equity_curve": [
      { "date": "2026-07-20", "total_value": 1021.4, "net_external_flow": 0 },
      { "date": "2026-07-21", "total_value": 1033.75, "net_external_flow": 0 },
      { "date": "2026-07-22", "total_value": 1028.6, "net_external_flow": 0 },
      { "date": "2026-07-23", "total_value": 1044.2, "net_external_flow": 0 },
      { "date": "2026-07-24", "total_value": 1050.0, "net_external_flow": 0 }
    ],
    "realized_pnl_daily": [
      { "date": "2026-07-20", "realized_gain": 8.15, "number_of_trades": 2 },
      { "date": "2026-07-21", "realized_gain": null, "number_of_trades": 1 },
      { "date": "2026-07-22", "realized_gain": -6.4, "number_of_trades": 1 },
      { "date": "2026-07-23", "realized_gain": 12.3, "number_of_trades": 2 },
      { "date": "2026-07-24", "realized_gain": null, "number_of_trades": 1 }
    ],
    "benchmark_spy_close": [
      { "date": "2026-07-20", "close": 638.42 },
      { "date": "2026-07-21", "close": 641.07 },
      { "date": "2026-07-22", "close": 639.85 },
      { "date": "2026-07-23", "close": 644.31 },
      { "date": "2026-07-24", "close": 645.9 }
    ]
  },
  "snapshot_log": {
    "latest_date": "2026-07-24",
    "last_trading_day": "2026-07-24",
    "is_stale": false
  }
}
```
