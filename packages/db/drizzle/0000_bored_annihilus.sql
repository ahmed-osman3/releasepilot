CREATE SCHEMA "api";
--> statement-breakpoint
CREATE TABLE "api"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."asc_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"issuer_id" text NOT NULL,
	"key_id" text NOT NULL,
	"encrypted_private_key" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api"."connected_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"asc_key_id" integer,
	"app_store_app_id" text,
	"name" text,
	"bundle_id" text,
	"issuer_id" text,
	"key_id" text,
	"encrypted_private_key" text,
	"github_installation_id" text,
	"github_repo_full_name" text,
	"github_repo_owner" text,
	"github_repo_name" text,
	"watched_branch" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api"."github_installations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"github_installation_id" text NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api"."release_timeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"connected_app_id" integer NOT NULL,
	"version_id" text NOT NULL,
	"event_type" text NOT NULL,
	"detail" text,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "api"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "api"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_index" ON "api"."account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "api"."account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "asc_api_keys_user_id_index" ON "api"."asc_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asc_api_keys_user_id_unique" ON "api"."asc_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "connected_apps_user_id_index" ON "api"."connected_apps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "connected_apps_asc_key_id_index" ON "api"."connected_apps" USING btree ("asc_key_id");--> statement-breakpoint
CREATE INDEX "connected_apps_github_installation_id_index" ON "api"."connected_apps" USING btree ("github_installation_id");--> statement-breakpoint
CREATE INDEX "github_installations_user_id_index" ON "api"."github_installations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "github_installations_user_installation_unique" ON "api"."github_installations" USING btree ("user_id","github_installation_id");--> statement-breakpoint
CREATE INDEX "release_timeline_events_connected_app_id_index" ON "api"."release_timeline_events" USING btree ("connected_app_id");--> statement-breakpoint
CREATE INDEX "release_timeline_events_version_id_index" ON "api"."release_timeline_events" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "release_timeline_events_event_type_index" ON "api"."release_timeline_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique" ON "api"."session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_index" ON "api"."session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "api"."user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_index" ON "api"."verification" USING btree ("identifier");