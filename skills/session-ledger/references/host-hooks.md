# Automatic logging with host hooks

Agent Skills are loaded on demand: the host decides when to activate a skill.
A skill alone cannot guarantee an end-of-turn callback. If the team needs a
ledger entry after **every** turn, add a host-level rule or hook that either
reminds the agent to use this skill or appends the entry itself.

## What the hook needs

To fill an entry without guessing, the hook should provide:

- `session_id` and `session_started_at`
- turn start/finish timestamps (for `since_t0` and `duration_sec`)
- requested/used model and `model_variant`
- input/output token counts and billed cost, when available
- the user request and a short outcome

If a field is unavailable, write `null` / `unknown` — never invent it.

## Host examples

Check your host's current documentation; hook names and payloads change.

### Claude Code

Use a `Stop` hook in `.claude/settings.json` to run a script after the agent
finishes a turn. The hook receives JSON on stdin (session id, transcript path,
cwd). Parse what you need and append to `session-ledger/YYYY-MM-DD.yaml`.

### Cursor

Use an `afterAgentResponse` or `stop` hook (see Cursor's hooks reference) to
run the same script. Cursor hooks can pass the response and session context;
map only the fields the hook actually exposes.

### OpenCode

OpenCode loads skills on demand and, as of **v2.3.2**, does not emit
`session.idle` for an ordinary turn — a skill, or a plugin waiting on that
event, silently logs nothing. Use a server plugin and subscribe to the event
stream instead:

- `session.execution.succeeded` — fires once when a turn's execution finishes.
  This is the trigger to use.
- `session.idle` — present in the event schema, but not observed in v2.3.2;
  keep it registered as a fallback.
- `session.step.ended` and `session.usage.updated` — per model step, carrying
  that step's `cost` and `tokens` when per-step granularity is needed.

Two details change the numbers:

1. **A turn is not one message.** OpenCode writes one assistant message per
   model step (tool calls included). Take everything after the newest `user`
   message, sum `tokens.*` and `cost` across those messages, and take `model`,
   `time.completed` and the final text from the last one.
2. **The plugin runs in the OpenCode server**, not in a shell hook: read the
   transcript with `ctx.session.context({ sessionID })` and write with
   `node:fs` into the session's location directory.

Field mapping:

| Ledger field | OpenCode source |
| --- | --- |
| `session_id` | event `data.sessionID` |
| `session_started_at` | `time.created` of the first `user` message |
| `timestamp` | `time.completed` of the last assistant message |
| `since_t0`, `duration_sec` | difference from the turn's `user.time.created` |
| `tokens.input`, `output`, `reasoning` | summed `tokens.*` over the turn |
| `tokens.cache_read`, `cache_write` | summed `tokens.cache.read` / `cache.write` |
| `cost.usd` | summed `cost` (`note: provider`) |
| `used_model` | last message's `model.providerID/model.id` |
| `model_variant` | `model.variant` |
| `user_request` | `text` of the newest `user` message |
| `outcome` | `content[]` parts with `type: "text"` from the last assistant message |
| `files_touched` | `snapshot.files` of the last assistant message |

OpenCode does not expose "what the user picked in the UI" separately from the
model that ran, so `requested_model` gets the same value as `used_model`.

A ready-to-copy implementation lives in `.opencode-plugin/`: copy it to
`.opencode/plugins/session-ledger/` (plugins under `.opencode/plugins/` load
automatically) and keep the skill installed for the schema and manual runs. The
ledger directory defaults to `session-ledger` and can be changed with the
plugin's `directory` option.

### Codex

Use the `notify` command or a wrapper script around the CLI. If the host does
not expose usage/cost, leave those fields null.

### Gemini CLI

Use an extension/hook if available, or invoke the skill manually with
`/skills`. Do not assume a hook exists.

## Safer default

If you cannot add a hook, keep the skill manual: invoke it at the end of a
turn or ask the agent to log the turn. The ledger stays accurate because every
entry is explicit.
