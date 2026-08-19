import { describe, expect, it } from "vitest";
import {
	mapApprovedEventsToCalendar,
	type ApprovedEventRecord,
} from "@/lib/events/mapper";

const baseEvent: ApprovedEventRecord = {
	description: "A community event.",
	endsAt: new Date("2026-09-02T03:00:00.000Z"),
	eventUrl: "https://example.com/event",
	id: "25c46a15-483e-46b8-8fc2-50ead29510dc",
	locationAddress: "100 Capitol Mall",
	locationName: "Community Hall",
	mode: "in_person",
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
			frequency: "week",
			interval: 2,
			monthlyPattern: null,
			occurrenceCount: 8,
			weekdays: [2, 4],
		});
	});
});
