CREATE TABLE `account_health_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`overall_score` int NOT NULL DEFAULT 0,
	`rsa_quality_score` int NOT NULL DEFAULT 0,
	`negative_coverage_score` int NOT NULL DEFAULT 0,
	`ctr_score` int NOT NULL DEFAULT 0,
	`conversion_score` int NOT NULL DEFAULT 0,
	`budget_score` int NOT NULL DEFAULT 0,
	`anomaly_score` int NOT NULL DEFAULT 0,
	`details` text,
	`calculated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_health_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ad_group_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ad_group_id` varchar(64) NOT NULL,
	`ad_group_name` varchar(255) NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`ctr_pct` varchar(16) NOT NULL DEFAULT '0',
	`cpc_brl` varchar(16) NOT NULL DEFAULT '0',
	`conv_rate_pct` varchar(16) NOT NULL DEFAULT '0',
	`impressions` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`conversions` int NOT NULL DEFAULT 0,
	`spend_brl` varchar(32) NOT NULL DEFAULT '0',
	`period` varchar(16) NOT NULL DEFAULT '7d',
	`calculated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ad_group_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pagespeed_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url` varchar(512) NOT NULL,
	`strategy` varchar(16) NOT NULL,
	`performance_score` int NOT NULL DEFAULT 0,
	`accessibility_score` int NOT NULL DEFAULT 0,
	`seo_score` int NOT NULL DEFAULT 0,
	`lcp_ms` int NOT NULL DEFAULT 0,
	`fid_ms` int NOT NULL DEFAULT 0,
	`cls_x1000` int NOT NULL DEFAULT 0,
	`tbt_ms` int NOT NULL DEFAULT 0,
	`speed_index_ms` int NOT NULL DEFAULT 0,
	`measured_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pagespeed_history_id` PRIMARY KEY(`id`)
);
