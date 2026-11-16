import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/** 2.1. Фильмы и сериалы живут в одной таблице, различаются колонкой kind. */
export type Kind = 'movie' | 'tv';

/** none — Не смотрел, watched — Смотрел, planned — Буду смотреть,
 *  watching — Смотрю (только сериалы), skip — Не стоит смотреть. */
export type Status = 'none' | 'watched' | 'planned' | 'watching' | 'skip';

/** none — Нет, downloading — Качаю, have — Скачан, deleted — Удалён после просмотра. */
export type FileStatus = 'none' | 'downloading' | 'have' | 'deleted';

const nowIso = () => new Date().toISOString();

/** Физические диски, на которых лежит скачанное. Метка — «A», «B», «H». */
export const disks = sqliteTable(
  'disks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    label: text('label').notNull(),
    sizeGb: real('size_gb').notNull(), // полный объём: диски бывают разного размера
    note: text('note'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (t) => [uniqueIndex('disks_label_idx').on(t.label)],
);

export const movies = sqliteTable(
  'movies',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind').$type<Kind>().notNull(),

    // --- заполняется из API, но редактируется вручную ---
    tmdbId: integer('tmdb_id').notNull(),
    imdbId: text('imdb_id'),
    kpId: integer('kp_id'),
    title: text('title').notNull(), // русское
    originalTitle: text('original_title'),
    year: integer('year'),
    posterUrl: text('poster_url'),
    backdropUrl: text('backdrop_url'),
    trailerKey: text('trailer_key'), // идентификатор ролика YouTube
    overview: text('overview'),
    runtime: integer('runtime'), // фильм: всего; сериал: минут в серии
    seasons: integer('seasons'), // только kind='tv'
    episodes: integer('episodes'), // только kind='tv'
    genres: text('genres'), // JSON: string[]
    countries: text('countries'), // JSON: string[]
    director: text('director'), // сериал: создатель
    producers: text('producers'), // JSON: string[], 1–2 человека
    cast: text('cast'), // JSON: string[], 3–4 человека
    ratingKp: real('rating_kp'),
    ratingImdb: real('rating_imdb'),
    ratingTmdb: real('rating_tmdb'),

    // --- только вручную ---
    status: text('status').$type<Status>().notNull().default('none'),
    rewatch: integer('rewatch').notNull().default(0), // «хочу пересмотреть», только при status='watched'
    rating: integer('rating'), // 1..10, nullable
    watchedAt: text('watched_at'), // ISO date, nullable
    progressSeason: integer('progress_season'), // только kind='tv'
    progressEpisode: integer('progress_episode'), // только kind='tv'
    note: text('note'),
    tags: text('tags'), // JSON: string[]
    favorite: integer('favorite').notNull().default(0),

    // --- файл ---
    fileStatus: text('file_status').$type<FileStatus>().notNull().default('none'),
    torrentUrl: text('torrent_url'), // ссылка на раздачу
    // storage оставлен для совместимости: в интерфейсе его заменил выбор диска.
    storage: text('storage'),
    diskId: integer('disk_id').references(() => disks.id, { onDelete: 'set null' }),
    sizeGb: real('size_gb'), // вес файла в ГБ, необязательный
    path: text('path'), // папка или полный путь
    quality: text('quality'), // '1080p', '2160p', 'BDRemux', ...

    createdAt: text('created_at').notNull().$defaultFn(nowIso), // дата добавления на сайт
    updatedAt: text('updated_at').$onUpdateFn(nowIso),
  },
  (t) => [
    uniqueIndex('movies_tmdb_id_idx').on(t.tmdbId),
    index('movies_kind_idx').on(t.kind),
    index('movies_status_idx').on(t.status),
    index('movies_year_idx').on(t.year),
    index('movies_disk_id_idx').on(t.diskId),
  ],
);

/** 2.4. Ручные списки. */
export const lists = sqliteTable('lists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  coverMovieId: integer('cover_movie_id').references(() => movies.id, { onDelete: 'set null' }), // постер для обложки
  position: integer('position'), // порядок списков между собой
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
});

export const listItems = sqliteTable(
  'list_items',
  {
    listId: integer('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    movieId: integer('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(), // ручной порядок внутри списка
    note: text('note'), // «почему он здесь»
  },
  (t) => [
    primaryKey({ columns: [t.listId, t.movieId] }),
    index('list_items_movie_id_idx').on(t.movieId),
  ],
);

/** 2.5. Сохранённые фильтры: имя плюс строка запроса из адресной строки. */
export const savedViews = sqliteTable('saved_views', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  query: text('query').notNull(),
  position: integer('position'),
});

export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;
export type List = typeof lists.$inferSelect;
export type NewList = typeof lists.$inferInsert;
export type ListItem = typeof listItems.$inferSelect;
export type NewListItem = typeof listItems.$inferInsert;
export type SavedView = typeof savedViews.$inferSelect;
export type NewSavedView = typeof savedViews.$inferInsert;
export type Disk = typeof disks.$inferSelect;
export type NewDisk = typeof disks.$inferInsert;
