import { describe, expect, it } from "vitest";
import type { RecurrenceRule } from "@/app/events/types";
import {
	getNextOccurrence,
	getOccurrenceEnd,
	getOccurrencesInRange,
} from "@/lib/events/recurrence";

function recurrenceRule(
	overrides: Partial<RecurrenceRule> = {},
): RecurrenceRule {
	return {
		endDate: null,
		endType: "never",
		frequency: "day",
		interval: 1,
		monthlyPattern: null,
		occurrenceCount: null,
		weekdays: null,
		...overrides,
	};
}

function isoDates(dates: Date[]) {
	return dates.map((date) => date.toISOString());
}

describe("getOccurrencesInRange", () => {
	it("preserves a daily wall-clock start across the PST to PDT change", () => {
		const occurrences = getOccurrencesInRange(
			new Date("2026-03-07T18:00:00.000Z"),
			recurrenceRule(),
			"2026-03-07",
			"2026-03-10",
		);

		expect(isoDates(occurrences)).toEqual([
			"2026-03-07T18:00:00.000Z",
			"2026-03-08T17:00:00.000Z",
			"2026-03-09T17:00:00.000Z",
			"2026-03-10T17:00:00.000Z",
		]);
	});

	it("skips a spring-forward wall time that does not exist", () => {
		const occurrences = getOccurrencesInRange(
			new Date("2026-03-07T10:30:00.000Z"),
			recurrenceRule(),
			"2026-03-07",
			"2026-03-10",
		);

		expect(isoDates(occurrences)).toEqual([
			"2026-03-07T10:30:00.000Z",
			"2026-03-09T09:30:00.000Z",
			"2026-03-10T09:30:00.000Z",
		]);
	});

	it("uses the earlier repeated wall time when PDT falls back to PST", () => {
		const occurrences = getOccurrencesInRange(
			new Date("2026-10-31T08:30:00.000Z"),
			recurrenceRule(),
			"2026-10-31",
			"2026-11-02",
		);

		expect(isoDates(occurrences)).toEqual([
			"2026-10-31T08:30:00.000Z",
			"2026-11-01T08:30:00.000Z",
			"2026-11-02T09:30:00.000Z",
		]);
	});

	it("includes DTSTART's weekday and supports multiple days in interval weeks", () => {
		const occurrences = getOccurrencesInRange(
			new Date("2026-01-07T18:00:00.000Z"),
			recurrenceRule({
				frequency: "week",
				interval: 2,
				weekdays: [1, 5],
			}),
			"2026-01-01",
			"2026-01-31",
		);

		expect(isoDates(occurrences)).toEqual([
			"2026-01-07T18:00:00.000Z",
			"2026-01-09T18:00:00.000Z",
			"2026-01-19T18:00:00.000Z",
			"2026-01-21T18:00:00.000Z",
			"2026-01-23T18:00:00.000Z",
		]);
	});

	it("treats an on-date end as inclusive", () => {
		const occurrences = getOccurrencesInRange(
			new Date("2026-01-01T18:00:00.000Z"),
			recurrenceRule({ endDate: "2026-01-03", endType: "on_date" }),
			"2026-01-01",
			"2026-01-10",
		);

		expect(isoDates(occurrences)).toEqual([
			"2026-01-01T18:00:00.000Z",
			"2026-01-02T18:00:00.000Z",
			"2026-01-03T18:00:00.000Z",
		]);
	});

	it("counts DTSTART as occurrence one for an after-count end", () => {
		const occurrences = getOccurrencesInRange(
			new Date("2026-01-01T18:00:00.000Z"),
			recurrenceRule({
				endType: "after_occurrences",
				occurrenceCount: 3,
			}),
			"2026-01-02",
			"2026-01-10",
		);

		expect(isoDates(occurrences)).toEqual([
			"2026-01-02T18:00:00.000Z",
			"2026-01-03T18:00:00.000Z",
		]);
	});

	it("does not count a skipped spring-forward wall time as an occurrence", () => {
		const occurrences = getOccurrencesInRange(
			new Date("2026-03-07T10:30:00.000Z"),
			recurrenceRule({
				endType: "after_occurrences",
				occurrenceCount: 3,
			}),
			"2026-03-07",
			"2026-03-12",
		);

		expect(isoDates(occurrences)).toEqual([
			"2026-03-07T10:30:00.000Z",
			"2026-03-09T09:30:00.000Z",
			"2026-03-10T09:30:00.000Z",
		]);
	});

	it("skips months that do not contain the DTSTART day", () => {
		const occurrences = getOccurrencesInRange(
			new Date("2026-01-31T18:00:00.000Z"),
			recurrenceRule({
				frequency: "month",
				monthlyPattern: "day_of_month",
			}),
			"2026-01-01",
			"2026-05-31",
		);

		expect(isoDates(occurrences)).toEqual([
			"2026-01-31T18:00:00.000Z",
			"2026-03-31T17:00:00.000Z",
			"2026-05-31T17:00:00.000Z",
		]);
	});

	it("applies a monthly interval from DTSTART", () => {
		const occurrences = getOccurrencesInRange(
			new Date("2026-01-15T18:00:00.000Z"),
			recurrenceRule({
				frequency: "month",
				interval: 2,
				monthlyPattern: "day_of_month",
			}),
			"2026-01-01",
			"2026-05-31",
		);

		expect(isoDates(occurrences)).toEqual([
			"2026-01-15T18:00:00.000Z",
			"2026-03-15T17:00:00.000Z",
			"2026-05-15T17:00:00.000Z",
		]);
	});

	it("skips months without DTSTART's nth weekday", () => {
		const occurrences = getOccurrencesInRange(
			new Date("2026-01-29T18:00:00.000Z"),
			recurrenceRule({
				frequency: "month",
				monthlyPattern: "nth_weekday",
			}),
			"2026-01-01",
			"2026-04-30",
		);

		expect(isoDates(occurrences)).toEqual([
			"2026-01-29T18:00:00.000Z",
			"2026-04-30T17:00:00.000Z",
		]);
	});

	it("skips non-leap years for a February 29 yearly series", () => {
		const occurrences = getOccurrencesInRange(
			new Date("2024-02-29T18:00:00.000Z"),
			recurrenceRule({ frequency: "year" }),
			"2024-01-01",
			"2028-12-31",
		);

		expect(isoDates(occurrences)).toEqual([
			"2024-02-29T18:00:00.000Z",
			"2028-02-29T18:00:00.000Z",
		]);
	});

	it("rejects invalid rules and unbounded-looking reversed ranges", () => {
		expect(() =>
			getOccurrencesInRange(
				new Date("2026-01-01T18:00:00.000Z"),
				recurrenceRule({ interval: 0 }),
				"2026-01-01",
				"2026-01-31",
			),
		).toThrow("positive integer");

		expect(() =>
			getOccurrencesInRange(
				new Date("2026-01-01T18:00:00.000Z"),
				recurrenceRule(),
				"2026-02-01",
				"2026-01-31",
			),
		).toThrow("must not precede");
	});
});

describe("getNextOccurrence", () => {
	it("returns an occurrence on the reference date", () => {
		const occurrence = getNextOccurrence(
			new Date("2026-01-01T18:00:00.000Z"),
			recurrenceRule({ frequency: "week" }),
			"2026-01-08",
		);

		expect(occurrence?.toISOString()).toBe("2026-01-08T18:00:00.000Z");
	});

	it("can jump far into a never-ending series without a fixed horizon", () => {
		const occurrence = getNextOccurrence(
			new Date("2020-01-01T18:00:00.000Z"),
			recurrenceRule(),
			"2050-06-15",
		);

		expect(occurrence?.toISOString()).toBe("2050-06-15T17:00:00.000Z");
	});

	it("returns null after a finite series has ended", () => {
		const occurrence = getNextOccurrence(
			new Date("2026-01-01T18:00:00.000Z"),
			recurrenceRule({
				endType: "after_occurrences",
				occurrenceCount: 2,
			}),
			"2026-01-10",
		);

		expect(occurrence).toBeNull();
	});
});

describe("getOccurrenceEnd", () => {
	it("preserves the seed wall-clock end when an occurrence crosses into PDT", () => {
		const end = getOccurrenceEnd(
			new Date("2026-03-01T09:30:00.000Z"),
			new Date("2026-03-01T11:30:00.000Z"),
			new Date("2026-03-08T09:30:00.000Z"),
		);

		expect(end.toISOString()).toBe("2026-03-08T10:30:00.000Z");
	});

	it("preserves the seed wall-clock end when an occurrence crosses into PST", () => {
		const end = getOccurrenceEnd(
			new Date("2026-10-25T07:30:00.000Z"),
			new Date("2026-10-25T09:30:00.000Z"),
			new Date("2026-11-01T07:30:00.000Z"),
		);

		expect(end.toISOString()).toBe("2026-11-01T10:30:00.000Z");
	});

	it("shifts a nonexistent spring-forward end ahead by the DST gap", () => {
		const end = getOccurrenceEnd(
			new Date("2026-03-01T09:30:00.000Z"),
			new Date("2026-03-01T10:30:00.000Z"),
			new Date("2026-03-08T09:30:00.000Z"),
		);

		expect(end.toISOString()).toBe("2026-03-08T10:30:00.000Z");
	});
});
