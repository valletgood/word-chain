CREATE TABLE IF NOT EXISTS "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"host_nickname" text NOT NULL,
	"host_session_id" text NOT NULL,
	"guest_nickname" text,
	"guest_session_id" text,
	"status" text DEFAULT 'waiting' NOT NULL,
	"current_turn_session_id" text,
	"turn_deadline" timestamp with time zone,
	"winner_session_id" text,
	"loser_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"turn_number" integer NOT NULL,
	"submission_index" integer NOT NULL,
	"player_session_id" text NOT NULL,
	"player_nickname" text NOT NULL,
	"word" text NOT NULL,
	"is_valid" boolean NOT NULL,
	"invalid_reason" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "words" ADD CONSTRAINT "words_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "words_room_idx" ON "words" USING btree ("room_id","submission_index");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "words_room_valid_word_idx" ON "words" USING btree ("room_id","word") WHERE is_valid = true;