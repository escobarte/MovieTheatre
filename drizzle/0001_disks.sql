CREATE TABLE `disks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`size_gb` real NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `disks_label_idx` ON `disks` (`label`);--> statement-breakpoint
ALTER TABLE `movies` ADD `disk_id` integer REFERENCES disks(id);--> statement-breakpoint
ALTER TABLE `movies` ADD `size_gb` real;--> statement-breakpoint
CREATE INDEX `movies_disk_id_idx` ON `movies` (`disk_id`);