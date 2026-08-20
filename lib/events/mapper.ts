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
	occurrenceOverrides: Array<{
		description: string;
		endsAt: Date;
		eventUrl: string | null;
		locationAddress: string | null;
		locationName: string | null;
		mode: EventMode;
		occurrenceDate: string;
		startsAt: Date;
		timezone: string;
		title: string;
	}>;
}

function getLocationDescription(mode: EventMode, locationName: string | null) {
	return mode === "online" ? "Online" : (locationName ?? "Sacramento");
}

function getAttendance(mode: EventMode) {
	return {
		inPerson: mode !== "online",
		isOnline: mode !== "in_person",
	};
}

export function mapApprovedEventsToCalendar(
	rows: ApprovedEventRecord[],
): CalendarEvent[] {
	return rows.map((row) => {
		const locationDescription = getLocationDescription(
			row.mode,
			row.locationName,
		);
		const attendance = getAttendance(row.mode);
		const canceledOccurrenceDates = new Set(row.canceledOccurrenceDates);
		const occurrenceOverrides = row.occurrenceOverrides.filter(
			(override) => !canceledOccurrenceDates.has(override.occurrenceDate),
		);
		const hasInPersonOccurrence = occurrenceOverrides.some(
			(override) => override.mode !== "online",
		);
		const hasOnlineOccurrence = occurrenceOverrides.some(
			(override) => override.mode !== "in_person",
		);
		const recurrenceRule: RecurrenceRule | null =
			row.recurrenceFrequency && row.recurrenceInterval && row.recurrenceEndType
				? {
						endDate: row.recurrenceEndDate,
						endType: row.recurrenceEndType,
						excludedDates: [
							...new Set([
								...row.canceledOccurrenceDates,
								...occurrenceOverrides.map(
									(override) => override.occurrenceDate,
								),
							]),
						],
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
					in_person: attendance.inPerson,
					is_online: attendance.isOnline,
					location_address: row.locationAddress ?? undefined,
					location_description: locationDescription,
					location_url: row.eventUrl ?? undefined,
					presenters: [],
					slug: `${row.id}-occurrence`,
					starts_at: row.startsAt,
					timezone: row.timezone,
					title: row.title,
				},
				...occurrenceOverrides.map((override) => {
					const overrideAttendance = getAttendance(override.mode);

					return {
						description: override.description,
						ends_at: override.endsAt,
						in_person: overrideAttendance.inPerson,
						is_online: overrideAttendance.isOnline,
						location_address: override.locationAddress ?? undefined,
						location_description: getLocationDescription(
							override.mode,
							override.locationName,
						),
						location_url: override.eventUrl ?? undefined,
						presenters: [],
						recurrence_date: override.occurrenceDate,
						slug: `${row.id}-occurrence-${override.occurrenceDate}`,
						starts_at: override.startsAt,
						timezone: override.timezone,
						title: override.title,
					};
				}),
			],
			description: row.description,
			has_event_page: Boolean(
				row.eventUrl ||
				occurrenceOverrides.some((override) => override.eventUrl),
			),
			in_person: attendance.inPerson || hasInPersonOccurrence,
			is_online: attendance.isOnline || hasOnlineOccurrence,
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
