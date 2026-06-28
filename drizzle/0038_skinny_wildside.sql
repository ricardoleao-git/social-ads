CREATE TABLE `google_ads_summary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`summary_date` varchar(10) NOT NULL,
	`campaign_id` varchar(64) NOT NULL,
	`campaign_name` varchar(255) NOT NULL,
	`campaign_status` varchar(20) DEFAULT 'ENABLED',
	`impressions` int DEFAULT 0,
	`clicks` int DEFAULT 0,
	`cost` decimal(10,2) DEFAULT '0',
	`ctr` decimal(5,2) DEFAULT '0',
	`cpc` decimal(8,2) DEFAULT '0',
	`conversions` decimal(8,2) DEFAULT '0',
	`cost_per_conversion` decimal(10,2) DEFAULT '0',
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `google_ads_summary_id` PRIMARY KEY(`id`)
);
