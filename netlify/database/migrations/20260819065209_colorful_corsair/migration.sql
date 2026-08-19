CREATE TYPE "recurrence_end_type" AS ENUM('never', 'on_date', 'after_occurrences');--> statement-breakpoint
CREATE TYPE "recurrence_frequency" AS ENUM('day', 'week', 'month', 'year');--> statement-breakpoint
CREATE TYPE "recurrence_monthly_pattern" AS ENUM('day_of_month', 'nth_weekday');--> statement-breakpoint
CREATE TABLE "event_recurrence" (
	"event_id" uuid PRIMARY KEY,
	"frequency" "recurrence_frequency" NOT NULL,
	"interval" integer NOT NULL,
	"weekdays" integer[],
	"monthly_pattern" "recurrence_monthly_pattern",
	"end_type" "recurrence_end_type" NOT NULL,
	"end_date" date,
	"occurrence_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_recurrence_interval_range" CHECK ("interval" BETWEEN 1 AND 99),
	CONSTRAINT "event_recurrence_weekdays_consistency" CHECK ((
				"frequency" = 'week'
				AND "weekdays" IS NOT NULL
				AND array_ndims("weekdays") = 1
				AND cardinality("weekdays") BETWEEN 1 AND 7
				AND array_position("weekdays", NULL) IS NULL
				AND "weekdays" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::integer[]
			) OR (
				"frequency" <> 'week'
				AND "weekdays" IS NULL
			)),
	CONSTRAINT "event_recurrence_monthly_pattern_consistency" CHECK ((
				"frequency" = 'month'
				AND "monthly_pattern" IS NOT NULL
			) OR (
				"frequency" <> 'month'
				AND "monthly_pattern" IS NULL
			)),
	CONSTRAINT "event_recurrence_end_consistency" CHECK ((
				"end_type" = 'never'
				AND "end_date" IS NULL
				AND "occurrence_count" IS NULL
			) OR (
				"end_type" = 'on_date'
				AND "end_date" IS NOT NULL
				AND "occurrence_count" IS NULL
			) OR (
				"end_type" = 'after_occurrences'
				AND "end_date" IS NULL
				AND "occurrence_count" IS NOT NULL
				AND "occurrence_count" BETWEEN 2 AND 1000
			))
);
--> statement-breakpoint
ALTER TABLE "event_recurrence" ADD CONSTRAINT "event_recurrence_event_id_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE;
