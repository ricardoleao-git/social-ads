CREATE TABLE `chart_annotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`report_id` int NOT NULL,
	`semana` varchar(20) NOT NULL,
	`label` varchar(100) NOT NULL,
	`cor` varchar(20) NOT NULL DEFAULT '#f59e0b',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chart_annotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `impact_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`data` varchar(20) NOT NULL,
	`negativos` int NOT NULL DEFAULT 0,
	`urls_corrigidas` int NOT NULL DEFAULT 0,
	`extensoes` int NOT NULL DEFAULT 0,
	`economia_min` int NOT NULL DEFAULT 0,
	`economia_max` int NOT NULL DEFAULT 0,
	`ctr_atual` decimal(5,2) NOT NULL,
	`cpc_atual` decimal(5,2) NOT NULL,
	`dados_json` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `impact_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `impact_reports_data_unique` UNIQUE(`data`)
);
