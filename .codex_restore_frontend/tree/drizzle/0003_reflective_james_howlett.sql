CREATE TABLE "api"."asc_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"issuer_id" text NOT NULL,
	"key_id" text NOT NULL,
	"encrypted_private_key" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "api"."connected_apps" ADD COLUMN "asc_key_id" integer;--> statement-breakpoint
CREATE INDEX "asc_api_keys_user_id_index" ON "api"."asc_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asc_api_keys_user_id_unique" ON "api"."asc_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "connected_apps_asc_key_id_index" ON "api"."connected_apps" USING btree ("asc_key_id");