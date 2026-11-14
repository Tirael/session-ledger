# session-ledger

**English** · [Русский](README.ru.md)

Agent skill that appends a **local YAML ledger** after each turn: what was asked, which model path ran, where it sits on the session timeline (`T0 + …`), how long it took, token use, and (when known) cost.

Host-agnostic: works with Cursor, Claude Code, Codex, Gemini CLI, and any Agent Skills–compatible agent.

## Install

Copy `skills/session-ledger/` into the skills directory your agent loads:

| Host | Typical path |
| --- | --- |
| Cursor | `.cursor/skills/session-ledger/` or `.agents/skills/session-ledger/` |
| Claude Code | `.claude/skills/session-ledger/` or `~/.claude/skills/session-ledger/` |
| Codex | `.codex/skills/session-ledger/` or `~/.codex/skills/session-ledger/` |
| Generic / Agent Skills | `.agents/skills/session-ledger/` |

Optional: this repo also has `.cursor-plugin/plugin.json` if you want to distribute it as a Cursor plugin — that packaging is optional, not required to use the skill.

### Manual invoke

`/session-ledger` (where the host supports skill slash commands), or ask the agent to log the turn.

## What gets logged

Each day file lives at (project root):

```text
session-ledger/YYYY-MM-DD.yaml
```

Required fields per entry:

| Field | Meaning |
| --- | --- |
| `timestamp` | When the turn finished (with timezone offset) |
| `since_t0` | Timeline mark from session start, e.g. `T0 + 35m12s` |
| `duration_sec` | Wall-clock turn length in seconds, or `null` |
| `tokens.input` | Input/prompt tokens, or `null` |
| `tokens.output` | Output/completion tokens, or `null` |
| `user_request` | What the user asked |
| `requested_model` | Model the user asked for / selected |
| `chosen_variant` | Which answer path the user took |
| `used_model` | Model that actually ran |
| `cost.usd` | Spend if known, otherwise `null` |
| `outcome` | Short result summary |

See `skills/session-ledger/assets/day.example.yaml` and `skills/session-ledger/references/entry.schema.yaml`.

## Design notes

- **YAML** so you can filter/sort by model, timeline, duration, tokens, and cost.
- **Append-only** daily files under `session-ledger/` — not tied to one IDE.
- Structured turn metadata: models, variant, `since_t0`, duration, tokens, cost.
- `since_t0` = `T0 + …` on the session timeline; `duration_sec` = length of this turn.

## License

MIT — see [LICENSE](LICENSE).
