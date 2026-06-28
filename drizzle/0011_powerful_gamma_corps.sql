CREATE TABLE `anomaly_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(50) NOT NULL,
	`metric` varchar(100) NOT NULL,
	`adGroupId` varchar(64),
	`adGroupName` varchar(255),
	`currentValue` varchar(50) NOT NULL,
	`thresholdValue` varchar(50) NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`message` text NOT NULL,
	`emailSent` boolean DEFAULT false,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `anomaly_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auction_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotDate` varchar(20) NOT NULL,
	`adGroupId` varchar(64),
	`adGroupName` varchar(255),
	`competitor` varchar(255) NOT NULL,
	`impressionShare` varchar(20),
	`overlapRate` varchar(20),
	`positionAboveRate` varchar(20),
	`topOfPageRate` varchar(20),
	`absTopOfPageRate` varchar(20),
	`isNew` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auction_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bid_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adGroupId` varchar(64) NOT NULL,
	`adGroupName` varchar(255),
	`campaignName` varchar(255),
	`oldBidMicros` varchar(30),
	`newBidMicros` varchar(30),
	`adjustmentPct` varchar(20),
	`reason` text,
	`triggerMetric` varchar(100),
	`status` enum('suggested','approved','rejected','applied','failed') NOT NULL DEFAULT 'suggested',
	`appliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bid_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `editorial_calendar` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` varchar(100) NOT NULL,
	`suggestedDate` varchar(20) NOT NULL,
	`suggestedTime` varchar(10),
	`contentType` enum('reel','carousel','image','story') DEFAULT 'image',
	`topic` varchar(255),
	`caption` text,
	`hashtags` json,
	`relatedProduct` varchar(100),
	`estimatedEngagement` varchar(20),
	`status` enum('suggested','scheduled','published','cancelled') DEFAULT 'suggested',
	`googleCalendarEventId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `editorial_calendar_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instagram_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` varchar(100) NOT NULL,
	`username` varchar(100) NOT NULL,
	`followers` int DEFAULT 0,
	`following` int DEFAULT 0,
	`totalPosts` int DEFAULT 0,
	`avgLikes` varchar(20),
	`avgComments` varchar(20),
	`engagementRate` varchar(20),
	`recentPostsData` json,
	`snapshotDate` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `instagram_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rsa_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adId` varchar(64) NOT NULL,
	`adGroupId` varchar(64),
	`adGroupName` varchar(255),
	`campaignName` varchar(255),
	`currentAdStrength` varchar(50),
	`currentHeadlines` json,
	`currentDescriptions` json,
	`suggestedHeadlines` json,
	`suggestedDescriptions` json,
	`reasoning` text,
	`status` enum('pending','approved','rejected','applied') NOT NULL DEFAULT 'pending',
	`appliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rsa_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_term_analysis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`term` varchar(500) NOT NULL,
	`adGroupId` varchar(64),
	`adGroupName` varchar(255),
	`campaignName` varchar(255),
	`impressions` int DEFAULT 0,
	`clicks` int DEFAULT 0,
	`costMicros` varchar(30),
	`conversions` varchar(20),
	`intent` enum('informational','navigational','transactional','irrelevant','unknown') DEFAULT 'unknown',
	`relevanceScore` varchar(10),
	`aiReasoning` text,
	`decision` enum('keep','negative','monitor','pending') DEFAULT 'pending',
	`negativeApplied` boolean DEFAULT false,
	`analysisDate` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `search_term_analysis_id` PRIMARY KEY(`id`)
);
