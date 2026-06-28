CREATE TABLE `keyword_reasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword_text` varchar(255) NOT NULL,
	`reason` varchar(100) NOT NULL,
	`is_manual` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `keyword_reasons_id` PRIMARY KEY(`id`),
	CONSTRAINT `keyword_reasons_keyword_text_unique` UNIQUE(`keyword_text`)
);
