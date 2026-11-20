// Pure ledger logic: OpenCode transcript messages -> one YAML entry.
// No host imports, so it can be exercised with plain node (`node --experimental-strip-types`).

export interface LedgerEntry {
  id: string
  date: string
  sessionID: string
  sessionStartedAt: string | null
  timestamp: string
  sinceT0: string
  durationSec: number | null
  inputTokens: number | null
  outputTokens: number | null
  reasoningTokens: number | null
  cacheRead: number | null
  cacheWrite: number | null
  steps: number
  userRequest: string
  usedModel: string
  modelVariant: string | null
  costUsd: number | null
  outcome: string
  filesTouched: string[]
  assistantMessageID: string
}

type AnyMessage = Record<string, any>

const MAX_REQUEST = 2000
const MAX_OUTCOME = 400

/**
 * The turn is everything after the newest user message. OpenCode emits one assistant message per
 * model step (tool loops), so tokens and cost are summed over the whole turn while model, timing and
 * the final text come from the last step.
 * Returns undefined when the session has no completed turn yet (aborted or empty turn).
 */
export function buildEntry(messages: AnyMessage[], sessionID: string): LedgerEntry | undefined {
  const lastUserIndex = messages.map((message) => message?.type).lastIndexOf("user")
  if (lastUserIndex < 0) return undefined

  const user = messages[lastUserIndex]
  const assistants = messages.slice(lastUserIndex + 1).filter((message) => message?.type === "assistant")
  if (assistants.length === 0) return undefined

  const lastAssistant = assistants[assistants.length - 1]
  const firstUser = messages.find((message) => message?.type === "user")
  const startedAt = numberOrNull(firstUser?.time?.created)
  const sentAt = numberOrNull(user.time?.created)
  const finishedAt =
    numberOrNull(lastAssistant.time?.completed) ?? numberOrNull(lastAssistant.time?.created) ?? Date.now()
  const duration = sentAt === null ? null : Math.max(0, Math.round((finishedAt - sentAt) / 1000))
  const offset = sentAt === null || startedAt === null ? null : sentAt - startedAt

  const model = lastAssistant.model ?? {}
  const usedModel = [model.providerID, model.id].filter(Boolean).join("/") || "unknown"
  const text = assistantText(lastAssistant)

  return {
    id: `${compactUtc(finishedAt)}-${suffix(lastAssistant.id)}`,
    date: localDate(finishedAt),
    sessionID,
    sessionStartedAt: startedAt === null ? null : isoWithOffset(startedAt),
    timestamp: isoWithOffset(finishedAt),
    sinceT0: offset === null ? "unknown" : sinceT0(offset),
    durationSec: duration,
    inputTokens: sum(assistants, (message) => message.tokens?.input),
    outputTokens: sum(assistants, (message) => message.tokens?.output),
    reasoningTokens: sum(assistants, (message) => message.tokens?.reasoning),
    cacheRead: sum(assistants, (message) => message.tokens?.cache?.read),
    cacheWrite: sum(assistants, (message) => message.tokens?.cache?.write),
    steps: assistants.length,
    userRequest: shorten(String(user.text ?? "").trim(), MAX_REQUEST),
    usedModel,
    modelVariant: typeof model.variant === "string" && model.variant ? model.variant : null,
    costUsd: sum(assistants, (message) => message.cost),
    outcome: shorten(collapse(text), MAX_OUTCOME) || "(no text in the final reply)",
    filesTouched: Array.isArray(lastAssistant.snapshot?.files)
      ? lastAssistant.snapshot.files.filter((file: unknown) => typeof file === "string")
      : [],
    assistantMessageID: String(lastAssistant.id ?? "")
  }
}

/** Deterministic YAML block for one entry (append-only: two-space indent under `entries:`). */
export function formatEntry(entry: LedgerEntry): string {
  const lines: string[] = []
  const push = (key: string, value: string) => lines.push(`    ${key}: ${value}`)

  lines.push(`  - id: ${quote(entry.id)}`)
  push("session_id", quote(entry.sessionID))
  push("host", quote("opencode"))
  if (entry.sessionStartedAt) push("session_started_at", quote(entry.sessionStartedAt))
  push("timestamp", quote(entry.timestamp))
  push("since_t0", quote(entry.sinceT0))
  push("duration_sec", value(entry.durationSec))
  lines.push("    tokens:")
  lines.push(`      input: ${value(entry.inputTokens)}`)
  lines.push(`      output: ${value(entry.outputTokens)}`)
  if (entry.reasoningTokens !== null) lines.push(`      reasoning: ${entry.reasoningTokens}`)
  if (entry.cacheRead !== null) lines.push(`      cache_read: ${entry.cacheRead}`)
  if (entry.cacheWrite !== null) lines.push(`      cache_write: ${entry.cacheWrite}`)
  lines.push(`      steps: ${entry.steps}`)
  push("user_request", quote(entry.userRequest))
  push("requested_model", quote(entry.usedModel))
  push("chosen_variant", quote("primary"))
  push("used_model", quote(entry.usedModel))
  if (entry.modelVariant) push("model_variant", quote(entry.modelVariant))
  lines.push("    cost:")
  lines.push(`      usd: ${entry.costUsd === null ? "null" : round(entry.costUsd)}`)
  lines.push(`      note: ${quote(entry.costUsd === null ? "unknown" : "provider")}`)
  push("outcome", quote(entry.outcome))

  if (entry.filesTouched.length === 0) {
    push("files_touched", "[]")
  } else {
    lines.push("    files_touched:")
    for (const file of entry.filesTouched) lines.push(`      - ${quote(file)}`)
  }

  push("tags", "[]")
  return lines.join("\n") + "\n"
}

export function header(date: string): string {
  return `# session-ledger daily log\nschema_version: 1\ndate: ${quote(date)}\nentries:\n`
}

export function sinceT0(offsetMs: number): string {
  const total = Math.max(0, Math.round(offsetMs / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  if (hours > 0) return `T0 + ${hours}h${pad(minutes)}m${pad(seconds)}s`
  if (minutes > 0) return `T0 + ${minutes}m${pad(seconds)}s`
  return `T0 + ${seconds}s`
}

function sum(messages: AnyMessage[], pick: (message: AnyMessage) => unknown): number | null {
  let total = 0
  let seen = false
  for (const message of messages) {
    const value = numberOrNull(pick(message))
    if (value === null) continue
    total += value
    seen = true
  }
  return seen ? total : null
}

function assistantText(assistant: AnyMessage): string {
  const content = Array.isArray(assistant.content) ? assistant.content : []
  return content
    .filter((part: AnyMessage) => part?.type === "text" && typeof part.text === "string")
    .map((part: AnyMessage) => part.text as string)
    .join("\n\n")
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function shorten(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

function quote(value: string): string {
  // A JSON string is a valid YAML double-quoted scalar; it escapes quotes, backslashes and newlines.
  return JSON.stringify(value)
}

function value(input: number | null): string {
  return input === null ? "null" : String(input)
}

function pad(input: number): string {
  return String(input).padStart(2, "0")
}

function localDate(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function compactUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replaceAll(":", "-") + "Z"
}

function isoWithOffset(ms: number): string {
  const date = new Date(ms)
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? "+" : "-"
  const absolute = Math.abs(offset)
  return `${localDate(ms)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(
    Math.floor(absolute / 60)
  )}:${pad(absolute % 60)}`
}

function suffix(id: string): string {
  const cleaned = String(id).replace(/[^a-zA-Z0-9]/g, "")
  return (cleaned.slice(-6) || "000000").toLowerCase()
}
