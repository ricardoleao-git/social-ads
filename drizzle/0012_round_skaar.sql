CREATE TABLE `automation_execution_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`automation_name` varchar(100) NOT NULL,
	`automation_label` varchar(200) NOT NULL,
	`status` enum('running','success','error','warning') NOT NULL DEFAULT 'running',
	`summary` text,
	`details` json,
	`error_message` text,
	`duration_ms` int,
	`triggered_by` varchar(50) DEFAULT 'manual',
	`email_sent` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `automation_execution_logs_id` PRIMARY KEY(`id`)
);
