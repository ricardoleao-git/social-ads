CREATE TABLE `gmail_alert_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alert_id` int NOT NULL,
	`action_taken` text NOT NULL,
	`taken_by` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gmail_alert_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gmail_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gmail_message_id` varchar(128) NOT NULL,
	`subject` varchar(512) NOT NULL,
	`sender` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`urgency` enum('critical','warning','info') NOT NULL DEFAULT 'info',
	`category_gmail` enum('google_ads','billing','policy','performance','divergence','other') NOT NULL DEFAULT 'other',
	`divergence` json,
	`is_blinking` boolean NOT NULL DEFAULT true,
	`is_resolved` boolean NOT NULL DEFAULT false,
	`resolved_at` timestamp,
	`resolved_by` varchar(255),
	`email_date` timestamp NOT NULL,
	`processed_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gmail_alerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `gmail_alerts_gmail_message_id_unique` UNIQUE(`gmail_message_id`)
);
