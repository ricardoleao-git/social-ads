CREATE TABLE `alert_email_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`emails` text NOT NULL DEFAULT ('atendimento@zenite.tech,rjll70@gmail.com'),
	`label` varchar(200) DEFAULT 'Destinatários de Alertas',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updated_by` varchar(100) DEFAULT 'admin',
	CONSTRAINT `alert_email_config_id` PRIMARY KEY(`id`)
);
