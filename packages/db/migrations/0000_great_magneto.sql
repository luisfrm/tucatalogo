CREATE TABLE `admin_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`password` text,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_accounts_provider_account_uq` ON `admin_accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `admin_accounts_user_id_idx` ON `admin_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_sessions_token_unique` ON `admin_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `admin_sessions_user_id_idx` ON `admin_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `admin_two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_two_factor_user_id_uq` ON `admin_two_factor` (`user_id`);--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`name` text NOT NULL,
	`image` text,
	`two_factor_enabled` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE TABLE `admin_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_verifications_identifier_idx` ON `admin_verifications` (`identifier`);--> statement-breakpoint
CREATE INDEX `admin_verifications_expires_at_idx` ON `admin_verifications` (`expires_at`);--> statement-breakpoint
CREATE TABLE `store_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`password` text,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `store_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_accounts_provider_account_uq` ON `store_accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `store_accounts_user_id_idx` ON `store_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `store_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `store_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_sessions_token_unique` ON `store_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `store_sessions_user_id_idx` ON `store_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `store_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`name` text NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_users_email_unique` ON `store_users` (`email`);--> statement-breakpoint
CREATE TABLE `store_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `store_verifications_identifier_idx` ON `store_verifications` (`identifier`);--> statement-breakpoint
CREATE INDEX `store_verifications_expires_at_idx` ON `store_verifications` (`expires_at`);--> statement-breakpoint
CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_store_slug_uq` ON `category` (`store_id`,`slug`);--> statement-breakpoint
CREATE TABLE `hero_slide` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`image_desktop_key` text NOT NULL,
	`image_mobile_key` text NOT NULL,
	`title` text,
	`subtitle` text,
	`cta_label` text,
	`cta_url` text,
	`sort_order` integer NOT NULL,
	`is_active` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hero_slide_store_active_sort_idx` ON `hero_slide` (`store_id`,`is_active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `product` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`price_minor` integer NOT NULL,
	`is_active` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `store`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "product_price_minor_ck" CHECK("product"."price_minor" >= 0)
);
--> statement-breakpoint
CREATE INDEX `product_store_listing_idx` ON `product` (`store_id`,`is_deleted`,`is_active`,`sort_order`);--> statement-breakpoint
CREATE INDEX `product_store_category_idx` ON `product` (`store_id`,`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_store_slug_uq` ON `product` (`store_id`,`slug`) WHERE "product"."is_deleted" = 0;--> statement-breakpoint
CREATE TABLE `product_image` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`alt` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_image_product_sort_idx` ON `product_image` (`product_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `signup_intent` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`otp_hash` text NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_sent_at` integer NOT NULL,
	`consumed_at` integer,
	`ip_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `signup_intent_email_idx` ON `signup_intent` (`email`);--> statement-breakpoint
CREATE INDEX `signup_intent_expires_at_idx` ON `signup_intent` (`expires_at`);--> statement-breakpoint
CREATE TABLE `slug_reservation` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`store_id` text,
	`reason` text NOT NULL,
	`reserved_until` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slug_reservation_slug_uq` ON `slug_reservation` (`slug`);--> statement-breakpoint
CREATE INDEX `slug_reservation_reserved_until_idx` ON `slug_reservation` (`reserved_until`);--> statement-breakpoint
CREATE TABLE `store` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`suspended_by` text,
	`suspended_reason` text,
	`suspended_at` integer,
	`theme_id` text NOT NULL,
	`primary_color` text NOT NULL,
	`color_mode_default` text NOT NULL,
	`currency` text NOT NULL,
	`plan` text NOT NULL,
	`whatsapp_number` text,
	`whatsapp_message_template` text,
	`logo_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `store_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "store_status_ck" CHECK("store"."status" in ('pending','active','suspended')),
	CONSTRAINT "store_suspended_by_ck" CHECK("store"."suspended_by" is null or "store"."suspended_by" in ('owner','admin')),
	CONSTRAINT "store_suspension_consistency_ck" CHECK(("store"."status" = 'suspended') = ("store"."suspended_by" is not null)),
	CONSTRAINT "store_currency_ck" CHECK("store"."currency" in ('USD','EUR','COP','VES','ARS')),
	CONSTRAINT "store_color_mode_default_ck" CHECK("store"."color_mode_default" in ('light','dark'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_slug_uq` ON `store` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `store_owner_id_uq` ON `store` (`owner_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`store_id` text,
	`store_slug` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`metadata` text,
	`ip_hash` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "audit_log_actor_type_ck" CHECK("audit_log"."actor_type" in ('admin','owner','system'))
);
--> statement-breakpoint
CREATE INDEX `audit_log_store_created_idx` ON `audit_log` (`store_id`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `audit_log_actor_created_idx` ON `audit_log` (`actor_id`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `audit_log_action_created_idx` ON `audit_log` (`action`,"created_at" desc);