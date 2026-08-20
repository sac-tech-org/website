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
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "@/db/auth-schema";
import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";

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

export const eventChangeScope = pgEnum("event_change_scope", [
	"series",
	"occurrence",
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
			.default(SACRAMENTO_TIME_ZONE)
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
		canceledAt: timestamp("canceled_at", {
			mode: "date",
			withTimezone: true,
		}),
		canceledBy: text("canceled_by").references(() => user.id, {
			onDelete: "set null",
		}),
		contentVersion: integer("content_version").default(1).notNull(),
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

export const eventOccurrenceCancellation = pgTable(
	"event_occurrence_cancellation",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => event.id, { onDelete: "cascade" }),
		occurrenceDate: date("occurrence_date", { mode: "string" }).notNull(),
		canceledBy: text("canceled_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", {
			mode: "date",
			withTimezone: true,
		})
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("event_occurrence_cancellation_event_date_uidx").on(
			table.eventId,
			table.occurrenceDate,
		),
		index("event_occurrence_cancellation_event_id_idx").on(table.eventId),
	],
);

export const eventCollaborator = pgTable(
	"event_collaborator",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => event.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		invitedBy: text("invited_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", {
			mode: "date",
			withTimezone: true,
		})
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("event_collaborator_event_user_uidx").on(
			table.eventId,
			table.userId,
		),
		index("event_collaborator_user_id_idx").on(table.userId),
	],
);

/**
 * A complete proposed snapshot of an approved event (or one occurrence).
 * Keeping proposals separate lets the currently approved event stay public
 * until a reviewer accepts the replacement.
 */
export const eventChangeRequest = pgTable(
	"event_change_request",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => event.id, { onDelete: "cascade" }),
		scope: eventChangeScope("scope").notNull(),
		occurrenceDate: date("occurrence_date", { mode: "string" }),
		proposedBy: text("proposed_by").references(() => user.id, {
			onDelete: "set null",
		}),
		baseContentVersion: integer("base_content_version").notNull(),
		baseOccurrenceVersion: integer("base_occurrence_version")
			.default(0)
			.notNull(),
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
			.default(SACRAMENTO_TIME_ZONE)
			.notNull(),
		mode: eventMode("mode").notNull(),
		locationName: varchar("location_name", { length: 200 }),
		locationAddress: text("location_address"),
		eventUrl: text("event_url"),
		recurrenceFrequency: recurrenceFrequency("recurrence_frequency"),
		recurrenceInterval: integer("recurrence_interval"),
		recurrenceWeekdays: integer("recurrence_weekdays").array(),
		recurrenceMonthlyPattern: recurrenceMonthlyPattern(
			"recurrence_monthly_pattern",
		),
		recurrenceEndType: recurrenceEndType("recurrence_end_type"),
		recurrenceEndDate: date("recurrence_end_date", { mode: "string" }),
		recurrenceOccurrenceCount: integer("recurrence_occurrence_count"),
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
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		check(
			"event_change_request_ends_after_start",
			sql`${table.endsAt} > ${table.startsAt}`,
		),
		check(
			"event_change_request_scope_date_consistency",
			sql`(
				${table.scope} = 'series' AND ${table.occurrenceDate} IS NULL
			) OR (
				${table.scope} = 'occurrence' AND ${table.occurrenceDate} IS NOT NULL
			)`,
		),
		check(
			"event_change_request_recurrence_presence",
			sql`(
				${table.recurrenceFrequency} IS NULL
				AND ${table.recurrenceInterval} IS NULL
				AND ${table.recurrenceWeekdays} IS NULL
				AND ${table.recurrenceMonthlyPattern} IS NULL
				AND ${table.recurrenceEndType} IS NULL
				AND ${table.recurrenceEndDate} IS NULL
				AND ${table.recurrenceOccurrenceCount} IS NULL
			) OR (
				${table.scope} = 'series'
				AND ${table.recurrenceFrequency} IS NOT NULL
				AND ${table.recurrenceInterval} BETWEEN 1 AND 99
				AND ${table.recurrenceEndType} IS NOT NULL
			)`,
		),
		check(
			"event_change_request_weekdays_consistency",
			sql`(
				${table.recurrenceFrequency} = 'week'
				AND ${table.recurrenceWeekdays} IS NOT NULL
				AND array_ndims(${table.recurrenceWeekdays}) = 1
				AND cardinality(${table.recurrenceWeekdays}) BETWEEN 1 AND 7
				AND array_position(${table.recurrenceWeekdays}, NULL) IS NULL
				AND ${table.recurrenceWeekdays} <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::integer[]
			) OR (
				${table.recurrenceFrequency} <> 'week'
				AND ${table.recurrenceWeekdays} IS NULL
			) OR ${table.recurrenceFrequency} IS NULL`,
		),
		check(
			"event_change_request_monthly_pattern_consistency",
			sql`(
				${table.recurrenceFrequency} = 'month'
				AND ${table.recurrenceMonthlyPattern} IS NOT NULL
			) OR (
				${table.recurrenceFrequency} <> 'month'
				AND ${table.recurrenceMonthlyPattern} IS NULL
			) OR ${table.recurrenceFrequency} IS NULL`,
		),
		check(
			"event_change_request_recurrence_end_consistency",
			sql`(
				${table.recurrenceEndType} = 'never'
				AND ${table.recurrenceEndDate} IS NULL
				AND ${table.recurrenceOccurrenceCount} IS NULL
			) OR (
				${table.recurrenceEndType} = 'on_date'
				AND ${table.recurrenceEndDate} IS NOT NULL
				AND ${table.recurrenceOccurrenceCount} IS NULL
			) OR (
				${table.recurrenceEndType} = 'after_occurrences'
				AND ${table.recurrenceEndDate} IS NULL
				AND ${table.recurrenceOccurrenceCount} BETWEEN 2 AND 1000
			) OR ${table.recurrenceEndType} IS NULL`,
		),
		uniqueIndex("event_change_request_pending_series_uidx")
			.on(table.eventId)
			.where(sql`${table.status} = 'pending' AND ${table.scope} = 'series'`),
		uniqueIndex("event_change_request_pending_occurrence_uidx")
			.on(table.eventId, table.occurrenceDate)
			.where(
				sql`${table.status} = 'pending' AND ${table.scope} = 'occurrence'`,
			),
		index("event_change_request_status_created_at_idx").on(
			table.status,
			table.createdAt,
		),
		index("event_change_request_event_id_idx").on(table.eventId),
	],
);

/** The approved replacement details for one generated recurrence date. */
export const eventOccurrenceOverride = pgTable(
	"event_occurrence_override",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => event.id, { onDelete: "cascade" }),
		occurrenceDate: date("occurrence_date", { mode: "string" }).notNull(),
		approvedChangeId: uuid("approved_change_id").references(
			() => eventChangeRequest.id,
			{ onDelete: "set null" },
		),
		version: integer("version").default(1).notNull(),
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
			.default(SACRAMENTO_TIME_ZONE)
			.notNull(),
		mode: eventMode("mode").notNull(),
		locationName: varchar("location_name", { length: 200 }),
		locationAddress: text("location_address"),
		eventUrl: text("event_url"),
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
			"event_occurrence_override_ends_after_start",
			sql`${table.endsAt} > ${table.startsAt}`,
		),
		uniqueIndex("event_occurrence_override_event_date_uidx").on(
			table.eventId,
			table.occurrenceDate,
		),
		index("event_occurrence_override_event_id_idx").on(table.eventId),
	],
);

export type EventRow = typeof event.$inferSelect;
export type EventRecurrenceRow = typeof eventRecurrence.$inferSelect;
export type EventOccurrenceCancellationRow =
	typeof eventOccurrenceCancellation.$inferSelect;
export type EventCollaboratorRow = typeof eventCollaborator.$inferSelect;
export type EventChangeRequestRow = typeof eventChangeRequest.$inferSelect;
export type EventOccurrenceOverrideRow =
	typeof eventOccurrenceOverride.$inferSelect;
export type EventMode = (typeof eventMode.enumValues)[number];
export type EventStatus = (typeof eventStatus.enumValues)[number];
export type EventChangeScope = (typeof eventChangeScope.enumValues)[number];
export type RecurrenceFrequency =
	(typeof recurrenceFrequency.enumValues)[number];
export type RecurrenceMonthlyPattern =
	(typeof recurrenceMonthlyPattern.enumValues)[number];
export type RecurrenceEndType = (typeof recurrenceEndType.enumValues)[number];
