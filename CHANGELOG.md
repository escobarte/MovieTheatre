# Changelog

Свежие записи — сверху. Формат:

```
## ГГГГ-ММ-ДД
Короткое описание сделанного (1–3 строки).
Файлы: путь/один.tsx, путь/два.ts
```

<!-- Новые записи добавляются ниже этой строки, каждая сверху -->

## 2026-08-01
Этап 6: оверлей поиска по клавише «/» и иконке в шапке — по коллекции в памяти,
с переходом в TMDB, когда ничего не нашлось; кнопка «Добавить» открывает тот же
оверлей в режиме TMDB. Экран статистики: записи и часы, гистограмма оценок,
десятилетия, топы, скачанное по дискам, расхождение с оценками КП.
В облегчённую выдачу добавлены cast и episodes — без них поиск по актёрам
и подсчёт часов сериалов не работают в памяти.
Файлы: lib/search.ts, lib/stats.ts, components/SearchOverlay.tsx,
components/SearchProvider.tsx, components/Header.tsx, app/statistika/page.tsx,
app/page.tsx, app/layout.tsx, app/api/movies/route.ts, lib/collection.ts

## 2026-08-01
Учёт физических дисков: таблица disks с миграцией, поля diskId и sizeGb у фильма,
API дисков со сводкой занятого и свободного места, экран «Диски» с полосой
заполнения и содержимым каждого диска, выбор диска и веса в карточке. Фильтр
«хранилище» заменён фильтром по диску.
Файлы: lib/db/schema.ts, drizzle/0001_disks.sql, app/api/disks/route.ts,
app/api/disks/[id]/route.ts, app/api/movies/route.ts, app/api/movies/[id]/route.ts,
components/DisksProvider.tsx, components/MovieCard.tsx, components/Header.tsx,
app/diski/page.tsx, app/diski/[id]/page.tsx, app/layout.tsx, app/vse-kino/page.tsx,
lib/collection.ts, lib/filters.ts, lib/query.ts

## 2026-08-01
Этап 5: API подборок и сохранённых фильтров, экран «Списки» с сеткой обложек и
отдельной группой фильтров, страница списка с перетаскиванием и полем «почему он
здесь», добавление в подборку из карточки, кнопка «Сохранить фильтр» в каталоге,
категория фильтра «список», полка «Мои списки» на Главной.
Файлы: app/api/lists/route.ts, app/api/lists/[id]/route.ts,
app/api/lists/[id]/items/route.ts, app/api/views/route.ts,
components/ListsProvider.tsx, components/MovieCard.tsx, app/spiski/page.tsx,
app/spiski/[id]/page.tsx, app/page.tsx, app/vse-kino/page.tsx, app/layout.tsx,
lib/filters.ts, lib/query.ts, lib/collection.ts

## 2026-07-31
Карточка записи: модалка по клику на любой постер в сетке, карусели и полке,
правка полей по клику с сохранением по расфокусировке; после добавления
открывается сразу она. В каталоге жанры перенесены по строкам, убран фильтр
«год добавления», ползунок оценки заменён выпадающим списком, кнопка сброса
стала заметной.
Файлы: components/MovieCard.tsx, components/CardProvider.tsx, components/Poster.tsx,
components/Carousel.tsx, components/CollectionProvider.tsx, app/layout.tsx,
app/dev/page.tsx, app/vse-kino/page.tsx, app/api/movies/[id]/route.ts,
lib/filters.ts, lib/query.ts

## 2026-07-31
Этап 4: фильтрация и сортировка целиком в памяти, счётчики у каждого значения
с учётом уже включённых условий, состояние в строке запроса, «Выбери за меня»
и пустое состояние «под условия ничего не подходит».
Файлы: lib/filters.ts, app/vse-kino/page.tsx, components/catalog/FilterSelect.tsx,
components/catalog/PickOne.tsx

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
