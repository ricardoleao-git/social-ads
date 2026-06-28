CREATE TABLE `conversion_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`goal_id` varchar(50) NOT NULL,
	`name` varchar(200) NOT NULL,
	`monthly` int NOT NULL DEFAULT 10,
	`cpa_target` int NOT NULL DEFAULT 80,
	`color` varchar(20) NOT NULL DEFAULT '#3b82f6',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` varchar(100) DEFAULT 'admin',
	CONSTRAINT `conversion_goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `conversion_goals_goal_id_unique` UNIQUE(`goal_id`)
);
