CREATE TABLE `negative_keyword_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`text` varchar(255) NOT NULL,
	`matchType` varchar(20) NOT NULL,
	`level` varchar(20) NOT NULL,
	`campaignId` varchar(64) NOT NULL,
	`campaignName` varchar(255),
	`adGroupId` varchar(64),
	`adGroupName` varchar(255),
	`success` int NOT NULL DEFAULT 1,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `negative_keyword_history_id` PRIMARY KEY(`id`)
);
