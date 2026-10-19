ALTER TABLE `projects` ADD `is_shared` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `todos` ADD `is_shared` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `projects` SET `is_shared` = true WHERE `user_id` IS NULL;--> statement-breakpoint
UPDATE `todos` SET `is_shared` = true WHERE `user_id` IS NULL;