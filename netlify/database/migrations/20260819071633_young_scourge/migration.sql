CREATE TABLE "event_occurrence_cancellation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"occurrence_date" date NOT NULL,
	"canceled_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "canceled_by" text;--> statement-breakpoint
CREATE UNIQUE INDEX "event_occurrence_cancellation_event_date_uidx" ON "event_occurrence_cancellation" ("event_id","occurrence_date");--> statement-breakpoint
CREATE INDEX "event_occurrence_cancellation_event_id_idx" ON "event_occurrence_cancellation" ("event_id");--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_canceled_by_user_id_fkey" FOREIGN KEY ("canceled_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "event_occurrence_cancellation" ADD CONSTRAINT "event_occurrence_cancellation_event_id_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_occurrence_cancellation" ADD CONSTRAINT "event_occurrence_cancellation_canceled_by_user_id_fkey" FOREIGN KEY ("canceled_by") REFERENCES "user"("id") ON DELETE SET NULL;