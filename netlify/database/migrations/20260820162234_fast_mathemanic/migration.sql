CREATE TYPE "event_change_scope" AS ENUM('series', 'occurrence');--> statement-breakpoint
CREATE TABLE "event_change_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"scope" "event_change_scope" NOT NULL,
	"occurrence_date" date,
	"proposed_by" text,
	"base_content_version" integer NOT NULL,
	"base_occurrence_version" integer DEFAULT 0 NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" varchar(64) DEFAULT 'America/Los_Angeles' NOT NULL,
	"mode" "event_mode" NOT NULL,
	"location_name" varchar(200),
	"location_address" text,
	"event_url" text,
	"recurrence_frequency" "recurrence_frequency",
	"recurrence_interval" integer,
	"recurrence_weekdays" integer[],
	"recurrence_monthly_pattern" "recurrence_monthly_pattern",
	"recurrence_end_type" "recurrence_end_type",
	"recurrence_end_date" date,
	"recurrence_occurrence_count" integer,
	"status" "event_status" DEFAULT 'pending'::"event_status" NOT NULL,
	"moderation_note" varchar(500),
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_change_request_ends_after_start" CHECK ("ends_at" > "starts_at"),
	CONSTRAINT "event_change_request_scope_date_consistency" CHECK ((
				"scope" = 'series' AND "occurrence_date" IS NULL
			) OR (
				"scope" = 'occurrence' AND "occurrence_date" IS NOT NULL
			)),
	CONSTRAINT "event_change_request_recurrence_presence" CHECK ((
				"recurrence_frequency" IS NULL
				AND "recurrence_interval" IS NULL
				AND "recurrence_weekdays" IS NULL
				AND "recurrence_monthly_pattern" IS NULL
				AND "recurrence_end_type" IS NULL
				AND "recurrence_end_date" IS NULL
				AND "recurrence_occurrence_count" IS NULL
			) OR (
				"scope" = 'series'
				AND "recurrence_frequency" IS NOT NULL
				AND "recurrence_interval" BETWEEN 1 AND 99
				AND "recurrence_end_type" IS NOT NULL
			)),
	CONSTRAINT "event_change_request_weekdays_consistency" CHECK ((
				"recurrence_frequency" = 'week'
				AND "recurrence_weekdays" IS NOT NULL
				AND array_ndims("recurrence_weekdays") = 1
				AND cardinality("recurrence_weekdays") BETWEEN 1 AND 7
				AND array_position("recurrence_weekdays", NULL) IS NULL
				AND "recurrence_weekdays" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::integer[]
			) OR (
				"recurrence_frequency" <> 'week'
				AND "recurrence_weekdays" IS NULL
			) OR "recurrence_frequency" IS NULL),
	CONSTRAINT "event_change_request_monthly_pattern_consistency" CHECK ((
				"recurrence_frequency" = 'month'
				AND "recurrence_monthly_pattern" IS NOT NULL
			) OR (
				"recurrence_frequency" <> 'month'
				AND "recurrence_monthly_pattern" IS NULL
			) OR "recurrence_frequency" IS NULL),
	CONSTRAINT "event_change_request_recurrence_end_consistency" CHECK ((
				"recurrence_end_type" = 'never'
				AND "recurrence_end_date" IS NULL
				AND "recurrence_occurrence_count" IS NULL
			) OR (
				"recurrence_end_type" = 'on_date'
				AND "recurrence_end_date" IS NOT NULL
				AND "recurrence_occurrence_count" IS NULL
			) OR (
				"recurrence_end_type" = 'after_occurrences'
				AND "recurrence_end_date" IS NULL
				AND "recurrence_occurrence_count" BETWEEN 2 AND 1000
			) OR "recurrence_end_type" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "event_collaborator" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_occurrence_override" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"occurrence_date" date NOT NULL,
	"approved_change_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" varchar(64) DEFAULT 'America/Los_Angeles' NOT NULL,
	"mode" "event_mode" NOT NULL,
	"location_name" varchar(200),
	"location_address" text,
	"event_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_occurrence_override_ends_after_start" CHECK ("ends_at" > "starts_at")
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "content_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "event_change_request_pending_series_uidx" ON "event_change_request" ("event_id") WHERE "status" = 'pending' AND "scope" = 'series';--> statement-breakpoint
CREATE UNIQUE INDEX "event_change_request_pending_occurrence_uidx" ON "event_change_request" ("event_id","occurrence_date") WHERE "status" = 'pending' AND "scope" = 'occurrence';--> statement-breakpoint
CREATE INDEX "event_change_request_status_created_at_idx" ON "event_change_request" ("status","created_at");--> statement-breakpoint
CREATE INDEX "event_change_request_event_id_idx" ON "event_change_request" ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_collaborator_event_user_uidx" ON "event_collaborator" ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_collaborator_user_id_idx" ON "event_collaborator" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_occurrence_override_event_date_uidx" ON "event_occurrence_override" ("event_id","occurrence_date");--> statement-breakpoint
CREATE INDEX "event_occurrence_override_event_id_idx" ON "event_occurrence_override" ("event_id");--> statement-breakpoint
ALTER TABLE "event_change_request" ADD CONSTRAINT "event_change_request_event_id_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_change_request" ADD CONSTRAINT "event_change_request_proposed_by_user_id_fkey" FOREIGN KEY ("proposed_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_change_request" ADD CONSTRAINT "event_change_request_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_collaborator" ADD CONSTRAINT "event_collaborator_event_id_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_collaborator" ADD CONSTRAINT "event_collaborator_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_collaborator" ADD CONSTRAINT "event_collaborator_invited_by_user_id_fkey" FOREIGN KEY ("invited_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_occurrence_override" ADD CONSTRAINT "event_occurrence_override_event_id_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_occurrence_override" ADD CONSTRAINT "event_occurrence_override_yySwgHr1BfW2_fkey" FOREIGN KEY ("approved_change_id") REFERENCES "event_change_request"("id") ON DELETE SET NULL;