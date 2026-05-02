CREATE TABLE "play_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"map_id" integer NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"faction" text,
	"outcome" "played_outcome" NOT NULL,
	"duration_days" integer,
	"notes" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "user_maps_user_played_idx";--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "play_sessions_user_played_idx" ON "play_sessions" USING btree ("user_id","played_at");--> statement-breakpoint
CREATE INDEX "play_sessions_map_played_idx" ON "play_sessions" USING btree ("map_id","played_at");--> statement-breakpoint
CREATE INDEX "play_sessions_user_map_idx" ON "play_sessions" USING btree ("user_id","map_id");--> statement-breakpoint
-- Backfill: preserve existing played records as the first session for
-- each user-map. Skip rows where played_at is null (they were stubs
-- only carrying favorite/bookmark state).
INSERT INTO "play_sessions" ("user_id", "map_id", "played_at", "outcome", "notes", "created_at", "updated_at")
SELECT "user_id", "map_id", "played_at", COALESCE("played_outcome", 'won'), "played_notes", NOW(), NOW()
FROM "user_maps"
WHERE "played_at" IS NOT NULL AND "played_outcome" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "user_maps" DROP COLUMN "played_at";--> statement-breakpoint
ALTER TABLE "user_maps" DROP COLUMN "played_outcome";--> statement-breakpoint
ALTER TABLE "user_maps" DROP COLUMN "played_notes";