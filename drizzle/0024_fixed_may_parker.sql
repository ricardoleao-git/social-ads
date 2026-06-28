CREATE TABLE `in_app_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`type` varchar(32) NOT NULL DEFAULT 'info',
	`source` varchar(128) NOT NULL DEFAULT 'system',
	`read` tinyint NOT NULL DEFAULT 0,
	`read_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `in_app_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_whitelist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`term` varchar(255) NOT NULL,
	`supplier_name` varchar(255) NOT NULL,
	`reason` varchar(512) NOT NULL DEFAULT 'Fornecedor de equipamentos parceiro',
	`active` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supplier_whitelist_id` PRIMARY KEY(`id`)
);
