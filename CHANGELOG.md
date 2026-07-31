# Changelog

Свежие записи — сверху. Формат:

```
## ГГГГ-ММ-ДД
Короткое описание сделанного (1–3 строки).
Файлы: путь/один.tsx, путь/два.ts
```

<!-- Новые записи добавляются ниже этой строки, каждая сверху -->

## 2026-07-31
Этап 3, первая половина: каркас интерфейса (шапка, навигация, загрузка коллекции
один раз за сессию), Главная с каруселью, строкой жанров и тремя полками, экран
«Всё кино» с сеткой постеров. Фильтры пока только отрисованы. Добавлен PATCH
/api/movies/[id] и правка личных полей на служебной странице — иначе полки нечем
наполнить до появления карточки.
Файлы: app/layout.tsx, app/page.tsx, app/vse-kino/page.tsx, app/spiski/page.tsx,
app/statistika/page.tsx, app/dev/page.tsx, app/api/movies/route.ts,
app/api/movies/[id]/route.ts, components/Header.tsx, components/CollectionProvider.tsx,
components/Carousel.tsx, components/Shelf.tsx, components/Poster.tsx,
components/GenreDoor.tsx, lib/collection.ts, lib/query.ts, lib/db/health.ts (удалён)

## 2026-07-31
Этап 2 (данные): серверные клиенты TMDB и Кинопоиска, слияние по разделу 3.3,
эндпоинты GET /api/search, GET и POST /api/movies, временная страница /dev для
ручной проверки парсинга. Отказ Кинопоиска добавление не роняет.
Файлы: lib/tmdb.ts, lib/kinopoisk.ts, lib/merge.ts, app/api/search/route.ts,
app/api/movies/route.ts, app/dev/page.tsx

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
