DELETE FROM "api"."release_timeline_events" AS "rte"
WHERE NOT EXISTS (
  SELECT 1
  FROM "api"."connected_apps" AS "ca"
  WHERE "ca"."id" = "rte"."connected_app_id"
);
--> statement-breakpoint
DELETE FROM "api"."connected_apps" AS "ca"
WHERE NOT EXISTS (
  SELECT 1
  FROM "api"."user" AS "u"
  WHERE "u"."id" = "ca"."user_id"
);
--> statement-breakpoint
DELETE FROM "api"."asc_api_keys" AS "aak"
WHERE NOT EXISTS (
  SELECT 1
  FROM "api"."user" AS "u"
  WHERE "u"."id" = "aak"."user_id"
);
--> statement-breakpoint
DELETE FROM "api"."github_installations" AS "gi"
WHERE NOT EXISTS (
  SELECT 1
  FROM "api"."user" AS "u"
  WHERE "u"."id" = "gi"."user_id"
);
--> statement-breakpoint
UPDATE "api"."connected_apps" AS "ca"
SET "asc_key_id" = NULL
WHERE "ca"."asc_key_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "api"."asc_api_keys" AS "aak"
    WHERE "aak"."id" = "ca"."asc_key_id"
  );
--> statement-breakpoint
ALTER TABLE "api"."asc_api_keys"
ADD CONSTRAINT "asc_api_keys_user_id_user_id_fk"
FOREIGN KEY ("user_id") REFERENCES "api"."user"("id")
ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api"."github_installations"
ADD CONSTRAINT "github_installations_user_id_user_id_fk"
FOREIGN KEY ("user_id") REFERENCES "api"."user"("id")
ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api"."connected_apps"
ADD CONSTRAINT "connected_apps_user_id_user_id_fk"
FOREIGN KEY ("user_id") REFERENCES "api"."user"("id")
ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api"."connected_apps"
ADD CONSTRAINT "connected_apps_asc_key_id_asc_api_keys_id_fk"
FOREIGN KEY ("asc_key_id") REFERENCES "api"."asc_api_keys"("id")
ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api"."release_timeline_events"
ADD CONSTRAINT "release_timeline_events_connected_app_id_connected_apps_id_fk"
FOREIGN KEY ("connected_app_id") REFERENCES "api"."connected_apps"("id")
ON DELETE cascade ON UPDATE no action;
