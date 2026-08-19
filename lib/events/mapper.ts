import type { Event as CalendarEvent } from "@/app/events/types";
import type { EventMode } from "@/db/schema";

export interface ApprovedEventRecord {
	description: string;
	endsAt: Date;
	eventUrl: string | null;
	id: string;
	locationAddress: string | null;
	locationName: string | null;
	mode: EventMode;
	startsAt: Date;
	timezone: string;
	title: string;
}

export function mapApprovedEventsToCalendar(
	rows: ApprovedEventRecord[],
): CalendarEvent[] {
	return rows.map((row) => {
		const locationDescription =
			row.mode === "online" ? "Online" : (row.locationName ?? "Sacramento");

		return {
			blocks: [
				{
					description: row.description,
					ends_at: row.endsAt,
					location_address: row.locationAddress ?? undefined,
					location_description: locationDescription,
					location_url: row.eventUrl ?? undefined,
					presenters: [],
					slug: `${row.id}-occurrence`,
					starts_at: row.startsAt,
					timezone: row.timezone,
					title: row.title,
				},
			],
			description: row.description,
			has_event_page: Boolean(row.eventUrl),
			in_person: row.mode !== "online",
			is_online: row.mode !== "in_person",
			is_recurring: false,
			location_address: row.locationAddress ?? undefined,
			location_description: locationDescription,
			location_url: row.eventUrl ?? undefined,
			organizers: [],
			slug: row.id,
			title: row.title,
		};
	});
}
