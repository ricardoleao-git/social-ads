ALTER TABLE `instagram_drafts` ADD `ig_media_id` varchar(64);--> statement-breakpoint
ALTER TABLE `instagram_drafts` ADD `published_at` timestamp;--> statement-breakpoint
ALTER TABLE `instagram_drafts` ADD `publish_error` text;