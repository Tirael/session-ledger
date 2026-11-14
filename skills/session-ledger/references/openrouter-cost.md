# OpenRouter cost for session-ledger

How to fill `tokens` and `cost` when the project routes models through
[OpenRouter](https://openrouter.ai/).

## Prefer per-turn `usage.cost` (not `/activity`)

For **one ledger entry = one agent turn**, use the billed figure from the
**completion (or Responses) call itself**:

| Source | Use for ledger? | Why |
| --- | --- | --- |
| `usage.cost` on the Chat Completions / Responses payload | **Yes — preferred** | Exact charge for that call; maps 1:1 to a turn (sum if several calls) |
| `GET /api/v1/generation?id=gen-…` → `total_cost` | Yes — fallback | Same per-generation amount when the stream/host omitted `usage.cost` |
| `GET /api/v1/activity` | **No for per-turn rows** | Daily/endpoint aggregates over completed UTC days — not a single turn |

If a tool or agent says “per-turn cost unavailable: `/activity` returned 403”,
that path is the wrong one for session-ledger. Fix the completion `usage`
path (or generation id lookup). Do **not** treat `/activity` 403 as a reason
to invent `cost.usd`; leave `null` until `usage.cost` / `total_cost` is
available.

### Mapping

```yaml
tokens:
  input: 9200        # usage.prompt_tokens or usage.input_tokens
  output: 1100       # usage.completion_tokens or usage.output_tokens
cost:
  usd: 0.0015        # usage.cost or generation total_cost
  note: openrouter
```

- Several OpenRouter calls in one turn → **sum** costs and token counts.
- Missing figure → `usd: null`, `note: unknown`.
- OpenRouter cost is in **credits**; when 1 credit = $1, store as `cost.usd`.
  Otherwise convert and set `note` (e.g. `openrouter-credits`).

## Management API key (for `/activity` and admin APIs)

A normal inference key (`sk-or-v1-…`) **cannot** call management/analytics
routes. `GET /api/v1/activity` responds **403** with a message like
“Only management keys can perform this operation”.

### How to create the key

1. Open **Management API Keys**:  
   https://openrouter.ai/settings/management-keys  
2. Click **Create New Key** (or **New management key** in a workspace).
3. Name it, pick expiration / access level.
4. For workspace-scoped keys that must read activity, grant
   **`activity:view_all`** on that workspace.
5. Copy the key **once** when shown — it cannot be viewed again.

Docs:  
https://openrouter.ai/docs/guides/overview/auth/management-api-keys

Management keys are for admin/analytics only — they must **not** be used as
the chat/completions API key.

### When you still need `/activity`

Optional account-level or daily rollups (dashboards, reconciliation). Not for
filling `session-ledger/YYYY-MM-DD.yaml` turn rows.

## Where to store keys in the project

Keep **two** secrets separate:

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Inference (chat/completions). Source of `usage.cost`. |
| `OPENROUTER_MANAGEMENT_KEY` | Management/analytics only (`/activity`, key admin, …). |

**In-repo convention (consumer projects using this skill):**

1. Put values in a **gitignored** `.env` at the project root (or the host’s
   secret store — Cursor secrets, CI secrets, vault). Never commit real keys.
2. Example (safe to commit as a template only):

   ```bash
   # .env.example — copy to .env and fill locally
   OPENROUTER_API_KEY=
   OPENROUTER_MANAGEMENT_KEY=
   ```

3. Load `.env` via the runtime you already use (`dotenv`, direnv, host env).
4. Do **not** put either key in `session-ledger/*.yaml`, `SKILL.md`, or chat
   logs. Ledger `cost.note` may say `openrouter`; never paste the secret.

If the agent host injects only `OPENROUTER_API_KEY`, that is enough for
per-turn ledger cost via `usage.cost`. Add `OPENROUTER_MANAGEMENT_KEY` only
when something explicitly needs Management API routes.
