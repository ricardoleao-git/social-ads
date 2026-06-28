CREATE TABLE `instagram_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account` varchar(64) NOT NULL DEFAULT 'zenitetech',
	`type_ig` enum('post','story','reels') NOT NULL DEFAULT 'post',
	`caption` text,
	`hashtags` varchar(2200),
	`media_urls` json NOT NULL,
	`media_types` json NOT NULL,
	`scheduled_for` varchar(64),
	`notes` text,
	`status_ig` enum('draft','scheduled','published','cancelled') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `instagram_drafts_id` PRIMARY KEY(`id`)
);
