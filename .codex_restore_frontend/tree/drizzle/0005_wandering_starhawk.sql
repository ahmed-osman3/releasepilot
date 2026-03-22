CREATE TABLE "api"."github_installations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"github_installation_id" text NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "api"."connected_apps" ADD COLUMN "github_installation_id" text;--> statement-breakpoint
ALTER TABLE "api"."connected_apps" ADD COLUMN "github_repo_full_name" text;--> statement-breakpoint
ALTER TABLE "api"."connected_apps" ADD COLUMN "github_repo_owner" text;--> statement-breakpoint
ALTER TABLE "api"."connected_apps" ADD COLUMN "github_repo_name" text;--> statement-breakpoint
ALTER TABLE "api"."connected_apps" ADD COLUMN "watched_branch" text;--> statement-breakpoint
CREATE INDEX "github_installations_user_id_index" ON "api"."github_installations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "github_installations_user_installation_unique" ON "api"."github_installations" USING btree ("user_id","github_installation_id");--> statement-breakpoint
CREATE INDEX "connected_apps_github_installation_id_index" ON "api"."connected_apps" USING btree ("github_installation_id");--> statement-breakpoint
DELETE FROM "api"."release_timeline_events"
WHERE "connected_app_id" IN (
  SELECT "id" FROM "api"."connected_apps" WHERE "user_id" = 'default'
);--> statement-breakpoint
DELETE FROM "api"."connected_apps" WHERE "user_id" = 'default';--> statement-breakpoint
DELETE FROM "api"."asc_api_keys" WHERE "user_id" = 'default';
