CREATE TABLE `ai_chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversation_id` varchar(64) NOT NULL,
	`role` varchar(20) NOT NULL,
	`content` text NOT NULL,
	`context` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_chat_messages_id` PRIMARY KEY(`id`)
);
