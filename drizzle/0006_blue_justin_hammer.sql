CREATE TABLE `competitive_insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`competitor` varchar(255) NOT NULL,
	`overlap_rate` decimal(5,2),
	`position_above_rate` decimal(5,2),
	`impression_share` decimal(5,2),
	`our_impression_share` decimal(5,2),
	`campaign_name` varchar(255),
	`collected_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitive_insights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `keyword_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`term` varchar(255) NOT NULL,
	`suggested_ad_group` varchar(255),
	`suggested_match_type` varchar(20),
	`observed_ctr` decimal(5,2),
	`observed_conversions` decimal(10,2),
	`observed_spend` decimal(10,2),
	`reason` text,
	`status` varchar(32) NOT NULL DEFAULT 'pending_review',
	`priority` varchar(16) NOT NULL DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewed_at` timestamp,
	CONSTRAINT `keyword_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `optimization_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action_type` varchar(64) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'applied',
	`keyword` varchar(255),
	`match_type` varchar(20),
	`level` varchar(20),
	`campaign_id` varchar(64),
	`campaign_name` varchar(255),
	`ad_group_id` varchar(64),
	`ad_group_name` varchar(255),
	`reason` text,
	`performance_data` text,
	`estimated_savings` decimal(10,2),
	`execution_cycle` varchar(64),
	`approved_by` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `optimization_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_term_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`term` varchar(255) NOT NULL,
	`campaign_name` varchar(255),
	`ad_group_name` varchar(255),
	`impressions` int DEFAULT 0,
	`clicks` int DEFAULT 0,
	`spend` decimal(10,2) DEFAULT '0',
	`conversions` decimal(10,2) DEFAULT '0',
	`intent_category` varchar(64),
	`reason` text,
	`status` varchar(32) NOT NULL DEFAULT 'pending_review',
	`confidence` int DEFAULT 0,
	`detected_at` timestamp NOT NULL DEFAULT (now()),
	`applied_at` timestamp,
	CONSTRAINT `search_term_candidates_id` PRIMARY KEY(`id`)
);
