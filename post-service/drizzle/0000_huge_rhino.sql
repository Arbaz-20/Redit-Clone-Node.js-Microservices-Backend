CREATE TABLE IF NOT EXISTS "posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"community_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"author_username" varchar(32) NOT NULL,
	"title" varchar(300) NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"vote_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_posts_community" ON "posts" USING btree ("community_id");