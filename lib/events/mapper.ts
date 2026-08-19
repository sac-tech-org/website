import type {
	Event as CalendarEvent,
	RecurrenceRule,
} from "@/app/events/types";
import type { EventMode } from "@/db/schema";

export interface ApprovedEventRecord {
	canceledOccurrenceDates: string[];
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
	recurrenceFrequency: RecurrenceRule["frequency"] | null;
	recurrenceInterval: number | null;
	recurrenceWeekdays: number[] | null;
	recurrenceMonthlyPattern: RecurrenceRule["monthlyPattern"];
	recurrenceEndType: RecurrenceRule["endType"] | null;
	recurrenceEndDate: string | null;
	recurrenceCount: number | null;
}

export function mapApprovedEventsToCalendar(
	rows: ApprovedEventRecord[],
): CalendarEvent[] {
	return rows.map((row) => {
		const locationDescription =
			row.mode === "online" ? "Online" : (row.locationName ?? "Sacramento");
		const recurrenceRule: RecurrenceRule | null =
			row.recurrenceFrequency &&
			row.recurrenceInterval &&
			row.recurrenceEndType
				? {
						endDate: row.recurrenceEndDate,
						endType: row.recurrenceEndType,
						excludedDates: row.canceledOccurrenceDates,
						frequency: row.recurrenceFrequency,
						interval: row.recurrenceInterval,
						monthlyPattern: row.recurrenceMonthlyPattern,
						occurrenceCount: row.recurrenceCount,
						weekdays: row.recurrenceWeekdays,
					}
				: null;

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
			is_recurring: recurrenceRule !== null,
			location_address: row.locationAddress ?? undefined,
			location_description: locationDescription,
			location_url: row.eventUrl ?? undefined,
			organizers: [],
			recurrence_rule: recurrenceRule,
			slug: row.id,
			title: row.title,
		};
	});
}
