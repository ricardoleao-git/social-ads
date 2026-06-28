CREATE TABLE `client_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_id` int NOT NULL,
	`month` varchar(7) NOT NULL,
	`pdf_url` varchar(512),
	`pdf_key` varchar(512),
	`status` enum('pending','generated','sent','failed') NOT NULL DEFAULT 'pending',
	`sent_at` timestamp,
	`error_message` text,
	`total_leads` int DEFAULT 0,
	`total_spend` varchar(32),
	`avg_cpl` varchar(32),
	`avg_ctr` varchar(16),
	`ai_summary` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`product` varchar(64) NOT NULL,
	`email` varchar(320) NOT NULL,
	`ad_group_filter` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_predictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`term` varchar(255) NOT NULL,
	`probability` enum('alta','media','baixa') NOT NULL,
	`reason` text NOT NULL,
	`suggested_action` text,
	`week_of` varchar(16) NOT NULL,
	`status` enum('pending','added','rejected') NOT NULL DEFAULT 'pending',
	`clicks` int DEFAULT 0,
	`impressions` int DEFAULT 0,
	`ctr` varchar(16),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `voice_briefing_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`voxforge_url` varchar(512) DEFAULT 'http://localhost:8000',
	`voice` varchar(64) DEFAULT 'pt-BR-Ricardo',
	`generation_hour` int NOT NULL DEFAULT 7,
	`generation_minute` int NOT NULL DEFAULT 45,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `voice_briefing_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `voice_briefings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(16) NOT NULL,
	`text` text NOT NULL,
	`audio_url` varchar(512),
	`audio_key` varchar(512),
	`duration` int,
	`listened_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `voice_briefings_id` PRIMARY KEY(`id`),
	CONSTRAINT `voice_briefings_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(32) NOT NULL,
	`to_number` varchar(32) NOT NULL,
	`message` text NOT NULL,
	`dashboard_link` varchar(512),
	`status` enum('sent','failed','rate_limited','quiet_hours') NOT NULL DEFAULT 'sent',
	`error_message` text,
	`ad_group_name` varchar(255),
	`metric_value` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone_number` varchar(32),
	`enabled` boolean NOT NULL DEFAULT false,
	`provider` varchar(32) NOT NULL DEFAULT 'evolution_api',
	`api_url` varchar(512),
	`instance_name` varchar(128),
	`quiet_hours_start` int NOT NULL DEFAULT 22,
	`quiet_hours_end` int NOT NULL DEFAULT 7,
	`max_per_hour` int NOT NULL DEFAULT 10,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_config_id` PRIMARY KEY(`id`)
);
