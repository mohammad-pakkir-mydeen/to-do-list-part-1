CREATE TABLE `todo_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`todo_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todo_comments_todo_id_idx` ON `todo_comments` (`todo_id`);--> statement-breakpoint
CREATE INDEX `todo_comments_user_id_idx` ON `todo_comments` (`user_id`);--> statement-breakpoint
ALTER TABLE `todos` ADD `parent_todo_id` integer REFERENCES todos(id) ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX `todos_parent_todo_id_idx` ON `todos` (`parent_todo_id`);