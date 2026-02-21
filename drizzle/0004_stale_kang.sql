CREATE TABLE "api"."release_timeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"connected_app_id" integer NOT NULL,
	"version_id" text NOT NULL,
	"event_type" text NOT NULL,
	"detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "release_timeline_events_connected_app_id_index" ON "api"."release_timeline_events" USING btree ("connected_app_id");--> statement-breakpoint
CREATE INDEX "release_timeline_events_version_id_index" ON "api"."release_timeline_events" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "release_timeline_events_event_type_index" ON "api"."release_timeline_events" USING btree ("event_type");