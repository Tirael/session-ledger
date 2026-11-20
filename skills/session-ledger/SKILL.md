---
name: session-ledger
description: >-
  Maintain a local YAML session ledger across any coding agent (Cursor,
  Claude Code, Codex, Gemini CLI, and others). When active, append one
  structured entry after each user turn with timestamp, session id, user
  request, requested model, chosen response variant, cost, used model,
  duration, input/output token counts, and position on the session timeline
  as "T0 + …". Use at the end of each turn or when the user asks to log work.
license: MIT
---

# Session Ledger

Keep a lightweight, append-only YAML log of agent turns so the team can review
what was asked, which model path was chosen, when it fell on the session
timeline, how long it took, token use, and what it cost.

Works with any Agent Skills–compatible host. Do not assume Cursor-only paths or UI.

## When to use

- **At the end of each user turn while this skill is active** (loaded by the
  host or invoked by the user), or when the user invokes `/session-ledger` /
  asks to log the turn.
- When the user asks to log or journal agent activity.
- Skip only if the user explicitly disables logging for the session.

> Agent Skills are loaded on demand; a skill alone cannot guarantee an
> end-of-turn callback. For automatic logging, pair it with a host rule or
> hook — see `references/host-hooks.md`.

## Log location

- Directory (project root, host-agnostic): `session-ledger/`
- File per calendar day (user timezone if known, else UTC date):
  `session-ledger/YYYY-MM-DD.yaml`
- Create the directory and file if missing.
- Append only — do not rewrite or reorder prior entries unless fixing a clear
  error in the latest entry from this turn.
- With several agents writing at once, append under a file lock or use one file
  per session to avoid interleaved YAML.
- Do **not** write under `.cursor/` or other product-specific folders unless the
  user explicitly asks for a different path.

## Entry schema

Each file is a YAML document with top-level `date` and `entries` (and optional
`schema_version`). Append one object:

```yaml
schema_version: 1
date: "YYYY-MM-DD"
entries:
  - id: "2026-11-13T15-30-00Z-a1b2"   # unique within the day; UTC stamp + short suffix
    session_id: "sess-2026-11-13-a1b2" # stable id for this conversation
    session_started_at: "2026-11-13T18:23:00+03:00" # T0, if known; null/omit if unknown
    host: "cursor"              # cursor | claude-code | codex | gemini-cli | …
    timestamp: "2026-11-13T18:30:00+03:00"  # when the turn finished
    since_t0: "T0 + 0s"         # offset of this turn's START from T0
    duration_sec: 420           # wall-clock turn length; null if unknown
    tokens:
      input: 18400              # prompt / input tokens; null if unknown
      output: 2600              # completion / output tokens; null if unknown
      # cache_read: 0           # optional
      # cache_write: 0          # optional
    user_request: |
      Short faithful summary of what the user asked (not a novel).
    requested_model: "auto"     # what the user asked for / selected in UI if known; else "unknown"
    chosen_variant: "primary"   # how this turn relates to the previous answer (see below)
    used_model: "composer-2"    # model that actually ran this turn if known; else "unknown"
    model_variant: "high"       # reasoning/effort variant if exposed; omit if unknown
    cost:
      usd: null                 # provider/host amount when known; null if unknown
      note: "unknown"           # e.g. openrouter | estimate | from-ui | unknown
    outcome: |
      1–3 sentences: what you did or answered.
    files_touched: []           # relative paths you meaningfully edited; omit or [] if none
    tags: []                    # optional short labels, e.g. [api, refactor]
```

Field rules:

| Field | Required | Notes |
| --- | --- | --- |
| `schema_version` | no | Optional; `1` for this schema |
| `id` | yes | UTC stamp + short suffix; unique within the file; may differ from the local `date` near midnight |
| `session_id` | yes | Stable id for the conversation/session |
| `session_started_at` | no | T0 timestamp with offset, or null/omit |
| `host` | no | Host/agent name (`cursor`, `claude-code`, `codex`, `gemini-cli`, …) |
| `timestamp` | yes | When the turn finished; include timezone offset |
| `since_t0` | yes | Offset of this turn's start from T0, or `unknown` |
| `duration_sec` | yes | Whole seconds of wall-clock turn time, or `null` if unknown |
| `tokens.input` | yes | Input/prompt tokens for the turn, or `null` if unknown |
| `tokens.output` | yes | Output/completion tokens for the turn, or `null` if unknown |
| `tokens.cache_read` | no | Optional cache-read tokens |
| `tokens.cache_write` | no | Optional cache-write tokens |
| `user_request` | yes | Core ask only; redact secrets |
| `requested_model` | yes | User intent / UI selection (`auto`, `claude`, slug, or `unknown`) |
| `chosen_variant` | yes | See variants below |
| `used_model` | yes | Actual model id/slug if available, else `unknown` |
| `model_variant` | no | Model variant/effort (`high`, `max`, `low`, `default`, …) if exposed |
| `cost.usd` | yes | Provider/host spend when known, else `null` (see `cost`) |
| `cost.note` | no | Source of the figure (`openrouter`, `estimate`, …) |
| `outcome` | yes | Brief result summary |
| `files_touched` | no | Edited paths only |
| `tags` | no | Sparse keywords |

### `since_t0`

- String mark of where this turn **starts** on the session timeline.
- **T0** = start of the current agent conversation/run (first user message),
  not calendar midnight. Prefer `session_started_at` when the host exposes it.
- Format (exact):
  - `T0` — at session start (optional alias for the first mark)
  - `T0 + 0s` — this turn starts at T0 (only if it really is the first turn)
  - `T0 + 45s` — under one minute
  - `T0 + 1m27s` — over one minute
  - `T0 + 20m50s` — minutes and seconds
  - `T0 + 1h05m12s` — hours, minutes, seconds as needed
- `timestamp` is when the turn **finished**; `since_t0` is when it **started**.
  To get the finish offset, add `duration_sec`.
- Always use the literal prefix `T0 + ` (space around `+`) except for bare `T0`.
- Omit zero higher units (`T0 + 5m`, not `T0 + 0h5m0s`). Use whole seconds only.
- If session start is unknown, set `since_t0: unknown` — do not invent.
- If the host does not expose session start but does expose a session id, derive
  T0 from the earliest entry in this day file with the same `session_id` and a
  known `session_started_at`; otherwise use `unknown`.
- Do not mix unrelated sessions into one T0 timeline in the same day file. Use
  `session_id` to distinguish sessions; if a day file would contain several
  unrelated sessions, prefer separate files or keep their timelines separate.

### `duration_sec`

- Prefer measured wall-clock time from turn start to finish (integer seconds).
- If only a rough estimate is available, round to the nearest second and mark
  it in `tags` as `estimate` — do not invent precision.
- If unknown, use `null` (never invent duration).
- Distinct from `since_t0`: duration is how long **this turn** took;
  `since_t0` is where this turn **starts** on the session timeline.

### `tokens`

- Record whole-turn totals when the host exposes them (`input` / `output`).
- Do not invent counts; use `null` for either side when unknown.
- Cache-read / cache-write tokens are optional extras: `tokens.cache_read` and
  `tokens.cache_write` may be added when the host exposes them. If you only
  have a single “input” figure, put it in `tokens.input` and leave extras out.

### `cost`

Prefer the **actual amount charged by the provider**, not a hand-calculated
estimate from a price table.

**OpenRouter (summary):**

1. **Per-turn ledger cost → `usage.cost` on the completion/Responses response**
   (fallback: generation `total_cost`). Sum if the turn made several calls.
   `usage.cost` is included automatically; no extra request parameter is needed.
   OpenRouter reports this figure in credits; credits are USD-denominated
   (1 credit = $1), so store it as `cost.usd` with `note: openrouter`.
2. **Do not use `GET /api/v1/activity` for turn rows** — it returns daily /
   endpoint aggregates. A 403 there usually means a normal inference key was
   used (or a management key without `activity:view_all`); that does not block
   ledger cost if `usage.cost` is available.
3. Management key (for `/activity` and other admin APIs only): create at
   https://openrouter.ai/settings/management-keys — details, storage
   (`OPENROUTER_MANAGEMENT_KEY` in gitignored `.env`), and full mapping are in
   `references/openrouter-cost.md`.
4. Missing figure → `usd: null`, `note: unknown`. Never invent spend.

This path applies when the agent itself makes the OpenRouter call and can see
the response. If the host hides usage/cost, leave `usd: null`.

Other providers: same rule — use the billed field from the response or
usage API when available; otherwise `null`. Use `note: estimate` only when
the user or host explicitly provides an estimate (never silent guessing).

### `chosen_variant` values

Record how **this turn** relates to the previous answer, based on the user's
current message. Do not try to predict what the user will choose later.

- `primary` — main request; no explicit alternative or correction
- `alternative-N` — user explicitly selected or continued an alternative
  (`alternative-1`, …)
- `follow-up` — user corrected or steered the previous answer
- `rejected` — user asked to discard or undo the previous answer
- `unknown` — cannot tell

If the product exposes a clearer label (e.g. plan name), put that string instead.

### `model_variant`

- Optional label for the model's reasoning/effort variant, e.g. `high`, `max`,
  `low`, `default`.
- Use the host's own label when it exposes one (OpenCode `variant`,
  OpenRouter `reasoning.effort`).
- Omit the field when the host does not expose a variant; do not invent one.
- `used_model` remains the model id/slug; keep the variant separate.

## Workflow (every turn)

1. Derive today’s date → path `session-ledger/YYYY-MM-DD.yaml`.
2. If the file is missing, create:

   ```yaml
   # session-ledger daily log
   schema_version: 1
   date: "YYYY-MM-DD"
   entries: []
   ```

3. Determine session identity:
   - Use the host’s conversation/session id when available.
   - Otherwise generate a stable id at the first logged turn (e.g.
     `sess-YYYY-MM-DD-<short suffix>`) and reuse it for the rest of the session.
   - Record `session_started_at` when known; otherwise omit it or use `null`.
4. Gather fields from this turn. Prefer facts over guesses:
   - Build `id` from the turn finish UTC time:
     `YYYY-MM-DDTHH-MM-SSZ-<4+ alphanumeric suffix>`.
   - Model / model_variant / cost / duration / since_t0 / tokens: use values
     from the host UI, provider response (`usage`), tooling, or user message.
   - For OpenRouter (and similar), follow the `cost` section above.
   - If unknown, set `unknown` / `null` — do not invent spend, duration, T0 offset, or token counts.
5. Append the new object under `entries`.
6. Keep the rest of the reply normal; logging is silent unless the user asked
   about the ledger.

## Privacy

- Never log API keys, tokens, passwords, `.env` contents, or raw credentials.
- Replace secrets with `(redacted)`.
- Do not paste large code blocks into `user_request` or `outcome`.
- Review `session-ledger/` before committing; it can contain user requests.

## Tips

- Keep entries short; one day file stays easy to scan.
- Prefer `tags` for filtering (`bugfix`, `spike`, `review`).
- When cost, duration, or tokens are unknown, leave `null`; for timeline use
  `since_t0: unknown` — do not invent values.
- Sort by `since_t0` for the session timeline; use `duration_sec` for
  per-turn wall-clock time.

## References

- Example day file: `assets/day.example.yaml`
- Machine-readable shape: `references/entry.schema.yaml`
- OpenRouter cost + Management key: `references/openrouter-cost.md`
- Automatic logging with host hooks: `references/host-hooks.md`
