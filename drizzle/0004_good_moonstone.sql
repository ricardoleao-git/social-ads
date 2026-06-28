CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`user_email` varchar(320),
	`action` varchar(64) NOT NULL,
	`description` text,
	`target_email` varchar(320),
	`ip_address` varchar(64),
	`status_code` int,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
