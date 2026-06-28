CREATE TABLE `job_run_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_name` varchar(100) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'success',
	`message` text,
	`duration_ms` int,
	`executed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_run_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_errors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(50) NOT NULL DEFAULT 'job',
	`component` varchar(100) NOT NULL,
	`message` text NOT NULL,
	`stack` text,
	`metadata` text,
	`occurred_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_errors_id` PRIMARY KEY(`id`)
);
