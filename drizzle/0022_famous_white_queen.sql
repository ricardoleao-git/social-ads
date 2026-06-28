CREATE TABLE `ads_data_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cache_key` varchar(64) NOT NULL,
	`data` text NOT NULL,
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	`ttl_seconds` int NOT NULL DEFAULT 3600,
	CONSTRAINT `ads_data_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `ads_data_cache_cache_key_unique` UNIQUE(`cache_key`)
);
--> statement-breakpoint
CREATE TABLE `alert_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(32) NOT NULL,
	`severity` varchar(16) NOT NULL DEFAULT 'info',
	`title` varchar(255) NOT NULL,
	`message` text,
	`metadata` text,
	`acknowledged` boolean NOT NULL DEFAULT false,
	`acknowledged_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auto_pause_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ad_group_id` varchar(64) NOT NULL,
	`ad_group_name` varchar(255) NOT NULL,
	`avg_ctr` varchar(16) NOT NULL,
	`total_spend` varchar(32) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`reviewed_by` varchar(128),
	`reviewed_at` timestamp,
	`review_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auto_pause_proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`default_period` varchar(16) DEFAULT '7d',
	`custom_start_date` varchar(32),
	`custom_end_date` varchar(32),
	`favorite_groups` text,
	`default_status_filter` varchar(16) DEFAULT 'all',
	`default_campaign_filter` varchar(128),
	`favorite_documents` text,
	`open_menu_groups` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`)
);
