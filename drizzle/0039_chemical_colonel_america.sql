CREATE TABLE `daily_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`google_ads_metrics` json,
	`instagram_metrics` json,
	`anomalies` json,
	`report_url` varchar(500),
	`sent_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_reports_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE TABLE `instagram_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` varchar(255) NOT NULL,
	`caption` text,
	`media_type` varchar(50),
	`media_url` varchar(500),
	`posted_at` timestamp,
	`likes` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`engagement` int DEFAULT 0,
	`impressions` int DEFAULT 0,
	`reach` int DEFAULT 0,
	`engagement_rate` decimal(5,2) DEFAULT '0',
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `instagram_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `instagram_posts_post_id_unique` UNIQUE(`post_id`)
);
--> statement-breakpoint
CREATE TABLE `sitemap_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service` varchar(50) NOT NULL,
	`url_count` int DEFAULT 0,
	`status` enum('success','error','pending') NOT NULL DEFAULT 'pending',
	`status_code` int,
	`response` text,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sitemap_submissions_id` PRIMARY KEY(`id`)
);
