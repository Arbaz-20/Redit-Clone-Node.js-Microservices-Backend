CREATE TABLE IF NOT EXISTS "votes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" varchar(10) NOT NULL,
	"target_id" uuid NOT NULL,
	"value" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_user_id_target_type_target_id_key" UNIQUE("user_id","target_type","target_id"),
	CONSTRAINT "votes_target_type_check" CHECK ("votes"."target_type" IN ('post', 'comment')),
	CONSTRAINT "votes_value_check" CHECK ("votes"."value" IN (-1, 1))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_votes_target" ON "votes" USING btree ("target_type","target_id");