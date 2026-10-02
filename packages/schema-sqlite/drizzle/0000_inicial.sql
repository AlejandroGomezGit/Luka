CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 0 NOT NULL,
	`field_clocks` text DEFAULT '{}' NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text(3) NOT NULL,
	`opening_balance_minor` integer DEFAULT 0 NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	CONSTRAINT "accounts_type" CHECK("accounts"."type" in ('cash', 'checking', 'savings', 'credit_card', 'other'))
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 0 NOT NULL,
	`field_clocks` text DEFAULT '{}' NOT NULL,
	`transaction_id` text NOT NULL,
	`kind` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`storage_key` text,
	`uploaded_at` integer,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "attachments_kind" CHECK("attachments"."kind" in ('receipt'))
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 0 NOT NULL,
	`field_clocks` text DEFAULT '{}' NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`system_key` text,
	`archived_at` integer,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "categories_kind" CHECK("categories"."kind" in ('expense', 'income'))
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 0 NOT NULL,
	`field_clocks` text DEFAULT '{}' NOT NULL,
	`account_id` text NOT NULL,
	`to_account_id` text,
	`kind` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`to_amount_minor` integer,
	`currency` text(3) NOT NULL,
	`occurred_on` text NOT NULL,
	`occurred_at` integer,
	`category_id` text,
	`category_source` text DEFAULT 'user' NOT NULL,
	`category_confidence` integer,
	`merchant` text,
	`note` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`review_status` text DEFAULT 'confirmed' NOT NULL,
	`external_id` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "transactions_kind" CHECK("transactions"."kind" in ('expense', 'income', 'transfer', 'adjustment')),
	CONSTRAINT "transactions_category_source" CHECK("transactions"."category_source" in ('user', 'rule', 'model', 'import')),
	CONSTRAINT "transactions_source" CHECK("transactions"."source" in ('manual', 'import_csv', 'import_pdf', 'message_paste', 'message_shortcut', 'bank', 'receipt_scan', 'recurring')),
	CONSTRAINT "transactions_review_status" CHECK("transactions"."review_status" in ('confirmed', 'pending_review')),
	CONSTRAINT "transactions_category_confidence" CHECK("transactions"."category_confidence" between 0 and 100),
	CONSTRAINT "transactions_inv01_amount_sign" CHECK("transactions"."amount_minor" <> 0 and (
        ("transactions"."kind" in ('expense', 'transfer') and "transactions"."amount_minor" < 0)
        or ("transactions"."kind" = 'income' and "transactions"."amount_minor" > 0)
        or "transactions"."kind" = 'adjustment')),
	CONSTRAINT "transactions_inv02_transfer" CHECK(("transactions"."kind" = 'transfer' and "transactions"."to_account_id" is not null
          and "transactions"."to_account_id" <> "transactions"."account_id" and "transactions"."to_amount_minor" > 0)
        or ("transactions"."kind" <> 'transfer' and "transactions"."to_account_id" is null and "transactions"."to_amount_minor" is null))
);
--> statement-breakpoint
CREATE INDEX `transactions_list` ON `transactions` (`user_id`,"occurred_on" desc,`id`) WHERE "transactions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `transactions_month` ON `transactions` (`user_id`,`occurred_on`,`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_account` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_to_account` ON `transactions` (`to_account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_external_id` ON `transactions` (`user_id`,`account_id`,`external_id`) WHERE "transactions"."external_id" is not null;