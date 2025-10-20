PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`city` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "first_name", "last_name", "city", "created_at", "updated_at") SELECT "id", "first_name", "last_name", "city", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_users_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_users_emails`("id", "user_id", "email", "is_primary", "created_at", "updated_at") SELECT "id", "user_id", "email", "is_primary", "created_at", "updated_at" FROM `users_emails`;--> statement-breakpoint
DROP TABLE `users_emails`;--> statement-breakpoint
ALTER TABLE `__new_users_emails` RENAME TO `users_emails`;