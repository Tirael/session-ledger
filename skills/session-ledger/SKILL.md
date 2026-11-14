---
name: session-ledger
description: >-
  Maintain a local YAML session ledger across any coding agent (Cursor,
  Claude Code, Codex, Gemini CLI, and others). After every user interaction,
  append one structured entry with timestamp, user request, requested model,
  chosen response variant, cost, used model, duration, input/output token
  counts, and position on the session timeline as "T0 + …". Use at the end
  of each turn or when the user asks to log work.
---

# Session Ledger

Keep a lightweight, append-only YAML log of agent turns so the team can review
what was asked, which model path was chosen, when it fell on the session
timeline, how long it took, token use, and what it cost.

Works with any Agent Skills–compatible host. Do not assume Cursor-only paths or UI.

## When to use

- **Always at the end of a user turn** in a project that has this skill installed
  (or when the user invokes `/session-ledger` / asks to log the turn).
- When the user asks to log or journal agent activity.
- Skip only if the user explicitly disables logging for the session.

## Log location

- Directory (project root, host-agnostic): `session-ledger/`
- File per calendar day (user timezone if known, else UTC date):
  `session-ledger/YYYY-MM-DD.yaml`
- Create the directory and file if missing.
- Append only — do not rewrite or reorder prior entries unless fixing a clear
  error in the latest entry from this turn.
- Do **not** write under `.cursor/` or other product-specific folders unless the
  user explicitly asks for a different path.

## Entry schema

Each file is a YAML document with a top-level `entries` list. Append one object:

```yaml
entries:
  - id: 2026-11-13T15-30-00Z-a1b2   # unique within the day; UTC stamp + short suffix
    timestamp: "2026-11-13T15:30:00+03:00"  # ISO-8601 with offset (prefer user zone)
    since_t0: "T0 + 20m50s"       # offset from session start (T0); "unknown" if unknown
    duration_sec: 87              # wall-clock turn length in seconds; null if unknown
    tokens:
      input: 12000            # prompt / input tokens for the turn; null if unknown
      output: 1800            # completion / output tokens for the turn; null if unknown
    user_request: |
      Short faithful summary of what the user asked (not a novel).
    requested_model: "auto"   # what the user asked for / selected in UI if known; else "unknown"
    chosen_variant: "primary" # which answer path the user took (see below)
    used_model: "composer-2"  # model that actually ran this turn if known; else "unknown"
    cost:
      usd: null               # provider/host amount when known; null if unknown
      note: "unknown"         # e.g. openrouter | estimate | from-ui | unknown
    outcome: |
      1–3 sentences: what you did or answered.
    files_touched: []         # relative paths you meaningfully edited; omit or [] if none
    tags: []                  # optional short labels, e.g. [api, refactor]
```

Field rules:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Stable id for the entry; never reuse within the file |
| `timestamp` | yes | When the turn finished; include timezone offset |
| `since_t0` | yes | Timeline mark `T0 + …` from session start, or `unknown` |
| `duration_sec` | yes | Whole seconds of wall-clock turn time, or `null` if unknown |
| `tokens.input` | yes | Input/prompt tokens for the turn, or `null` if unknown |
| `tokens.output` | yes | Output/completion tokens for the turn, or `null` if unknown |
| `user_request` | yes | Core ask only; redact secrets |
| `requested_model` | yes | User intent / UI selection (`auto`, `claude`, slug, or `unknown`) |
| `chosen_variant` | yes | See variants below |
| `used_model` | yes | Actual model id/slug if available, else `unknown` |
| `cost.usd` | yes | Provider/host spend when known, else `null` (see `cost`) |
| `cost.note` | no | Source of the figure (`openrouter`, `estimate`, …) |
| `outcome` | yes | Brief result summary |
| `files_touched` | no | Edited paths only |
| `tags` | no | Sparse keywords |

### `since_t0`

- String mark of where this entry sits on the **session timeline**.
- **T0** = start of the current agent conversation/run (first user message),
  not calendar midnight.
- Format (exact):
  - `T0` — at session start (optional alias for the first mark)
  - `T0 + 0s` — same meaning, preferred for the first logged entry
  - `T0 + 87s` — under one minute
  - `T0 + 20m50s` — minutes and seconds
  - `T0 + 1h05m12s` — hours, minutes, seconds as needed
- Always use the literal prefix `T0 + ` (space around `+`) except for bare `T0`.
- Omit zero higher units (`T0 + 5m`, not `T0 + 0h5m0s`). Use whole seconds only.
- If session start is unknown, set `since_t0: unknown` — do not invent.
- If the host does not expose session start, derive T0 from the earliest entry
  in this day file that belongs to the same session.
- Do not mix unrelated sessions into one T0 timeline in the same day file.

### `duration_sec`

- Prefer measured wall-clock time from turn start to finish (integer seconds).
- If only a rough estimate is available, round to the nearest second and set
  `tags` or leave as-is — do not invent precision.
- If unknown, use `null` (never invent duration).
- Distinct from `since_t0`: duration is how long **this turn** took;
  `since_t0` is where this turn sits on the session timeline.

### `tokens`

- Record whole-turn totals when the host exposes them (`input` / `output`).
- Do not invent counts; use `null` for either side when unknown.
- Cache-read / cache-write tokens are optional extras — if you only have a
  single “input” figure, put it in `tokens.input` and leave extras out.

### `cost`

Prefer the **actual amount charged by the provider**, not a hand-calculated
estimate from a price table.

**OpenRouter (summary):**

1. **Per-turn ledger cost → `usage.cost` on the completion/Responses response**
   (fallback: generation `total_cost`). Sum if the turn made several calls.
2. **Do not use `GET /api/v1/activity` for turn rows** — it returns daily /
   endpoint aggregates. A 403 there usually means a normal inference key was
   used; that does not block ledger cost if `usage.cost` is available.
3. Management key (for `/activity` and other admin APIs only): create at
   https://openrouter.ai/settings/management-keys — details, storage
   (`OPENROUTER_MANAGEMENT_KEY` in gitignored `.env`), and full mapping are in
   `references/openrouter-cost.md`.
4. Missing figure → `usd: null`, `note: unknown`. Never invent spend.

Other providers: same rule — use the billed field from the response or
usage API when available; otherwise `null`. Use `note: estimate` only when
the user or host explicitly provides an estimate (never silent guessing).

### `chosen_variant` values

Use the closest match:

- `primary` — default / first answer path (no explicit pick)
- `alternative-N` — user picked another option (`alternative-1`, …)
- `follow-up` — user steered with a correction mid-thread
- `rejected` — user discarded the answer / asked to undo
- `unknown` — cannot tell

If the product exposes a clearer label (e.g. plan name), put that string instead.

## Workflow (every turn)

1. Derive today’s date → path `session-ledger/YYYY-MM-DD.yaml`.
2. If the file is missing, create:

   ```yaml
   # session-ledger daily log
   date: YYYY-MM-DD
   entries: []
   ```

3. Gather fields from this turn. Prefer facts over guesses:
   - Model / cost / duration / since_t0 / tokens: use values from the host UI,
     provider response (`usage`), tooling, or user message.
   - For OpenRouter (and similar), follow the `cost` section above.
   - If unknown, set `unknown` / `null` — do not invent spend, duration, T0 offset, or token counts.
4. Append the new object under `entries`.
5. Keep the rest of the reply normal; logging is silent unless the user asked
   about the ledger.

## Privacy

- Never log API keys, tokens, passwords, `.env` contents, or raw credentials.
- Replace secrets with `(redacted)`.
- Do not paste large code blocks into `user_request` or `outcome`.

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
