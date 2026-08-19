import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import {
	event,
	eventOccurrenceCancellation,
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

export async function getApprovedEvents(): Promise<CalendarEvent[]> {
	const [rows, cancellations] = await Promise.all([
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
	]);
	const cancellationsByEvent = groupCanceledOccurrences(cancellations);

	return mapApprovedEventsToCalendar(
		rows.map((row) => ({
			...row,
			canceledOccurrenceDates: cancellationsByEvent.get(row.id) ?? [],
		})),
	);
}

export async function getSubmissionsForUser(userId: string) {
	const [rows, cancellations] = await Promise.all([
		db
			.select({
				canceledAt: event.canceledAt,
				createdAt: event.createdAt,
				endsAt: event.endsAt,
				id: event.id,
				moderationNote: event.moderationNote,
				startsAt: event.startsAt,
				status: event.status,
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
			.where(eq(event.submittedBy, userId))
			.orderBy(desc(event.createdAt)),
		db
			.select({
				eventId: eventOccurrenceCancellation.eventId,
				occurrenceDate: eventOccurrenceCancellation.occurrenceDate,
			})
			.from(eventOccurrenceCancellation)
			.innerJoin(event, eq(eventOccurrenceCancellation.eventId, event.id))
			.where(eq(event.submittedBy, userId))
			.orderBy(asc(eventOccurrenceCancellation.occurrenceDate)),
	]);
	const cancellationsByEvent = groupCanceledOccurrences(cancellations);

	return rows.map((row) => ({
		...row,
		canceledOccurrences: cancellationsByEvent.get(row.id) ?? [],
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
