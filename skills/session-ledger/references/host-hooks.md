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
