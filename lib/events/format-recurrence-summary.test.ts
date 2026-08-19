import { describe, expect, it } from "vitest";
import {
	formatRecurrenceSummary,
	type RecurrenceSummaryInput,
} from "@/lib/events/format-recurrence-summary";

const thirdTuesdayInSacramento = new Date("2026-11-18T03:00:00.000Z");

const baseRule = {
	startsAt: thirdTuesdayInSacramento,
	recurrenceFrequency: null,
	recurrenceInterval: null,
	recurrenceWeekdays: null,
	recurrenceMonthlyPattern: null,
	recurrenceEndType: null,
	recurrenceEndDate: null,
	recurrenceCount: null,
} satisfies RecurrenceSummaryInput;

describe("formatRecurrenceSummary", () => {
	it.each<{
		expected: string;
		name: string;
		rule: RecurrenceSummaryInput;
	}>([
		{
			name: "one-time events",
			rule: baseRule,
			expected: "Does not repeat",
		},
		{
			name: "daily events with no set end",
			rule: {
				...baseRule,
				recurrenceFrequency: "day",
				recurrenceInterval: 1,
				recurrenceEndType: "never",
			},
			expected: "Every day with no set end",
		},
		{
			name: "weekly events on multiple days ending after a count",
			rule: {
				...baseRule,
				recurrenceFrequency: "week",
				recurrenceInterval: 2,
				recurrenceWeekdays: [0, 2, 6],
				recurrenceEndType: "after_occurrences",
				recurrenceCount: 8,
			},
			expected:
				"Every 2 weeks on Sunday, Tuesday, and Saturday for 8 occurrences",
		},
		{
			name: "monthly events on a day of the month ending on a date",
			rule: {
				...baseRule,
				recurrenceFrequency: "month",
				recurrenceInterval: 1,
				recurrenceMonthlyPattern: "day_of_month",
				recurrenceEndType: "on_date",
				recurrenceEndDate: "2027-08-18",
			},
			expected: "Every month on day 17 through Aug 18, 2027",
		},
		{
			name: "monthly events on an ordinal weekday",
			rule: {
				...baseRule,
				recurrenceFrequency: "month",
				recurrenceInterval: 3,
				recurrenceMonthlyPattern: "nth_weekday",
				recurrenceEndType: "never",
			},
			expected: "Every 3 months on the 3rd Tuesday with no set end",
		},
		{
			name: "yearly events ending after a count",
			rule: {
				...baseRule,
				recurrenceFrequency: "year",
				recurrenceInterval: 2,
				recurrenceEndType: "after_occurrences",
				recurrenceCount: 4,
			},
			expected: "Every 2 years on November 17 for 4 occurrences",
		},
	])("formats $name", ({ expected, rule }) => {
		expect(formatRecurrenceSummary(rule)).toBe(expected);
	});
});
