CREATE TABLE `crm_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lead_id` int NOT NULL,
	`activity_type` enum('note','call','email','meeting','whatsapp','stage_change','ai_analysis') NOT NULL DEFAULT 'note',
	`description` text NOT NULL,
	`from_stage` varchar(64),
	`to_stage` varchar(64),
	`author` varchar(255) NOT NULL DEFAULT 'Sistema',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crm_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255),
	`phone` varchar(64),
	`company` varchar(255),
	`source_crm` enum('google_ads','meta_ads','organic','whatsapp','referral','other') NOT NULL DEFAULT 'other',
	`source_campaign` varchar(255),
	`stage_crm` enum('new','qualified','proposal','closed_won','closed_lost') NOT NULL DEFAULT 'new',
	`ai_score` int,
	`ai_next_action` text,
	`estimated_value` int,
	`product` varchar(255),
	`notes` text,
	`priority_crm` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`assigned_to` varchar(255),
	`last_contact_at` timestamp,
	`expected_close_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crm_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `editorial_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`platform_ep` enum('instagram','facebook','both') NOT NULL DEFAULT 'instagram',
	`content_type_ep` enum('post','story','reels','carousel') NOT NULL DEFAULT 'post',
	`caption` text,
	`hashtags` varchar(2200),
	`instagram_draft_id` int,
	`scheduled_date` varchar(10) NOT NULL,
	`scheduled_time` varchar(5) NOT NULL DEFAULT '09:00',
	`status_ep` enum('planned','ready','published','cancelled') NOT NULL DEFAULT 'planned',
	`published_post_id` varchar(255),
	`reach` int,
	`likes` int,
	`comments` int,
	`shares` int,
	`saves` int,
	`assigned_to` varchar(255),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `editorial_posts_id` PRIMARY KEY(`id`)
);
