CREATE TABLE "digests" (
	"date" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text,
	"from_email" text,
	"from_name" text,
	"to_emails" text[] DEFAULT '{}' NOT NULL,
	"subject" text,
	"received_at" timestamp with time zone,
	"snippet" text,
	"excerpt" text,
	"labels" text[] DEFAULT '{}' NOT NULL,
	"category" text,
	"kid_ids" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"summary" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"item_ids" text[] DEFAULT '{}' NOT NULL,
	"ai" jsonb,
	"error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"area" text DEFAULT 'home' NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"kid_ids" text[] DEFAULT '{}' NOT NULL,
	"category" text,
	"subject" text,
	"assessment_kind" text,
	"topics" text,
	"date" text,
	"time" text,
	"end_date" text,
	"end_time" text,
	"date_precision" text DEFAULT 'exact' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"confidence" real,
	"estimate_minutes" real,
	"amount" double precision,
	"currency" text,
	"payee" text,
	"payment_info" jsonb,
	"paid_at" timestamp with time zone,
	"url" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_email_id" text,
	"source_contact" text,
	"source_quote" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"calendar_event_id" text,
	"calendar_prep_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calendar_synced_at" timestamp with time zone,
	"calendar_error" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kv" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"provider" text PRIMARY KEY NOT NULL,
	"account" text,
	"refresh_token" text,
	"access_token" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"trigger" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"stats" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "emails_received_idx" ON "emails" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "emails_category_idx" ON "emails" USING btree ("category");--> statement-breakpoint
CREATE INDEX "items_type_status_idx" ON "items" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "items_date_idx" ON "items" USING btree ("date");--> statement-breakpoint
CREATE INDEX "items_source_email_idx" ON "items" USING btree ("source_email_id");