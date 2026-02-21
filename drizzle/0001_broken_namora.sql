CREATE SCHEMA "api";
--> statement-breakpoint
CREATE TABLE "api"."connected_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"app_store_app_id" text,
	"name" text,
	"bundle_id" text,
	"issuer_id" text,
	"key_id" text,
	"encrypted_private_key" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api"."todos" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP TABLE "connected_apps" CASCADE;--> statement-breakpoint
DROP TABLE "todos" CASCADE;--> statement-breakpoint
CREATE INDEX "connected_apps_user_id_index" ON "api"."connected_apps" USING btree ("user_id");