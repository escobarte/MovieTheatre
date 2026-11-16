CREATE TABLE `list_items` (
	`list_id` integer NOT NULL,
	`movie_id` integer NOT NULL,
	`position` integer NOT NULL,
	`note` text,
	PRIMARY KEY(`list_id`, `movie_id`),
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `list_items_movie_id_idx` ON `list_items` (`movie_id`);--> statement-breakpoint
CREATE TABLE `lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_movie_id` integer,
	`position` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cover_movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `movies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`imdb_id` text,
	`kp_id` integer,
	`title` text NOT NULL,
	`original_title` text,
	`year` integer,
	`poster_url` text,
	`backdrop_url` text,
	`trailer_key` text,
	`overview` text,
	`runtime` integer,
	`seasons` integer,
	`episodes` integer,
	`genres` text,
	`countries` text,
	`director` text,
	`producers` text,
	`cast` text,
	`rating_kp` real,
	`rating_imdb` real,
	`rating_tmdb` real,
	`status` text DEFAULT 'none' NOT NULL,
	`rewatch` integer DEFAULT 0 NOT NULL,
	`rating` integer,
	`watched_at` text,
	`progress_season` integer,
	`progress_episode` integer,
	`note` text,
	`tags` text,
	`favorite` integer DEFAULT 0 NOT NULL,
	`file_status` text DEFAULT 'none' NOT NULL,
	`torrent_url` text,
	`storage` text,
	`path` text,
	`quality` text,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `movies_tmdb_id_idx` ON `movies` (`tmdb_id`);--> statement-breakpoint
CREATE INDEX `movies_kind_idx` ON `movies` (`kind`);--> statement-breakpoint
CREATE INDEX `movies_status_idx` ON `movies` (`status`);--> statement-breakpoint
CREATE INDEX `movies_year_idx` ON `movies` (`year`);--> statement-breakpoint
CREATE TABLE `saved_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`query` text NOT NULL,
	`position` integer
);
