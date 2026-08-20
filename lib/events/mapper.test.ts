import { describe, expect, it } from "vitest";
import {
	mapApprovedEventsToCalendar,
	type ApprovedEventRecord,
} from "@/lib/events/mapper";

const baseEvent: ApprovedEventRecord = {
	canceledOccurrenceDates: [],
	description: "A community event.",
	endsAt: new Date("2026-09-02T03:00:00.000Z"),
	eventUrl: "https://example.com/event",
	id: "25c46a15-483e-46b8-8fc2-50ead29510dc",
	locationAddress: "100 Capitol Mall",
	locationName: "Community Hall",
	mode: "in_person",
	occurrenceOverrides: [],
	startsAt: new Date("2026-09-02T01:00:00.000Z"),
	timezone: "America/Los_Angeles",
	title: "Sacramento Meetup",
	recurrenceCount: null,
	recurrenceEndDate: null,
	recurrenceEndType: null,
	recurrenceFrequency: null,
	recurrenceInterval: null,
	recurrenceMonthlyPattern: null,
	recurrenceWeekdays: null,
};

describe("mapApprovedEventsToCalendar", () => {
	it.each([
		["online", false, true],
		["in_person", true, false],
		["hybrid", true, true],
	] as const)("maps %s attendance", (mode, inPerson, isOnline) => {
		const [event] = mapApprovedEventsToCalendar([{ ...baseEvent, mode }]);

		expect(event.in_person).toBe(inPerson);
		expect(event.is_online).toBe(isOnline);
		expect(event.blocks).toHaveLength(1);
		expect(event.blocks[0].starts_at).toEqual(baseEvent.startsAt);
	});

	it("exposes no submitter or moderation fields", () => {
		const [event] = mapApprovedEventsToCalendar([baseEvent]);

		expect(event).not.toHaveProperty("submittedBy");
		expect(event).not.toHaveProperty("moderationNote");
		expect(event.blocks[0].location_url).toBe(baseEvent.eventUrl);
	});

	it("maps a public recurrence rule without moderation data", () => {
		const [event] = mapApprovedEventsToCalendar([
			{
				...baseEvent,
				recurrenceCount: 8,
				recurrenceEndType: "after_occurrences",
				recurrenceFrequency: "week",
				recurrenceInterval: 2,
				recurrenceWeekdays: [2, 4],
			},
		]);

		expect(event.is_recurring).toBe(true);
		expect(event.recurrence_rule).toEqual({
			endDate: null,
			endType: "after_occurrences",
			excludedDates: [],
			frequency: "week",
			interval: 2,
			monthlyPattern: null,
			occurrenceCount: 8,
			weekdays: [2, 4],
		});
	});

	it("maps one-off cancellation dates as recurrence exclusions", () => {
		const [event] = mapApprovedEventsToCalendar([
			{
				...baseEvent,
				canceledOccurrenceDates: ["2026-09-16", "2026-09-30"],
				recurrenceEndType: "never",
				recurrenceFrequency: "week",
				recurrenceInterval: 1,
				recurrenceWeekdays: [2],
			},
		]);

		expect(event.recurrence_rule?.excludedDates).toEqual([
			"2026-09-16",
			"2026-09-30",
		]);
	});

	it("maps an occurrence override and suppresses its original series slot", () => {
		const startsAt = new Date("2026-09-18T01:30:00.000Z");
		const endsAt = new Date("2026-09-18T03:00:00.000Z");
		const [event] = mapApprovedEventsToCalendar([
			{
				...baseEvent,
				occurrenceOverrides: [
					{
						description: "A special hands-on edition of the meetup.",
						endsAt,
						eventUrl: "https://example.com/event/special-edition",
						locationAddress: "123 J Street",
						locationName: "The Urban Hive",
						mode: "hybrid",
						occurrenceDate: "2026-09-16",
						startsAt,
						timezone: "America/Los_Angeles",
						title: "Sacramento Meetup: Hands-on Night",
					},
				],
				recurrenceEndType: "never",
				recurrenceFrequency: "week",
				recurrenceInterval: 1,
				recurrenceWeekdays: [3],
			},
		]);

		expect(event.recurrence_rule?.excludedDates).toEqual(["2026-09-16"]);
		expect(event.blocks).toHaveLength(2);
		expect(event.blocks[1]).toMatchObject({
			description: "A special hands-on edition of the meetup.",
			ends_at: endsAt,
			in_person: true,
			is_online: true,
			location_address: "123 J Street",
			location_description: "The Urban Hive",
			location_url: "https://example.com/event/special-edition",
			recurrence_date: "2026-09-16",
			starts_at: startsAt,
			title: "Sacramento Meetup: Hands-on Night",
		});
	});

	it("does not publish an override for a canceled occurrence", () => {
		const [event] = mapApprovedEventsToCalendar([
			{
				...baseEvent,
				canceledOccurrenceDates: ["2026-09-16"],
				eventUrl: null,
				occurrenceOverrides: [
					{
						description: "This canceled edit must not be public.",
						endsAt: new Date("2026-09-16T20:00:00.000Z"),
						eventUrl: "https://example.com/canceled-override",
						locationAddress: null,
						locationName: null,
						mode: "online",
						occurrenceDate: "2026-09-16",
						startsAt: new Date("2026-09-16T19:00:00.000Z"),
						timezone: "America/Los_Angeles",
						title: "Canceled override",
					},
				],
				recurrenceEndType: "never",
				recurrenceFrequency: "week",
				recurrenceInterval: 1,
				recurrenceWeekdays: [3],
			},
		]);

		expect(event.blocks).toHaveLength(1);
		expect(event.recurrence_rule?.excludedDates).toEqual(["2026-09-16"]);
		expect(event.has_event_page).toBe(false);
	});
});
