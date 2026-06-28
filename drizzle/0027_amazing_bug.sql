CREATE TABLE `job_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_name` varchar(100) NOT NULL,
	`job_label` varchar(200) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` varchar(100) DEFAULT 'system',
	CONSTRAINT `job_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_configs_job_name_unique` UNIQUE(`job_name`)
);
