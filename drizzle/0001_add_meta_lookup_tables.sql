CREATE TABLE "difficulty_levels" (
	"code" "difficulty" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_sizes" (
	"code" "map_size" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_versions" (
	"code" "map_version" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint

-- Seed lookup tables. Migration is self-contained so a fresh DB after
-- `db:migrate` has the canonical labels available immediately.
INSERT INTO "map_versions" ("code", "name", "sort_order") VALUES
  ('RoE',        'Restoration of Erathia', 1),
  ('AB',         'Armageddon''s Blade',    2),
  ('SoD',        'The Shadow of Death',    3),
  ('HotA',       'Horn of the Abyss',      4),
  ('WoG',        'In the Wake of Gods',    5),
  ('Chronicles', 'Chronicles',             6),
  ('HD',         'HD Edition',             7),
  ('Other',      'Other',                  99);
--> statement-breakpoint

INSERT INTO "map_sizes" ("code", "name", "sort_order") VALUES
  ('S',  'Small',       1),
  ('M',  'Medium',      2),
  ('L',  'Large',       3),
  ('XL', 'Extra Large', 4),
  ('H',  'Huge',        5),
  ('XH', 'Extra Huge',  6),
  ('G',  'Giant',       7);
--> statement-breakpoint

INSERT INTO "difficulty_levels" ("code", "name", "sort_order") VALUES
  ('easy',       'Easy',       1),
  ('normal',     'Normal',     2),
  ('hard',       'Hard',       3),
  ('expert',     'Expert',     4),
  ('impossible', 'Impossible', 5);
