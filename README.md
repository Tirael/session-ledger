# session-ledger

**English** · [Русский](README.ru.md)

Agent skill that appends a **local YAML ledger** after each turn when active: what was asked, which model path ran, where it sits on the session timeline (`T0 + …`), how long it took, token use, and (when known) cost.

Host-agnostic: works with Cursor, Claude Code, OpenCode, Codex, Gemini CLI, and any Agent Skills–compatible agent.

## Install

Copy `skills/session-ledger/` into the skills directory your agent loads:

| Host | Typical path |
| --- | --- |
| Cursor | `.cursor/skills/session-ledger/` or `.agents/skills/session-ledger/` |
| Claude Code | `.claude/skills/session-ledger/` or `~/.claude/skills/session-ledger/` |
| Codex | `.agents/skills/session-ledger/` or `~/.agents/skills/session-ledger/` |
| Gemini CLI | `.gemini/skills/session-ledger/` or `.agents/skills/session-ledger/` |
| OpenCode | `.opencode/skills/session-ledger/` |
| Generic / Agent Skills | `.agents/skills/session-ledger/` |

Codex still reads the legacy `~/.codex/skills/` path, but `.agents/skills/` is the documented location.

User-level paths: `~/.cursor/skills/` or `~/.agents/skills/` (Cursor),
`~/.claude/skills/` (Claude Code), `~/.agents/skills/` (Codex),
`~/.gemini/skills/` or `~/.agents/skills/` (Gemini CLI).

Optional: this repo also has `.cursor-plugin/plugin.json` if you want to distribute it as a Cursor plugin — that packaging is optional, not required to use the skill.

OpenCode needs more than a skill: it loads skills on demand and does not emit
`session.idle`, so this repo also ships `.opencode-plugin/`, a server plugin
that appends an entry on `session.execution.succeeded`. Copy it to
`.opencode/plugins/session-ledger/`; the ledger directory is `session-ledger`
unless you pass a `directory` option. See
`skills/session-ledger/references/host-hooks.md` for the event list and field
mapping.

### Manual invoke

`/session-ledger` where the host supports skill slash commands. In Codex use
`$session-ledger` or `/skills`; in Gemini CLI use `/skills` or ask in natural
language. You can also ask the agent to log the turn.

### Automatic logging

Agent Skills are loaded on demand. To log every turn without relying on the
model to remember, add a host rule or hook. See
`skills/session-ledger/references/host-hooks.md`.

## What gets logged

Each day file lives at (project root):

```text
session-ledger/YYYY-MM-DD.yaml
```

Required fields per entry:

| Field | Meaning |
| --- | --- |
| `id` | Unique entry id (UTC stamp + suffix) |
| `session_id` | Stable conversation/session id |
| `timestamp` | When the turn finished (with timezone offset) |
| `since_t0` | Offset of this turn's start from session start, e.g. `T0 + 35m12s` |
| `duration_sec` | Wall-clock turn length in seconds, or `null` |
| `tokens.input` | Input/prompt tokens, or `null` |
| `tokens.output` | Output/completion tokens, or `null` |
| `user_request` | What the user asked |
| `requested_model` | Model the user asked for / selected |
| `chosen_variant` | How this turn relates to the previous answer |
| `used_model` | Model that actually ran |
| `cost.usd` | Spend if known, otherwise `null` |
| `outcome` | Short result summary |

Optional: `session_started_at`, `host`, `model_variant`, `tokens.cache_read`,
`tokens.cache_write`, `cost.note`, `files_touched`, `tags`.

Prefer provider-billed **per-turn** cost (OpenRouter `usage.cost` / generation
`total_cost`), not `/activity` aggregates. Management key setup and `.env`
variable names: `skills/session-ledger/references/openrouter-cost.md`.

See `skills/session-ledger/assets/day.example.yaml` and `skills/session-ledger/references/entry.schema.yaml`.

## Design notes

- **YAML** so you can filter/sort by model, timeline, duration, tokens, and cost.
- **Append-only** daily files under `session-ledger/` — not tied to one IDE.
- Structured turn metadata: models, variant, `since_t0`, duration, tokens, cost.
- `since_t0` = offset of the turn start from `T0`; `duration_sec` = length of this turn.
- `session_id` keeps multiple conversations in one day file distinguishable.

## Privacy

The ledger can contain user requests. Redact secrets, and review
`session-ledger/` before committing it.

## License

MIT — see [LICENSE](LICENSE).
