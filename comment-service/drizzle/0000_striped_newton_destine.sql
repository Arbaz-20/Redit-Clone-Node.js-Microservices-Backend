CREATE TABLE IF NOT EXISTS "comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"parent_id" uuid,
	"author_id" uuid NOT NULL,
	"author_username" varchar(32) NOT NULL,
	"body" text NOT NULL,
	"vote_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comments_post" ON "comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comments_parent" ON "comments" USING btree ("parent_id");