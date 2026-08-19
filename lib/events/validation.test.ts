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
});
