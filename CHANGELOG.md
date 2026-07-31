# Changelog

Свежие записи — сверху. Формат:

```
## ГГГГ-ММ-ДД
Короткое описание сделанного (1–3 строки).
Файлы: путь/один.tsx, путь/два.ts
```

<!-- Новые записи добавляются ниже этой строки, каждая сверху -->

## 2026-07-31
Заполнен .env.local (кроме APP_PASSWORD), миграция применена к боевой базе Turso
movie-theatre-escobarte. Проверка со страницы: база отвечает, все четыре таблицы на месте.
Файлы: .env.local (в git не попадает)

## 2026-07-31
Этап 1 (каркас): Next.js 15 App Router + TypeScript + Tailwind v4, Turso и Drizzle,
схема всех четырёх таблиц из раздела 2 и миграция, токены дизайн-системы в globals.css,
шрифт Onest и lucide-react, пустая стартовая страница с серверной проверкой базы.
Файлы: package.json, tsconfig.json, next.config.ts, postcss.config.mjs, .gitignore,
.env.local, .env.example, drizzle.config.ts, drizzle/0000_init.sql, drizzle/meta/*,
lib/db/schema.ts, lib/db/index.ts, lib/db/health.ts, app/layout.tsx, app/page.tsx,
app/globals.css
