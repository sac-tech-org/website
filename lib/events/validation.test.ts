import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateEventSubmission } from "@/lib/events/validation";

function validFormData(overrides: Record<string, string> = {}) {
	const values = {
		description: "A practical gathering for Sacramento technology people.",
		endsAt: "2026-03-08T03:30",
		eventUrl: "https://example.com/events/sac-tech",
		locationAddress: "100 Capitol Mall, Sacramento, CA",
		locationName: "Community Hall",
		mode: "hybrid",
		startsAt: "2026-03-08T01:30",
		title: "Sacramento Developer Meetup",
		...overrides,
	};
	const formData = new FormData();

	for (const [key, value] of Object.entries(values)) {
		formData.set(key, value);
	}

	return formData;
}

function recurringFormData(overrides: Record<string, string> = {}) {
	const formData = validFormData();
	const recurrenceValues = {
		recurring: "on",
		recurrenceEndType: "never",
		recurrenceFrequency: "week",
		recurrenceInterval: "1",
		...overrides,
	};

	for (const [key, value] of Object.entries(recurrenceValues)) {
		formData.set(key, value);
	}

	formData.append("recurrenceWeekdays", "0");
	return formData;
}

describe("validateEventSubmission", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("converts Pacific wall time correctly across daylight saving time", () => {
		const result = validateEventSubmission(validFormData());

		expect(result.errors).toBeUndefined();
		expect(result.data?.startsAt.toISOString()).toBe(
			"2026-03-08T09:30:00.000Z",
		);
		expect(result.data?.endsAt.toISOString()).toBe("2026-03-08T10:30:00.000Z");
	});

	it("rejects a nonexistent daylight saving wall time", () => {
		const result = validateEventSubmission(
			validFormData({ startsAt: "2026-03-08T02:30" }),
		);

		expect(result.errors?.startsAt).toContain("Choose a valid Pacific time.");
	});

	it("allows only http and https event links", () => {
		const result = validateEventSubmission(
			validFormData({ eventUrl: "javascript:alert(1)" }),
		);

		expect(result.errors?.eventUrl).toContain(
			"Use an http:// or https:// web address.",
		);
	});

	it("requires an online link for an online event", () => {
		const result = validateEventSubmission(
			validFormData({ eventUrl: "", locationName: "", mode: "online" }),
		);

		expect(result.errors?.eventUrl).toContain(
			"Add the online event or registration link.",
		);
	});

	it("rejects an end time before the start time", () => {
		const result = validateEventSubmission(
			validFormData({ endsAt: "2026-03-08T00:30" }),
		);

		expect(result.errors?.endsAt).toContain("The end must be after the start.");
	});

	it("does not accept moderation fields from the form", () => {
		const formData = validFormData();
		formData.set("status", "approved");
		formData.set("reviewedBy", "attacker");

		const result = validateEventSubmission(formData);

		expect(result.data).not.toHaveProperty("status");
		expect(result.data).not.toHaveProperty("reviewedBy");
	});

	it("normalizes a weekly recurrence rule in Pacific time", () => {
		const formData = recurringFormData();
		formData.append("recurrenceWeekdays", "2");

		const result = validateEventSubmission(formData);

		expect(result.errors).toBeUndefined();
		expect(result.data?.recurrence).toEqual({
			endDate: null,
			endType: "never",
			frequency: "week",
			interval: 1,
			monthlyPattern: null,
			occurrenceCount: null,
			weekdays: [0, 2],
		});
	});

	it("accepts an on-date ending when inactive count controls are omitted", () => {
		const result = validateEventSubmission(
			recurringFormData({
				recurrenceEndDate: "2026-04-05",
				recurrenceEndType: "on_date",
			}),
		);

		expect(result.errors).toBeUndefined();
		expect(result.data?.recurrence).toMatchObject({
			endDate: "2026-04-05",
			endType: "on_date",
			occurrenceCount: null,
		});
	});

	it("accepts an occurrence limit when inactive date controls are omitted", () => {
		const result = validateEventSubmission(
			recurringFormData({
				recurrenceCount: "12",
				recurrenceEndType: "after_occurrences",
			}),
		);

		expect(result.errors).toBeUndefined();
		expect(result.data?.recurrence).toMatchObject({
			endDate: null,
			endType: "after_occurrences",
			occurrenceCount: 12,
		});
	});

	it("requires a weekly rule to include the first event weekday", () => {
		const formData = recurringFormData();
		formData.delete("recurrenceWeekdays");
		formData.append("recurrenceWeekdays", "2");

		const result = validateEventSubmission(formData);

		expect(result.errors?.recurrenceWeekdays).toContain(
			"Include the weekday of the first event.",
		);
	});

	it("rejects a recurrence ending before its first event", () => {
		const result = validateEventSubmission(
			recurringFormData({
				recurrenceEndDate: "2026-03-07",
				recurrenceEndType: "on_date",
			}),
		);

		expect(result.errors?.recurrenceEndDate).toContain(
			"The recurrence cannot end before the first event.",
		);
	});

	it("requires at least two occurrences for a count-limited rule", () => {
		const result = validateEventSubmission(
			recurringFormData({
				recurrenceCount: "1",
				recurrenceEndType: "after_occurrences",
			}),
		);

		expect(result.errors?.recurrenceCount).toContain(
			"Use at least 2 occurrences.",
		);
	});

	it("ignores recurrence fields unless recurrence is enabled", () => {
		const formData = validFormData();
		formData.set("recurrenceFrequency", "day");
		formData.set("recurrenceEndType", "never");

		const result = validateEventSubmission(formData);

		expect(result.data?.recurrence).toBeNull();
	});
});
