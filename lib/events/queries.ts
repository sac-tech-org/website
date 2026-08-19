import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { event } from "@/db/schema";
import type { Event as CalendarEvent } from "@/app/events/types";
import { mapApprovedEventsToCalendar } from "@/lib/events/mapper";

export async function getApprovedEvents(): Promise<CalendarEvent[]> {
	const rows = await db
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
		})
		.from(event)
		.where(eq(event.status, "approved"))
		.orderBy(asc(event.startsAt));

	return mapApprovedEventsToCalendar(rows);
}

export async function getSubmissionsForUser(userId: string) {
	return db
		.select({
			createdAt: event.createdAt,
			endsAt: event.endsAt,
			id: event.id,
			moderationNote: event.moderationNote,
			startsAt: event.startsAt,
			status: event.status,
			title: event.title,
		})
		.from(event)
		.where(eq(event.submittedBy, userId))
		.orderBy(desc(event.createdAt));
}

export async function getPendingEvents() {
	return db
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
		})
		.from(event)
		.leftJoin(user, eq(event.submittedBy, user.id))
		.where(eq(event.status, "pending"))
		.orderBy(asc(event.createdAt));
}
