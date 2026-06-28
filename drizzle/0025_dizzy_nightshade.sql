CREATE TABLE `uptime_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service` varchar(128) NOT NULL,
	`status` varchar(16) NOT NULL,
	`response_time_ms` int,
	`error_message` varchar(512),
	`checked_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `uptime_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`priority` varchar(16) NOT NULL DEFAULT 'medium',
	`status` varchar(32) NOT NULL DEFAULT 'open',
	`author_name` varchar(128) NOT NULL DEFAULT 'Ricardo',
	`author_email` varchar(255),
	`page` varchar(255),
	`admin_notes` text,
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_feedback_id` PRIMARY KEY(`id`)
);
