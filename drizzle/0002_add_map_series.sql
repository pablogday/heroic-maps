CREATE TYPE "public"."series_kind" AS ENUM('sequel', 'variant', 'remake');--> statement-breakpoint
CREATE TABLE "map_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(160) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"kind" "series_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "map_series_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "series_id" integer;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "series_position" integer;--> statement-breakpoint
CREATE INDEX "map_series_kind_idx" ON "map_series" USING btree ("kind");--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_series_id_map_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."map_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maps_series_idx" ON "maps" USING btree ("series_id","series_position");