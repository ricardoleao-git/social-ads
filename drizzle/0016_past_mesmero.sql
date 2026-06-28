CREATE TABLE `negative_category_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(64) NOT NULL,
	`label` varchar(128) NOT NULL,
	`description` text,
	`active` boolean NOT NULL DEFAULT true,
	`min_confidence` int NOT NULL DEFAULT 70,
	`default_match_type` varchar(20) NOT NULL DEFAULT 'PHRASE',
	`updated_by` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `negative_category_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `negative_category_config_category_unique` UNIQUE(`category`)
);
