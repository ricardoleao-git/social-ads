ALTER TABLE `whatsapp_config` ADD `api_key` varchar(512);--> statement-breakpoint
ALTER TABLE `whatsapp_config` ADD `twilio_account_sid` varchar(128);--> statement-breakpoint
ALTER TABLE `whatsapp_config` ADD `twilio_auth_token` varchar(256);--> statement-breakpoint
ALTER TABLE `whatsapp_config` ADD `twilio_whatsapp_from` varchar(32);