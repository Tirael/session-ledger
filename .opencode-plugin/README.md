# OpenCode plugin

Server plugin for [OpenCode](https://opencode.ai) that appends a session-ledger entry whenever a turn
finishes.

A skill cannot fire on its own at the end of a turn, and OpenCode (v2.3.2) does not emit
`session.idle` for an ordinary turn, so the ledger stays empty without a host hook. This plugin
subscribes to `session.execution.succeeded` (once per completed turn), keeps `session.idle` as a
fallback, skips subagent sessions and dedupes per session.

## Install

```bash
mkdir -p .opencode/plugins
cp -R .opencode-plugin .opencode/plugins/session-ledger
```

Plugins under `.opencode/plugins/` load automatically. Keep `skills/session-ledger/` installed as
well — it documents the schema and lets you log a turn by hand.

## Configuration

Defaults need no configuration. To write the ledger somewhere else, load the plugin explicitly and
pass an option:

```jsonc
// opencode.jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [{ "package": "./.opencode/plugins/session-ledger", "options": { "directory": "docs/ledger" } }]
}
```

## Files

- `index.ts` — plugin wiring: event subscription, subagent filter, dedupe, file append.
- `ledger.ts` — pure logic: transcript → entry, YAML formatting. No host imports, so it can be run
  with plain node (`node --experimental-strip-types`).

Entries are written to `<directory>/YYYY-MM-DD.yaml` in the session's location, and the directory is
not added to `.gitignore` automatically: a ledger contains user requests, decide per project whether
it may be committed.
