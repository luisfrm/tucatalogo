CREATE TABLE `rate_limit_counter` (
	`bucket` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`window_started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_counter_expires_at_idx` ON `rate_limit_counter` (`expires_at`);--> statement-breakpoint
CREATE TABLE `__new_admin_two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`verified` integer NOT NULL,
	`failed_verification_count` integer NOT NULL,
	`locked_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_admin_two_factor` ("id", "user_id", "secret", "backup_codes", "verified", "failed_verification_count", "locked_until", "created_at", "updated_at")
SELECT "id", "user_id", "secret", "backup_codes", 0, 0, NULL, "created_at", "updated_at" FROM `admin_two_factor`;--> statement-breakpoint
DROP TABLE `admin_two_factor`;--> statement-breakpoint
ALTER TABLE `__new_admin_two_factor` RENAME TO `admin_two_factor`;--> statement-breakpoint
CREATE UNIQUE INDEX `admin_two_factor_user_id_uq` ON `admin_two_factor` (`user_id`);
