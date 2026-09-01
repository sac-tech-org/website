import type { Event, EventBlock, RecurrenceRule } from "@/app/events/types";
import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";

export const EVENT_STORY_REFERENCE_DATE = "2026-09-01";

export function createEventBlock(
	overrides: Partial<EventBlock> = {},
): EventBlock {
	return {
		description: "A welcoming Sacramento technology gathering.",
		ends_at: new Date("2026-09-05T21:00:00.000Z"),
		in_person: true,
		is_online: false,
		location_address: "123 J Street, Sacramento, CA",
		location_description: "The Urban Hive",
		location_url: "https://events.example.com/details",
		presenters: [],
		slug: "event-occurrence",
		starts_at: new Date("2026-09-05T19:00:00.000Z"),
		timezone: SACRAMENTO_TIME_ZONE,
		title: "Event occurrence",
		...overrides,
	};
}

export function createWeeklyRecurrenceRule(
	overrides: Partial<RecurrenceRule> = {},
): RecurrenceRule {
	return {
		endDate: null,
		endType: "after_occurrences",
		excludedDates: ["2026-09-09"],
		frequency: "week",
		interval: 1,
		monthlyPattern: null,
		occurrenceCount: 8,
		weekdays: [3],
		...overrides,
	};
}

export function createRecurringEvent(overrides: Partial<Event> = {}): Event {
	const description =
		overrides.description ??
		"Practice TypeScript with welcoming Sacramento developers.";
	const title = overrides.title ?? "Sacramento TypeScript Weekly";
	const blocks = overrides.blocks ?? [
		createEventBlock({
			description,
			ends_at: new Date("2026-09-02T18:00:00.000Z"),
			in_person: false,
			is_online: true,
			location_address: undefined,
			location_description: "Online",
			slug: "typescript-weekly-seed",
			starts_at: new Date("2026-09-02T17:00:00.000Z"),
			title,
		}),
	];

	return {
		description,
		has_event_page: true,
		in_person: false,
		is_online: true,
		is_recurring: true,
		location_address: undefined,
		location_description: "Online",
		location_url: "https://events.example.com/typescript-weekly",
		organizers: [],
		recurrence_rule: createWeeklyRecurrenceRule(),
		slug: "sacramento-typescript-weekly",
		title,
		...overrides,
		blocks,
	};
}

export function createRecurringEventWithOverride(
	overrides: Partial<Event> = {},
): Event {
	const event = createRecurringEvent();

	return createRecurringEvent({
		...event,
		blocks: [
			...event.blocks,
			createEventBlock({
				description: "Bring a laptop for a special hands-on TypeScript night.",
				ends_at: new Date("2026-09-16T03:00:00.000Z"),
				in_person: true,
				is_online: false,
				location_address: "123 J Street, Sacramento, CA",
				location_description: "The Urban Hive",
				location_url: "https://events.example.com/hands-on-night",
				recurrence_date: "2026-09-16",
				slug: "typescript-weekly-2026-09-16-override",
				starts_at: new Date("2026-09-16T01:30:00.000Z"),
				title: "TypeScript Hands-on Night",
			}),
		],
		recurrence_rule: createWeeklyRecurrenceRule({
			excludedDates: ["2026-09-09", "2026-09-16"],
		}),
		...overrides,
	});
}

export function createSpecialEvent(overrides: Partial<Event> = {}): Event {
	const description =
		overrides.description ?? "A one-day design community event.";
	const title = overrides.title ?? "Sacramento Design Summit";
	const blocks = overrides.blocks ?? [
		createEventBlock({
			description,
			location_description: "The Urban Hive",
			location_url: "https://events.example.com/design-summit",
			slug: "design-summit-occurrence",
			title,
		}),
	];

	return {
		description,
		has_event_page: true,
		in_person: true,
		is_online: false,
		is_recurring: false,
		location_address: "123 J Street, Sacramento, CA",
		location_description: "The Urban Hive",
		location_url: "https://events.example.com/design-summit",
		organizers: [],
		recurrence_rule: null,
		slug: "sacramento-design-summit",
		title,
		...overrides,
		blocks,
	};
}

export function createLongEventDescription(finalSentence: string) {
	return `${"Sacramento community members share practical ideas and make room for generous conversation. ".repeat(5)}${finalSentence}`;
}

export const MIXED_EVENTS: Event[] = [
	createRecurringEventWithOverride(),
	createSpecialEvent(),
];
