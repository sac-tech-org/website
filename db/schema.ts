import { sql } from "drizzle-orm";
import {
	check,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "@/db/auth-schema";

export const eventMode = pgEnum("event_mode", [
	"online",
	"in_person",
	"hybrid",
]);

export const eventStatus = pgEnum("event_status", [
	"pending",
	"approved",
	"rejected",
]);

export const event = pgTable(
	"event",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		submittedBy: text("submitted_by").references(() => user.id, {
			onDelete: "set null",
		}),
		title: varchar("title", { length: 160 }).notNull(),
		description: text("description").notNull(),
		startsAt: timestamp("starts_at", {
			mode: "date",
			withTimezone: true,
		}).notNull(),
		endsAt: timestamp("ends_at", {
			mode: "date",
			withTimezone: true,
		}).notNull(),
		timezone: varchar("timezone", { length: 64 })
			.default("America/Los_Angeles")
			.notNull(),
		mode: eventMode("mode").notNull(),
		locationName: varchar("location_name", { length: 200 }),
		locationAddress: text("location_address"),
		eventUrl: text("event_url"),
		status: eventStatus("status").default("pending").notNull(),
		moderationNote: varchar("moderation_note", { length: 500 }),
		reviewedBy: text("reviewed_by").references(() => user.id, {
			onDelete: "set null",
		}),
		reviewedAt: timestamp("reviewed_at", {
			mode: "date",
			withTimezone: true,
		}),
		createdAt: timestamp("created_at", {
			mode: "date",
			withTimezone: true,
		})
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", {
			mode: "date",
			withTimezone: true,
		})
			.defaultNow()
			.notNull(),
	},
	(table) => [
		check("event_ends_after_start", sql`${table.endsAt} > ${table.startsAt}`),
		index("event_status_starts_at_idx").on(table.status, table.startsAt),
		index("event_submitted_by_created_at_idx").on(
			table.submittedBy,
			table.createdAt,
		),
	],
);

export type EventRow = typeof event.$inferSelect;
export type EventMode = (typeof eventMode.enumValues)[number];
export type EventStatus = (typeof eventStatus.enumValues)[number];
