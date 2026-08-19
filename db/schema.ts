import { sql } from "drizzle-orm";
import {
	check,
	date,
	index,
	integer,
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

export const recurrenceFrequency = pgEnum("recurrence_frequency", [
	"day",
	"week",
	"month",
	"year",
]);

export const recurrenceMonthlyPattern = pgEnum("recurrence_monthly_pattern", [
	"day_of_month",
	"nth_weekday",
]);

export const recurrenceEndType = pgEnum("recurrence_end_type", [
	"never",
	"on_date",
	"after_occurrences",
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

export const eventRecurrence = pgTable(
	"event_recurrence",
	{
		eventId: uuid("event_id")
			.primaryKey()
			.references(() => event.id, { onDelete: "cascade" }),
		frequency: recurrenceFrequency("frequency").notNull(),
		interval: integer("interval").notNull(),
		weekdays: integer("weekdays").array(),
		monthlyPattern: recurrenceMonthlyPattern("monthly_pattern"),
		endType: recurrenceEndType("end_type").notNull(),
		endDate: date("end_date", { mode: "string" }),
		occurrenceCount: integer("occurrence_count"),
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
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		check(
			"event_recurrence_interval_range",
			sql`${table.interval} BETWEEN 1 AND 99`,
		),
		check(
			"event_recurrence_weekdays_consistency",
				sql`(
				${table.frequency} = 'week'
				AND ${table.weekdays} IS NOT NULL
				AND array_ndims(${table.weekdays}) = 1
				AND cardinality(${table.weekdays}) BETWEEN 1 AND 7
				AND array_position(${table.weekdays}, NULL) IS NULL
				AND ${table.weekdays} <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::integer[]
			) OR (
				${table.frequency} <> 'week'
				AND ${table.weekdays} IS NULL
			)`,
		),
		check(
			"event_recurrence_monthly_pattern_consistency",
			sql`(
				${table.frequency} = 'month'
				AND ${table.monthlyPattern} IS NOT NULL
			) OR (
				${table.frequency} <> 'month'
				AND ${table.monthlyPattern} IS NULL
			)`,
		),
		check(
			"event_recurrence_end_consistency",
			sql`(
				${table.endType} = 'never'
				AND ${table.endDate} IS NULL
				AND ${table.occurrenceCount} IS NULL
			) OR (
				${table.endType} = 'on_date'
				AND ${table.endDate} IS NOT NULL
				AND ${table.occurrenceCount} IS NULL
			) OR (
				${table.endType} = 'after_occurrences'
				AND ${table.endDate} IS NULL
				AND ${table.occurrenceCount} IS NOT NULL
				AND ${table.occurrenceCount} BETWEEN 2 AND 1000
			)`,
		),
	],
);

export type EventRow = typeof event.$inferSelect;
export type EventRecurrenceRow = typeof eventRecurrence.$inferSelect;
export type EventMode = (typeof eventMode.enumValues)[number];
export type EventStatus = (typeof eventStatus.enumValues)[number];
export type RecurrenceFrequency =
	(typeof recurrenceFrequency.enumValues)[number];
export type RecurrenceMonthlyPattern =
	(typeof recurrenceMonthlyPattern.enumValues)[number];
export type RecurrenceEndType = (typeof recurrenceEndType.enumValues)[number];
