# Movie_Theatre

A personal movie and TV catalogue for a single user. Metadata is pulled from TMDB and Kinopoisk once, when an entry is added; after that every entry is edited by hand. The owner sets a personal rating and watch status, tracks which files are downloaded and on which physical disk, and builds collections.

## Features

- Add by title with autofill: poster, trailer, director, cast, genres, country, KP / IMDb / TMDB ratings
- Personal fields: status, 1–10 rating, watch date, notes, tags, rewatch flag
- Download tracking: file status, torrent link, disk, file size, quality
- Disk overview: used and free space per disk, what is stored where
- Movies and TV in one model, with per-series progress
- Instant client-side filtering and sorting, state kept in the URL
- Manual lists and dynamic saved filters
- Search overlay with a fallback to TMDB when nothing is found
- Collection statistics, including divergence from external ratings
- Google sign-in restricted to one email, installable as a PWA

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript |
| Styling | Tailwind v4, Onest font, lucide-react |
| Database | Turso (SQLite in the cloud), Drizzle ORM |
| Data | TMDB API, Kinopoisk (poiskkino.dev) |
| Auth | Auth.js v5, Google OAuth, single allowed email |
| Hosting | Vercel (Hobby) |

## Environment variables

```
TMDB_API_KEY
KINOPOISK_TOKEN
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
AUTH_SECRET
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
ALLOWED_EMAIL
```

Copy `.env.example` to `.env.local` for local work. Never commit real values.

## Local development

```
npm install
npm run dev
```

Database migrations live in `drizzle/` and are applied with Drizzle Kit (see `drizzle.config.ts`).

## Deployment

Pushes to `main` deploy to Vercel. Environment variables are set in the Vercel project settings. Google sign-in only works on the production URL, not on preview deployments.

## Documentation

- `docs/SPEC.md` — full technical specification
- `docs/CLAUDE.md` — development rules and design system
- `docs/STATE.md` — current project state and next steps
- `docs/CHANGELOG.md` — change history
- `assets/` — reference UI mockups (static HTML)

## Status

In development. Stages 1–6 are built and deployed; sign-in, PWA and polish are next. See `docs/STATE.md`.
