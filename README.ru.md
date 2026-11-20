# session-ledger

[English](README.md) · **Русский**

Скилл для агентов: после каждого хода (когда скилл активен) дописывает **локальный YAML-лог** — что спросили, какая модель, где ход на таймлайне сессии (`T0 + …`), длительность, токены и (если известна) стоимость.

Не привязан к одному продукту: Cursor, Claude Code, OpenCode, Codex, Gemini CLI и любой хост с Agent Skills.

## Установка

Скопируйте `skills/session-ledger/` в каталог скиллов вашего агента:

| Хост | Типичный путь |
| --- | --- |
| Cursor | `.cursor/skills/session-ledger/` или `.agents/skills/session-ledger/` |
| Claude Code | `.claude/skills/session-ledger/` или `~/.claude/skills/session-ledger/` |
| Codex | `.agents/skills/session-ledger/` или `~/.agents/skills/session-ledger/` |
| Gemini CLI | `.gemini/skills/session-ledger/` или `.agents/skills/session-ledger/` |
| OpenCode | `.opencode/skills/session-ledger/` |
| Generic / Agent Skills | `.agents/skills/session-ledger/` |

Codex всё ещё читает legacy-путь `~/.codex/skills/`, но документированный путь — `.agents/skills/`.

Пользовательские пути: `~/.cursor/skills/` или `~/.agents/skills/` (Cursor),
`~/.claude/skills/` (Claude Code), `~/.agents/skills/` (Codex),
`~/.gemini/skills/` или `~/.agents/skills/` (Gemini CLI).

Опционально: в репозитории есть `.cursor-plugin/plugin.json` для публикации как Cursor plugin — для использования скилла это не обязательно.

OpenCode требует большего, чем скилл: он загружает скиллы по требованию и не
эмитит `session.idle`, поэтому в репозитории есть `.opencode-plugin/` — серверный
плагин, который дописывает запись на `session.execution.succeeded`. Скопируйте
его в `.opencode/plugins/session-ledger/`; каталог журнала — `session-ledger`,
если не передать опцию `directory`. Список событий и маппинг полей — в
`skills/session-ledger/references/host-hooks.md`.

### Ручной вызов

`/session-ledger` — если хост поддерживает slash-команды скиллов. В Codex используйте `$session-ledger` или `/skills`; в Gemini CLI — `/skills` или обычную формулировку. Также можно просто попросить агента записать ход в лог.

### Автоматическое логирование

Agent Skills загружаются по требованию. Чтобы писать лог каждый ход, не полагаясь на память модели, добавьте правило или hook хоста. См. `skills/session-ledger/references/host-hooks.md`.

## Что пишется в лог

Файл дня в корне проекта:

```text
session-ledger/YYYY-MM-DD.yaml
```

Обязательные поля записи:

| Поле | Смысл |
| --- | --- |
| `id` | Уникальный id записи (UTC stamp + suffix) |
| `session_id` | Стабильный id беседы/сессии |
| `timestamp` | Когда ход завершился (с часовым поясом) |
| `since_t0` | Смещение старта хода от старта сессии, напр. `T0 + 35m12s` |
| `duration_sec` | Длительность хода в секундах или `null` |
| `tokens.input` | Входные/prompt-токены или `null` |
| `tokens.output` | Выходные/completion-токены или `null` |
| `user_request` | Что спросил пользователь |
| `requested_model` | Какую модель запросили / выбрали |
| `chosen_variant` | Как этот ход соотносится с предыдущим ответом |
| `used_model` | Какая модель реально отработала |
| `cost.usd` | Стоимость, если известна, иначе `null` |
| `outcome` | Краткий итог |

Опционально: `session_started_at`, `host`, `model_variant`, `tokens.cache_read`, `tokens.cache_write`, `cost.note`, `files_touched`, `tags`.

Стоимость **по ходу** — из `usage.cost` (или `total_cost` generation), не из
`/activity` (там дневные агрегаты). Management key и хранение в `.env`:
`skills/session-ledger/references/openrouter-cost.md` (секция `cost` в
`SKILL.md` — краткое резюме).

Имена полей в YAML — на английском (канон для агентов и парсеров).  
См. `skills/session-ledger/assets/day.example.yaml` и `skills/session-ledger/references/entry.schema.yaml`.

Инструкции для агента — в `skills/session-ledger/SKILL.md` (English).

## Заметки по дизайну

- **YAML** — удобно фильтровать/сортировать по модели, таймлайну, длительности, токенам и стоимости.
- Файлы за день **только дополняются** в `session-ledger/` — без привязки к IDE.
- `since_t0` = смещение старта хода от `T0`; `duration_sec` = длина этого хода.
- `session_id` позволяет различать несколько бесед в одном файле дня.

## Приватность

В логе могут быть запросы пользователя. Редактируйте секреты и просматривайте
`session-ledger/` перед коммитом.

## Лицензия

MIT — см. [LICENSE](LICENSE).
