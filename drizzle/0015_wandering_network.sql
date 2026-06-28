CREATE TABLE `ctr_alert_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ad_group_name` varchar(255) NOT NULL DEFAULT 'all',
	`threshold_percent` int NOT NULL DEFAULT 5,
	`email` varchar(320) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`last_triggered_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ctr_alert_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `insights_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`period` varchar(50) NOT NULL,
	`start_date` varchar(20) NOT NULL,
	`end_date` varchar(20) NOT NULL,
	`content` text NOT NULL,
	`tags` json DEFAULT ('[]'),
	`metrics` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `insights_history_id` PRIMARY KEY(`id`)
);
