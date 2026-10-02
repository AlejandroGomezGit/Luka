CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"currency" char(3) NOT NULL,
	"opening_balance_minor" bigint DEFAULT 0 NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "accounts_type" CHECK ("accounts"."type" in ('cash', 'checking', 'savings', 'credit_card', 'other'))
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"transaction_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_key" text,
	"uploaded_at" timestamp with time zone,
	CONSTRAINT "attachments_kind" CHECK ("attachments"."kind" in ('receipt'))
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"system_key" text,
	"archived_at" timestamp with time zone,
	CONSTRAINT "categories_kind" CHECK ("categories"."kind" in ('expense', 'income'))
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"version" text NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "consents_purpose" CHECK ("consents"."purpose" in ('terms', 'privacy', 'ai_external', 'bank_connection'))
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"app_version" text NOT NULL,
	"push_token" text,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "devices_platform" CHECK ("devices"."platform" in ('ios'))
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"kind" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"to_amount_minor" bigint,
	"currency" char(3) NOT NULL,
	"occurred_on" date NOT NULL,
	"occurred_at" timestamp with time zone,
	"category_id" uuid,
	"category_source" text DEFAULT 'user' NOT NULL,
	"category_confidence" smallint,
	"merchant" text,
	"note" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"review_status" text DEFAULT 'confirmed' NOT NULL,
	"external_id" text,
	CONSTRAINT "transactions_kind" CHECK ("transactions"."kind" in ('expense', 'income', 'transfer', 'adjustment')),
	CONSTRAINT "transactions_category_source" CHECK ("transactions"."category_source" in ('user', 'rule', 'model', 'import')),
	CONSTRAINT "transactions_source" CHECK ("transactions"."source" in ('manual', 'import_csv', 'import_pdf', 'message_paste', 'message_shortcut', 'bank', 'receipt_scan', 'recurring')),
	CONSTRAINT "transactions_review_status" CHECK ("transactions"."review_status" in ('confirmed', 'pending_review')),
	CONSTRAINT "transactions_category_confidence" CHECK ("transactions"."category_confidence" between 0 and 100),
	CONSTRAINT "transactions_inv01_amount_sign" CHECK ("transactions"."amount_minor" <> 0 and (
        ("transactions"."kind" in ('expense', 'transfer') and "transactions"."amount_minor" < 0)
        or ("transactions"."kind" = 'income' and "transactions"."amount_minor" > 0)
        or "transactions"."kind" = 'adjustment')),
	CONSTRAINT "transactions_inv02_transfer" CHECK (("transactions"."kind" = 'transfer' and "transactions"."to_account_id" is not null
          and "transactions"."to_account_id" <> "transactions"."account_id" and "transactions"."to_amount_minor" > 0)
        or ("transactions"."kind" <> 'transfer' and "transactions"."to_account_id" is null and "transactions"."to_amount_minor" is null))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" "citext",
	"apple_sub" text,
	"password_hash" text,
	"display_name" text NOT NULL,
	"base_currency" char(3) DEFAULT 'COP' NOT NULL,
	"locale" text DEFAULT 'es-CO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_apple_sub_unique" UNIQUE("apple_sub")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_list" ON "transactions" USING btree ("user_id","occurred_on" DESC NULLS LAST,"id") WHERE "transactions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "transactions_month" ON "transactions" USING btree ("user_id","occurred_on","category_id");--> statement-breakpoint
CREATE INDEX "transactions_account" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_to_account" ON "transactions" USING btree ("to_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_external_id" ON "transactions" USING btree ("user_id","account_id","external_id") WHERE "transactions"."external_id" is not null;