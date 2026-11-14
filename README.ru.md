# session-ledger

[English](README.md) · **Русский**

Скилл для агентов: после каждого хода дописывает **локальный YAML-лог** — что спросили, какая модель, где ход на таймлайне сессии (`T0 + …`), длительность, токены и (если известна) стоимость.

Не привязан к одному продукту: Cursor, Claude Code, Codex, Gemini CLI и любой хост с Agent Skills.

## Установка

Скопируйте `skills/session-ledger/` в каталог скиллов вашего агента:

| Хост | Типичный путь |
| --- | --- |
| Cursor | `.cursor/skills/session-ledger/` или `.agents/skills/session-ledger/` |
| Claude Code | `.claude/skills/session-ledger/` или `~/.claude/skills/session-ledger/` |
| Codex | `.codex/skills/session-ledger/` или `~/.codex/skills/session-ledger/` |
| Generic / Agent Skills | `.agents/skills/session-ledger/` |

Опционально: в репозитории есть `.cursor-plugin/plugin.json` для публикации как Cursor plugin — для использования скилла это не обязательно.

### Ручной вызов

`/session-ledger` (если хост поддерживает slash-команды скиллов) или попросите агента записать ход в лог.

## Что пишется в лог

Файл дня в корне проекта:

```text
session-ledger/YYYY-MM-DD.yaml
```

Обязательные поля записи:

| Поле | Смысл |
| --- | --- |
| `timestamp` | Когда ход завершился (с часовым поясом) |
| `since_t0` | Отметка на таймлайне от старта сессии, напр. `T0 + 35m12s` |
| `duration_sec` | Длительность хода в секундах или `null` |
| `tokens.input` | Входные/prompt-токены или `null` |
| `tokens.output` | Выходные/completion-токены или `null` |
| `user_request` | Что спросил пользователь |
| `requested_model` | Какую модель запросили / выбрали |
| `chosen_variant` | Какой вариант ответа выбрали |
| `used_model` | Какая модель реально отработала |
| `cost.usd` | Стоимость, если известна, иначе `null` |
| `outcome` | Краткий итог |

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
- `since_t0` = `T0 + …` на таймлайне сессии; `duration_sec` = длина этого хода.

## Лицензия

MIT — см. [LICENSE](LICENSE).
