import "server-only";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import {
	event,
	eventChangeRequest,
	eventCollaborator,
	eventOccurrenceCancellation,
	eventOccurrenceOverride,
	eventRecurrence,
} from "@/db/schema";
import type { Event as CalendarEvent } from "@/app/events/types";
import { mapApprovedEventsToCalendar } from "@/lib/events/mapper";

function groupCanceledOccurrences(
	rows: Array<{ eventId: string; occurrenceDate: string }>,
) {
	const datesByEvent = new Map<string, string[]>();

	for (const row of rows) {
		datesByEvent.set(row.eventId, [
			...(datesByEvent.get(row.eventId) ?? []),
			row.occurrenceDate,
		]);
	}

	return datesByEvent;
}

function groupByEventId<T extends { eventId: string }>(rows: T[]) {
	const rowsByEvent = new Map<string, T[]>();

	for (const row of rows) {
		rowsByEvent.set(row.eventId, [
			...(rowsByEvent.get(row.eventId) ?? []),
			row,
		]);
	}

	return rowsByEvent;
}

export async function getApprovedEvents(): Promise<CalendarEvent[]> {
	const [rows, cancellations, overrides] = await Promise.all([
		db
			.select({
				description: event.description,
				endsAt: event.endsAt,
				eventUrl: event.eventUrl,
				id: event.id,
				locationAddress: event.locationAddress,
				locationName: event.locationName,
				mode: event.mode,
				startsAt: event.startsAt,
				timezone: event.timezone,
				title: event.title,
				recurrenceFrequency: eventRecurrence.frequency,
				recurrenceInterval: eventRecurrence.interval,
				recurrenceWeekdays: eventRecurrence.weekdays,
				recurrenceMonthlyPattern: eventRecurrence.monthlyPattern,
				recurrenceEndType: eventRecurrence.endType,
				recurrenceEndDate: eventRecurrence.endDate,
				recurrenceCount: eventRecurrence.occurrenceCount,
			})
			.from(event)
			.leftJoin(eventRecurrence, eq(event.id, eventRecurrence.eventId))
			.where(and(eq(event.status, "approved"), isNull(event.canceledAt)))
			.orderBy(asc(event.startsAt)),
		db
			.select({
				eventId: eventOccurrenceCancellation.eventId,
				occurrenceDate: eventOccurrenceCancellation.occurrenceDate,
			})
			.from(eventOccurrenceCancellation)
			.innerJoin(event, eq(eventOccurrenceCancellation.eventId, event.id))
			.where(and(eq(event.status, "approved"), isNull(event.canceledAt)))
			.orderBy(asc(eventOccurrenceCancellation.occurrenceDate)),
		db
			.select({
				description: eventOccurrenceOverride.description,
				endsAt: eventOccurrenceOverride.endsAt,
				eventId: eventOccurrenceOverride.eventId,
				eventUrl: eventOccurrenceOverride.eventUrl,
				locationAddress: eventOccurrenceOverride.locationAddress,
				locationName: eventOccurrenceOverride.locationName,
				mode: eventOccurrenceOverride.mode,
				occurrenceDate: eventOccurrenceOverride.occurrenceDate,
				startsAt: eventOccurrenceOverride.startsAt,
				timezone: eventOccurrenceOverride.timezone,
				title: eventOccurrenceOverride.title,
			})
			.from(eventOccurrenceOverride)
			.innerJoin(event, eq(eventOccurrenceOverride.eventId, event.id))
			.where(and(eq(event.status, "approved"), isNull(event.canceledAt)))
			.orderBy(asc(eventOccurrenceOverride.startsAt)),
	]);
	const cancellationsByEvent = groupCanceledOccurrences(cancellations);
	const overridesByEvent = groupByEventId(overrides);

	return mapApprovedEventsToCalendar(
		rows.map((row) => ({
			...row,
			canceledOccurrenceDates: cancellationsByEvent.get(row.id) ?? [],
			occurrenceOverrides: overridesByEvent.get(row.id) ?? [],
		})),
	);
}

export async function getSubmissionsForUser(userId: string) {
	const collaboratorJoin = and(
		eq(eventCollaborator.eventId, event.id),
		eq(eventCollaborator.userId, userId),
	);
	const hasAccess = or(
		eq(event.submittedBy, userId),
		eq(eventCollaborator.userId, userId),
	);
	const [rows, cancellations, changeRequests, collaborators, overrides] =
		await Promise.all([
			db
				.select({
					canceledAt: event.canceledAt,
					createdAt: event.createdAt,
					endsAt: event.endsAt,
					id: event.id,
					moderationNote: event.moderationNote,
					startsAt: event.startsAt,
					status: event.status,
					submittedBy: event.submittedBy,
					title: event.title,
					recurrenceFrequency: eventRecurrence.frequency,
					recurrenceInterval: eventRecurrence.interval,
					recurrenceWeekdays: eventRecurrence.weekdays,
					recurrenceMonthlyPattern: eventRecurrence.monthlyPattern,
					recurrenceEndType: eventRecurrence.endType,
					recurrenceEndDate: eventRecurrence.endDate,
					recurrenceCount: eventRecurrence.occurrenceCount,
				})
				.from(event)
				.leftJoin(eventCollaborator, collaboratorJoin)
				.leftJoin(eventRecurrence, eq(event.id, eventRecurrence.eventId))
				.where(hasAccess)
				.orderBy(desc(event.createdAt)),
			db
				.select({
					eventId: eventOccurrenceCancellation.eventId,
					occurrenceDate: eventOccurrenceCancellation.occurrenceDate,
				})
				.from(eventOccurrenceCancellation)
				.innerJoin(event, eq(eventOccurrenceCancellation.eventId, event.id))
				.leftJoin(eventCollaborator, collaboratorJoin)
				.where(hasAccess)
				.orderBy(asc(eventOccurrenceCancellation.occurrenceDate)),
			db
				.select({
					createdAt: eventChangeRequest.createdAt,
					eventId: eventChangeRequest.eventId,
					id: eventChangeRequest.id,
					moderationNote: eventChangeRequest.moderationNote,
					occurrenceDate: eventChangeRequest.occurrenceDate,
					scope: eventChangeRequest.scope,
					status: eventChangeRequest.status,
				})
				.from(eventChangeRequest)
				.innerJoin(event, eq(eventChangeRequest.eventId, event.id))
				.leftJoin(eventCollaborator, collaboratorJoin)
				.where(
					and(
						hasAccess,
						or(
							eq(eventChangeRequest.status, "pending"),
							eq(eventChangeRequest.status, "rejected"),
						),
					),
				)
				.orderBy(desc(eventChangeRequest.createdAt)),
			db
				.select({
					email: user.email,
					eventId: eventCollaborator.eventId,
					name: user.name,
					userId: eventCollaborator.userId,
				})
				.from(eventCollaborator)
				.innerJoin(event, eq(eventCollaborator.eventId, event.id))
				.innerJoin(user, eq(eventCollaborator.userId, user.id))
				.where(eq(event.submittedBy, userId))
				.orderBy(asc(user.name), asc(user.email)),
			db
				.select({
					eventId: eventOccurrenceOverride.eventId,
					occurrenceDate: eventOccurrenceOverride.occurrenceDate,
					startsAt: eventOccurrenceOverride.startsAt,
				})
				.from(eventOccurrenceOverride)
				.innerJoin(event, eq(eventOccurrenceOverride.eventId, event.id))
				.leftJoin(eventCollaborator, collaboratorJoin)
				.where(hasAccess)
				.orderBy(asc(eventOccurrenceOverride.startsAt)),
		]);
	const cancellationsByEvent = groupCanceledOccurrences(cancellations);
	const changesByEvent = groupByEventId(changeRequests);
	const collaboratorsByEvent = groupByEventId(collaborators);
	const overridesByEvent = groupByEventId(overrides);

	return rows.map((row) => ({
		...row,
		canceledOccurrences: cancellationsByEvent.get(row.id) ?? [],
		changeRequests: changesByEvent.get(row.id) ?? [],
		collaborators: collaboratorsByEvent.get(row.id) ?? [],
		isOwner: row.submittedBy === userId,
		occurrenceOverrides: overridesByEvent.get(row.id) ?? [],
	}));
}

export async function getPendingEvents() {
	const [rows, cancellations] = await Promise.all([
		db
			.select({
				createdAt: event.createdAt,
				description: event.description,
				endsAt: event.endsAt,
				eventUrl: event.eventUrl,
				id: event.id,
				locationAddress: event.locationAddress,
				locationName: event.locationName,
				mode: event.mode,
				startsAt: event.startsAt,
				submitterEmail: user.email,
				submitterName: user.name,
				timezone: event.timezone,
				title: event.title,
				recurrenceFrequency: eventRecurrence.frequency,
				recurrenceInterval: eventRecurrence.interval,
				recurrenceWeekdays: eventRecurrence.weekdays,
				recurrenceMonthlyPattern: eventRecurrence.monthlyPattern,
				recurrenceEndType: eventRecurrence.endType,
				recurrenceEndDate: eventRecurrence.endDate,
				recurrenceCount: eventRecurrence.occurrenceCount,
			})
			.from(event)
			.leftJoin(user, eq(event.submittedBy, user.id))
			.leftJoin(eventRecurrence, eq(event.id, eventRecurrence.eventId))
			.where(and(eq(event.status, "pending"), isNull(event.canceledAt)))
			.orderBy(asc(event.createdAt)),
		db
			.select({
				eventId: eventOccurrenceCancellation.eventId,
				occurrenceDate: eventOccurrenceCancellation.occurrenceDate,
			})
			.from(eventOccurrenceCancellation)
			.innerJoin(event, eq(eventOccurrenceCancellation.eventId, event.id))
			.where(and(eq(event.status, "pending"), isNull(event.canceledAt)))
			.orderBy(asc(eventOccurrenceCancellation.occurrenceDate)),
	]);
	const cancellationsByEvent = groupCanceledOccurrences(cancellations);

	return rows.map((row) => ({
		...row,
		canceledOccurrences: cancellationsByEvent.get(row.id) ?? [],
	}));
}

export async function getPendingEventEdits() {
	return db
		.select({
			createdAt: eventChangeRequest.createdAt,
			currentDescription: sql<string>`coalesce(${eventOccurrenceOverride.description}, ${event.description})`,
			currentEndsAt: sql<Date>`coalesce(${eventOccurrenceOverride.endsAt}, ${event.endsAt})`,
			currentEventUrl: sql<
				string | null
			>`case when ${eventOccurrenceOverride.id} is not null then ${eventOccurrenceOverride.eventUrl} else ${event.eventUrl} end`,
			currentLocationAddress: sql<
				string | null
			>`case when ${eventOccurrenceOverride.id} is not null then ${eventOccurrenceOverride.locationAddress} else ${event.locationAddress} end`,
			currentLocationName: sql<
				string | null
			>`case when ${eventOccurrenceOverride.id} is not null then ${eventOccurrenceOverride.locationName} else ${event.locationName} end`,
			currentMode: sql<
				"hybrid" | "in_person" | "online"
			>`coalesce(${eventOccurrenceOverride.mode}, ${event.mode})`,
			currentRecurrenceCount: eventRecurrence.occurrenceCount,
			currentRecurrenceEndDate: eventRecurrence.endDate,
			currentRecurrenceEndType: eventRecurrence.endType,
			currentRecurrenceFrequency: eventRecurrence.frequency,
			currentRecurrenceInterval: eventRecurrence.interval,
			currentRecurrenceMonthlyPattern: eventRecurrence.monthlyPattern,
			currentRecurrenceWeekdays: eventRecurrence.weekdays,
			currentStartsAt: sql<Date>`coalesce(${eventOccurrenceOverride.startsAt}, ${event.startsAt})`,
			currentTitle: sql<string>`coalesce(${eventOccurrenceOverride.title}, ${event.title})`,
			hasCurrentOccurrenceOverride: sql<boolean>`${eventOccurrenceOverride.id} is not null`,
			seriesEndsAt: event.endsAt,
			seriesStartsAt: event.startsAt,
			description: eventChangeRequest.description,
			endsAt: eventChangeRequest.endsAt,
			eventId: eventChangeRequest.eventId,
			eventUrl: eventChangeRequest.eventUrl,
			id: eventChangeRequest.id,
			locationAddress: eventChangeRequest.locationAddress,
			locationName: eventChangeRequest.locationName,
			mode: eventChangeRequest.mode,
			occurrenceDate: eventChangeRequest.occurrenceDate,
			proposerEmail: user.email,
			proposerName: user.name,
			recurrenceCount: eventChangeRequest.recurrenceOccurrenceCount,
			recurrenceEndDate: eventChangeRequest.recurrenceEndDate,
			recurrenceEndType: eventChangeRequest.recurrenceEndType,
			recurrenceFrequency: eventChangeRequest.recurrenceFrequency,
			recurrenceInterval: eventChangeRequest.recurrenceInterval,
			recurrenceMonthlyPattern: eventChangeRequest.recurrenceMonthlyPattern,
			recurrenceWeekdays: eventChangeRequest.recurrenceWeekdays,
			scope: eventChangeRequest.scope,
			startsAt: eventChangeRequest.startsAt,
			timezone: eventChangeRequest.timezone,
			title: eventChangeRequest.title,
		})
		.from(eventChangeRequest)
		.innerJoin(event, eq(eventChangeRequest.eventId, event.id))
		.leftJoin(user, eq(eventChangeRequest.proposedBy, user.id))
		.leftJoin(
			eventOccurrenceOverride,
			and(
				eq(eventOccurrenceOverride.eventId, event.id),
				eq(
					eventOccurrenceOverride.occurrenceDate,
					eventChangeRequest.occurrenceDate,
				),
			),
		)
		.leftJoin(eventRecurrence, eq(event.id, eventRecurrence.eventId))
		.where(
			and(
				eq(eventChangeRequest.status, "pending"),
				eq(event.status, "approved"),
				isNull(event.canceledAt),
			),
		)
		.orderBy(asc(eventChangeRequest.createdAt), asc(eventChangeRequest.id));
}

export async function getManagedEventForEdit(
	eventId: string,
	userId: string,
	occurrenceDate: string | null = null,
) {
	const collaboratorJoin = and(
		eq(eventCollaborator.eventId, event.id),
		eq(eventCollaborator.userId, userId),
	);
	const [row] = await db
		.select({
			canceledAt: event.canceledAt,
			description: event.description,
			endsAt: event.endsAt,
			eventUrl: event.eventUrl,
			id: event.id,
			locationAddress: event.locationAddress,
			locationName: event.locationName,
			mode: event.mode,
			recurrenceCount: eventRecurrence.occurrenceCount,
			recurrenceEndDate: eventRecurrence.endDate,
			recurrenceEndType: eventRecurrence.endType,
			recurrenceFrequency: eventRecurrence.frequency,
			recurrenceInterval: eventRecurrence.interval,
			recurrenceMonthlyPattern: eventRecurrence.monthlyPattern,
			recurrenceWeekdays: eventRecurrence.weekdays,
			startsAt: event.startsAt,
			status: event.status,
			submittedBy: event.submittedBy,
			timezone: event.timezone,
			title: event.title,
		})
		.from(event)
		.leftJoin(eventCollaborator, collaboratorJoin)
		.leftJoin(eventRecurrence, eq(event.id, eventRecurrence.eventId))
		.where(
			and(
				eq(event.id, eventId),
				or(eq(event.submittedBy, userId), eq(eventCollaborator.userId, userId)),
			),
		)
		.limit(1);

	if (!row) {
		return null;
	}

	const [occurrenceOverride, collaborators, changeRequests, cancellations] =
		await Promise.all([
			occurrenceDate
				? db
						.select({
							description: eventOccurrenceOverride.description,
							endsAt: eventOccurrenceOverride.endsAt,
							eventUrl: eventOccurrenceOverride.eventUrl,
							locationAddress: eventOccurrenceOverride.locationAddress,
							locationName: eventOccurrenceOverride.locationName,
							mode: eventOccurrenceOverride.mode,
							occurrenceDate: eventOccurrenceOverride.occurrenceDate,
							startsAt: eventOccurrenceOverride.startsAt,
							timezone: eventOccurrenceOverride.timezone,
							title: eventOccurrenceOverride.title,
						})
						.from(eventOccurrenceOverride)
						.where(
							and(
								eq(eventOccurrenceOverride.eventId, eventId),
								eq(eventOccurrenceOverride.occurrenceDate, occurrenceDate),
							),
						)
						.limit(1)
						.then((rows) => rows[0] ?? null)
				: Promise.resolve(null),
			row.submittedBy === userId
				? db
						.select({
							email: user.email,
							name: user.name,
							userId: user.id,
						})
						.from(eventCollaborator)
						.innerJoin(user, eq(eventCollaborator.userId, user.id))
						.where(eq(eventCollaborator.eventId, eventId))
						.orderBy(asc(user.name), asc(user.email))
				: Promise.resolve([]),
			db
				.select({
					createdAt: eventChangeRequest.createdAt,
					moderationNote: eventChangeRequest.moderationNote,
					occurrenceDate: eventChangeRequest.occurrenceDate,
					scope: eventChangeRequest.scope,
					status: eventChangeRequest.status,
				})
				.from(eventChangeRequest)
				.where(
					and(
						eq(eventChangeRequest.eventId, eventId),
						or(
							eq(eventChangeRequest.status, "pending"),
							eq(eventChangeRequest.status, "rejected"),
						),
					),
				)
				.orderBy(desc(eventChangeRequest.createdAt)),
			db
				.select({ occurrenceDate: eventOccurrenceCancellation.occurrenceDate })
				.from(eventOccurrenceCancellation)
				.where(eq(eventOccurrenceCancellation.eventId, eventId)),
		]);

	return {
		...row,
		canceledOccurrences: cancellations.map(
			(cancellation) => cancellation.occurrenceDate,
		),
		changeRequests,
		collaborators,
		isOwner: row.submittedBy === userId,
		occurrenceOverride,
	};
}
