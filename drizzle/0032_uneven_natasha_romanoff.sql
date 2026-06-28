CREATE TABLE `discrepancy_alert_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`period` varchar(20) NOT NULL,
	`ads_conversions` int NOT NULL DEFAULT 0,
	`ga4_conversions` int NOT NULL DEFAULT 0,
	`discrepancy_pct` int NOT NULL DEFAULT 0,
	`threshold` int NOT NULL DEFAULT 20,
	`sent_to` text,
	`status` varchar(20) NOT NULL DEFAULT 'success',
	`error_message` text,
	`sent_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discrepancy_alert_logs_id` PRIMARY KEY(`id`)
);
