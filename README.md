# Movie_Theatre

A personal movie and TV catalogue for a single user. Metadata is pulled from TMDB and Kinopoisk once on add, after which each entry is edited manually. The user sets a personal rating and watch status, marks what's downloaded, and builds collections.

## Features

- Add by title with autofill: poster, trailer, director, cast, genres, country, KP / IMDb / TMDB ratings
- Personal fields: status, 1–10 rating, watch date, notes, tags, rewatch flag
- Download tracking: file status, torrent link, storage location, quality
- Movies and TV in one model, with per-series progress
- Instant client-side filtering and sorting
- Manual lists and dynamic saved filters
- Collection statistics, including divergence from external ratings

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Styling | Tailwind |
| Database | Turso (SQLite in the cloud), Drizzle ORM |
| Data | TMDB API, Kinopoisk (poiskkino.dev) |
| Hosting | Vercel |

## Environment variables

```
TMDB_API_KEY
KINOPOISK_TOKEN
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
APP_PASSWORD
```

## Documentation

- `SPEC.md` — full technical specification
- `CLAUDE.md` — development rules and design system
- `CHANGELOG.md` — change history
- `assets/` — reference UI mockups

## Status

In development.
