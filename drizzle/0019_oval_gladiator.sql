CREATE TABLE `budget_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(16) NOT NULL,
	`donor_ad_group_id` varchar(64),
	`donor_ad_group_name` varchar(255),
	`recipient_ad_group_id` varchar(64) NOT NULL,
	`recipient_ad_group_name` varchar(255) NOT NULL,
	`old_budget_micros` bigint NOT NULL,
	`new_budget_micros` bigint NOT NULL,
	`amount_moved_micros` bigint NOT NULL,
	`reason` text NOT NULL,
	`triggered_by` varchar(32) NOT NULL DEFAULT 'scheduled',
	`status` enum('applied','skipped','failed','simulated') NOT NULL DEFAULT 'simulated',
	`error_message` text,
	`recipient_ctr` varchar(16),
	`recipient_cpl` varchar(16),
	`donor_ctr` varchar(16),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `budget_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budget_automation_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`simulation_mode` boolean NOT NULL DEFAULT true,
	`enabled` boolean NOT NULL DEFAULT true,
	`last_run_at` timestamp,
	`next_run_at` timestamp,
	`total_moved_today_micros` bigint DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_automation_config_id` PRIMARY KEY(`id`)
);
