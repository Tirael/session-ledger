// OpenCode server plugin: append a session-ledger entry whenever a turn finishes.
//
// A skill is loaded on demand and cannot guarantee an end-of-turn callback, and OpenCode v2.3.2
// does not emit `session.idle` for a normal turn. `session.execution.succeeded` fires exactly once
// per completed turn, which is the right trigger for a ledger entry.
//
// Install: copy this directory to `.opencode/plugins/session-ledger/` (or point `plugins` in
// `opencode.json(c)` at it) and keep `skills/session-ledger/` around for the schema and manual runs.

import { Plugin } from "@opencode/plugin"
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { buildEntry, formatEntry, header } from "./ledger"

const DEFAULT_DIRECTORY = "session-ledger"

export default Plugin.define({
  id: "session-ledger",
  async setup(ctx) {
    const configured = ctx.options?.directory
    const directoryName = typeof configured === "string" && configured ? configured : DEFAULT_DIRECTORY
    const controller = new AbortController()

    const record = async (sessionID: string, directory: string) => {
      const session = await ctx.session.get({ sessionID })
      // Subagent conversations are steps of a parent turn, not turns of their own.
      if (session?.parentID) return

      const messages = await ctx.session.context({ sessionID })
      const entry = buildEntry(messages as unknown as Record<string, any>[], sessionID)
      if (!entry) return

      const storageKey = `last:${sessionID}`
      const previous = (await ctx.storage.get(storageKey)) as { messageID?: string } | undefined
      if (previous?.messageID === entry.assistantMessageID) return

      await appendLedgerEntry(directory, directoryName, entry.date, formatEntry(entry))
      await ctx.storage.set(storageKey, { messageID: entry.assistantMessageID, id: entry.id })
    }

    void (async () => {
      // `session.idle` is kept as a fallback: it is in the event schema but was not emitted in v2.3.2.
      for await (const event of ctx.event.subscribe({
        types: ["session.execution.succeeded", "session.idle"],
        signal: controller.signal
      })) {
        const sessionID = event.data?.sessionID
        if (!sessionID) continue
        const directory = (event as { location?: { directory?: string } }).location?.directory ?? ctx.location.directory
        try {
          await record(sessionID, directory)
        } catch (error) {
          console.error(`[session-ledger] failed to log ${sessionID}:`, error)
        }
      }
    })()

    return () => controller.abort()
  }
})

async function appendLedgerEntry(
  directory: string,
  directoryName: string,
  date: string,
  block: string
): Promise<void> {
  const folder = join(directory, directoryName)
  const path = join(folder, `${date}.yaml`)
  await mkdir(folder, { recursive: true })

  let existing = ""
  try {
    existing = await readFile(path, "utf8")
  } catch {
    // first entry of the day
  }

  if (!existing.trim()) {
    await writeFile(path, header(date) + block, "utf8")
    return
  }

  // `entries: []` from the skill template cannot take an appended item.
  if (/entries:\s*\[\]\s*$/.test(existing)) {
    await writeFile(path, existing.replace(/entries:\s*\[\]\s*$/, "") + block, "utf8")
    return
  }

  await appendFile(path, block, "utf8")
}
