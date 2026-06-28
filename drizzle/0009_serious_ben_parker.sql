CREATE TABLE `negative_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposal_id` varchar(32) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`terms_json` text NOT NULL,
	`term_count` int NOT NULL DEFAULT 0,
	`total_spend` decimal(10,2) DEFAULT '0',
	`campaign_id` varchar(64),
	`campaign_name` varchar(255),
	`execution_cycle` varchar(64),
	`expires_at` timestamp,
	`applied_at` timestamp,
	`applied_count` int DEFAULT 0,
	`approved_by` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `negative_proposals_id` PRIMARY KEY(`id`),
	CONSTRAINT `negative_proposals_proposal_id_unique` UNIQUE(`proposal_id`)
);
