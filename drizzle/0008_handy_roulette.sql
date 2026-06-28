CREATE TABLE `instagram_sync` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_handle` varchar(100) NOT NULL,
	`account_name` varchar(255),
	`followers` int DEFAULT 0,
	`reach` int DEFAULT 0,
	`likes` int DEFAULT 0,
	`engagement_rate` decimal(5,2),
	`impressions` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`shares` int DEFAULT 0,
	`period` varchar(10) DEFAULT '7d',
	`raw_json` text,
	`source` varchar(100) DEFAULT 'redes-sociais.zenitetech.com',
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `instagram_sync_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`source_system` varchar(255) NOT NULL,
	`target_system` varchar(255) NOT NULL,
	`endpoint` varchar(255),
	`status_code` int,
	`success` int NOT NULL DEFAULT 1,
	`error_message` text,
	`summary` text,
	`duration_ms` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_sync_log_id` PRIMARY KEY(`id`)
);
