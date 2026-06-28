CREATE TABLE `social_accounts` (
	`id` varchar(50) NOT NULL,
	`platform_id` varchar(50) NOT NULL,
	`account_name` varchar(100) NOT NULL,
	`account_handle` varchar(100) NOT NULL,
	`external_id` varchar(100),
	`credentials` json,
	`is_active` boolean DEFAULT true,
	`last_sync` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_alerts` (
	`id` varchar(50) NOT NULL,
	`account_id` varchar(50) NOT NULL,
	`platform_id` varchar(50) NOT NULL,
	`alert_type` varchar(50) NOT NULL,
	`severity` varchar(20) NOT NULL,
	`message` text NOT NULL,
	`is_read` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_automations` (
	`id` varchar(50) NOT NULL,
	`account_id` varchar(50) NOT NULL,
	`platform_id` varchar(50) NOT NULL,
	`automation_type` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`config` json NOT NULL,
	`is_active` boolean DEFAULT true,
	`last_run` timestamp,
	`next_run` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_automations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_integrations` (
	`id` varchar(50) NOT NULL,
	`platform_id` varchar(50) NOT NULL,
	`integration_type` varchar(50) NOT NULL,
	`config` json NOT NULL,
	`is_active` boolean DEFAULT true,
	`last_sync_status` varchar(20),
	`last_sync_time` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_metrics` (
	`id` varchar(50) NOT NULL,
	`account_id` varchar(50) NOT NULL,
	`platform_id` varchar(50) NOT NULL,
	`metric_type` varchar(50) NOT NULL,
	`metric_value` decimal(15,2) NOT NULL,
	`period` varchar(20) NOT NULL,
	`date` timestamp NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_platforms` (
	`id` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`display_name` varchar(100) NOT NULL,
	`icon` varchar(50),
	`is_active` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_platforms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` varchar(50) NOT NULL,
	`account_id` varchar(50) NOT NULL,
	`platform_id` varchar(50) NOT NULL,
	`post_id` varchar(100) NOT NULL,
	`caption` text,
	`media_url` varchar(500),
	`post_type` varchar(50),
	`likes` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`shares` int DEFAULT 0,
	`engagement` decimal(5,2) DEFAULT '0',
	`posted_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_reports` (
	`id` varchar(50) NOT NULL,
	`account_id` varchar(50) NOT NULL,
	`platform_id` varchar(50) NOT NULL,
	`report_type` varchar(50) NOT NULL,
	`period` varchar(50) NOT NULL,
	`data` json NOT NULL,
	`generated_at` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_reports_id` PRIMARY KEY(`id`)
);
