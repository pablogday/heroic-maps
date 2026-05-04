-- Path-1 collapse: favorited and bookmarked were two flags doing the
-- same job (private save-for-later boolean). Fold favorited rows
-- into bookmarked before dropping the column so anyone who *only*
-- favorited a map keeps that save under the unified Bookmarks list.
UPDATE "user_maps"
SET "bookmarked" = true
WHERE "favorited" = true AND "bookmarked" = false;
--> statement-breakpoint
DROP INDEX "user_maps_user_fav_idx";--> statement-breakpoint
ALTER TABLE "user_maps" DROP COLUMN "favorited";