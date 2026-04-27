CREATE TYPE "public"."difficulty" AS ENUM('easy', 'normal', 'hard', 'expert', 'impossible');--> statement-breakpoint
CREATE TYPE "public"."map_size" AS ENUM('S', 'M', 'L', 'XL', 'H', 'XH', 'G');--> statement-breakpoint
CREATE TYPE "public"."map_version" AS ENUM('RoE', 'AB', 'SoD', 'HotA', 'WoG', 'Chronicles', 'HD', 'Other');--> statement-breakpoint
CREATE TYPE "public"."played_outcome" AS ENUM('won', 'lost', 'abandoned');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "downloads" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"user_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_tags" (
	"map_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "map_tags_map_id_tag_id_pk" PRIMARY KEY("map_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "maps" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(160) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"size" "map_size" NOT NULL,
	"width" integer,
	"height" integer,
	"has_underground" boolean DEFAULT false NOT NULL,
	"version" "map_version" NOT NULL,
	"difficulty" "difficulty",
	"total_players" integer NOT NULL,
	"human_players" integer NOT NULL,
	"ai_players" integer NOT NULL,
	"team_count" integer,
	"victory_condition" text,
	"loss_condition" text,
	"file_key" text NOT NULL,
	"file_size" integer,
	"preview_key" text,
	"minimap_key" text,
	"uploader_id" text,
	"source_url" text,
	"download_count" integer DEFAULT 0 NOT NULL,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"source_rating" real,
	"ai_summary" text,
	"ai_summary_review_count" integer DEFAULT 0 NOT NULL,
	"factions" text[],
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maps_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(60) NOT NULL,
	"label" varchar(80) NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_maps" (
	"user_id" text NOT NULL,
	"map_id" integer NOT NULL,
	"favorited" boolean DEFAULT false NOT NULL,
	"bookmarked" boolean DEFAULT false NOT NULL,
	"played_at" timestamp with time zone,
	"played_outcome" "played_outcome",
	"played_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_maps_user_id_map_id_pk" PRIMARY KEY("user_id","map_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"discord_id" varchar(64),
	"name" varchar(80),
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"avatar_url" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_tags" ADD CONSTRAINT "map_tags_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_tags" ADD CONSTRAINT "map_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_maps" ADD CONSTRAINT "user_maps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_maps" ADD CONSTRAINT "user_maps_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "downloads_map_idx" ON "downloads" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "downloads_time_idx" ON "downloads" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "maps_version_idx" ON "maps" USING btree ("version");--> statement-breakpoint
CREATE INDEX "maps_size_idx" ON "maps" USING btree ("size");--> statement-breakpoint
CREATE INDEX "maps_players_idx" ON "maps" USING btree ("total_players");--> statement-breakpoint
CREATE INDEX "maps_downloads_idx" ON "maps" USING btree ("download_count");--> statement-breakpoint
CREATE INDEX "maps_published_idx" ON "maps" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "maps_factions_idx" ON "maps" USING gin ("factions");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_map_user_unique" ON "reviews" USING btree ("map_id","user_id");--> statement-breakpoint
CREATE INDEX "reviews_map_idx" ON "reviews" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "user_maps_user_fav_idx" ON "user_maps" USING btree ("user_id","favorited");--> statement-breakpoint
CREATE INDEX "user_maps_user_bookmark_idx" ON "user_maps" USING btree ("user_id","bookmarked");--> statement-breakpoint
CREATE INDEX "user_maps_user_played_idx" ON "user_maps" USING btree ("user_id","played_at");